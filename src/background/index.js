import { summarizeContent, getEmbedding } from '../lib/gemini';

console.log("Background service worker started.");

// Helper to get API key
const getApiKey = async () => {
  const result = await chrome.storage.local.get(['geminiApiKey']);
  return result.geminiApiKey;
};

// Helper to create offscreen document if not exists
const setupOffscreenDocument = async (path) => {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['DOM_PARSER'],
    justification: 'Parse DOM for content extraction',
  });
};

// Helper to fetch page content using offscreen document
const fetchPageContent = async (url) => {
  // Skip restricted URLs
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.includes('chromewebstore.google.com')) {
    return null;
  }

  try {
    await setupOffscreenDocument('offscreen.html');

    // Send message to offscreen document to fetch and parse
    const content = await chrome.runtime.sendMessage({
      type: 'FETCH_CONTENT',
      target: 'offscreen',
      url: url
    });

    return content;
  } catch (error) {
    console.error("Error fetching page via offscreen:", error);
    return null;
  }
};

// Helper to fetch content by opening a temporary tab (Fallback)
const fetchViaTab = async (url) => {
  console.log("Attempting fetch via tab for:", url);
  try {
    // Create a tab but don't make it active
    const tab = await chrome.tabs.create({ url, active: false });

    // Wait for tab to load
    await new Promise((resolve, reject) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout after 30s
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log("Tab load timed out");
        resolve(); // Try anyway
      }, 30000);
    });

    console.log("Tab loaded, waiting for SPA hydration...");
    await new Promise(r => setTimeout(r, 3000)); // Wait 3s for React/Vue to render

    console.log("Executing script...");
    // Execute script to get text
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Remove noise but be less aggressive
        const scripts = document.querySelectorAll('script, style, noscript, iframe, svg');
        scripts.forEach(s => s.remove());
        return document.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 20000);
      }
    });
    console.log("Script result:", result);

    // Close the tab
    await chrome.tabs.remove(tab.id);

    if (result && result[0] && result[0].result) {
      return result[0].result;
    }
    return null;
  } catch (error) {
    console.error("Tab fetch error:", error);
    return null;
  }
};

// Process a single bookmark
const processBookmark = async (id, url) => {
  console.log(`Processing bookmark: ${url}`);

  // Set status to loading
  await chrome.storage.local.set({
    [`bookmark_${id}`]: { status: 'loading', lastUpdated: Date.now() }
  });

  const apiKey = await getApiKey();

  if (!apiKey) {
    console.log("No API key found.");
    await chrome.storage.local.set({
      [`bookmark_${id}`]: { status: 'error', error: 'No API Key', lastUpdated: Date.now() }
    });
    return;
  }

  // Try offscreen fetch first
  let content = null; // await fetchPageContent(url); // Disable offscreen for now to force tab fallback

  // If offscreen failed (and not restricted), try tab fallback
  if (!content || (typeof content === 'object' && content.error)) {
    const isRestricted = url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.includes('chromewebstore.google.com');

    if (!isRestricted) {
      console.log("Trying tab fallback for:", url);
      content = await fetchViaTab(url);
    }

    // If content fetch STILL failed (or is restricted), try summarizing just the URL!
    if (!content || (typeof content === 'object' && content.error)) {
      console.log("Fetch failed or restricted. Trying to summarize URL directly:", url);

      // We pass a special flag or just the URL string to the summarizer
      // The summarizer needs to know this is a URL, not content.
      // Let's prefix it clearly.
      content = `URL_ONLY_MODE: ${url}`;
    }
  }

  // Get user language preference
  const { language } = await chrome.storage.local.get(['language']);
  const targetLang = language || 'en';

  const analysis = await summarizeContent(apiKey, content, targetLang);

  if (analysis) {
    console.log("AI Analysis:", analysis);

    // Use the summary returned by AI (which should now be in target language)
    // If we have a specific translation for the target language, use it.
    // Otherwise fall back to the main summary.
    let fullSummary = analysis.summary;

    // If the user explicitly wants Chinese, and we have it (legacy or new), use it.
    if (targetLang === 'zh' && analysis.summary_cn) {
      fullSummary = analysis.summary_cn;
    } else if (targetLang !== 'en' && analysis[`summary_${targetLang}`]) {
      // Future proofing if we return summary_es, summary_fr etc.
      fullSummary = analysis[`summary_${targetLang}`];
    }

    // Generate Embedding for semantic search
    // We embed the summary, tags, AND the rich keywords.
    const textToEmbed = `${analysis.summary} ${analysis.summary_cn || ''} ${analysis.keywords || ''} ${analysis.tags.join(' ')}`;
    const embedding = await getEmbedding(apiKey, textToEmbed);

    await chrome.storage.local.set({
      [`bookmark_${id}`]: {
        status: 'success',
        summary: fullSummary,
        tags: analysis.tags,
        keywords: analysis.keywords, // Save keywords for debugging/search
        embedding: embedding,
        lastUpdated: Date.now(),
        language: targetLang // Store which language this was generated in
      }
    });
    console.log(`Saved analysis for bookmark ${id}`);
  } else {
    await chrome.storage.local.set({
      [`bookmark_${id}`]: { status: 'error', error: 'AI Error', lastUpdated: Date.now() }
    });
  }
};

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
});

// Listen for new bookmarks
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  if (bookmark.url) {
    processBookmark(id, bookmark.url);
  }
});

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PROCESS_BOOKMARK') {
    processBookmark(request.id, request.url);
    sendResponse({ status: 'queued' });
  } else if (request.action === 'BATCH_PROCESS_BOOKMARKS') {
    console.log(`Received batch process request for ${request.bookmarkIds.length} bookmarks.`);

    // Process sequentially to avoid overwhelming the browser/API
    // We add a delay to respect rate limits (e.g., Gemini Free tier is often 15 RPM)
    const processBatch = async () => {
      for (const id of request.bookmarkIds) {
        try {
          const [bookmark] = await chrome.bookmarks.get(id);
          if (bookmark && bookmark.url) {
            await processBookmark(id, bookmark.url);
            // Wait 4 seconds between requests to stay under ~15 RPM
            await new Promise(resolve => setTimeout(resolve, 4000));
          }
        } catch (err) {
          console.error(`Error processing bookmark ${id} in batch:`, err);
        }
      }
    };

    processBatch();
    sendResponse({ status: 'batch_queued' });
  }
  return true;
});
