import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-flash";

export const createGeminiClient = (apiKey) => {
  // Sanitize API key to remove any non-ASCII characters (like hidden spaces or newlines)
  // which can cause "String contains non ISO-8859-1 code point" errors in Headers.append
  const sanitizedKey = apiKey ? apiKey.replace(/[^\x00-\x7F]/g, "").trim() : "";
  return new GoogleGenerativeAI(sanitizedKey);
};

export const summarizeContent = async (apiKey, content, targetLang = 'en') => {
  const genAI = createGeminiClient(apiKey);

  const isUrlMode = content.startsWith('URL_ONLY_MODE: ');
  const actualContent = isUrlMode ? content.replace('URL_ONLY_MODE: ', '') : content.substring(0, 15000);

  const langMap = {
    'en': 'English',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'vi': 'Vietnamese',
    'es': 'Spanish',
    'fr': 'French',
    'ja': 'Japanese',
    'ko': 'Korean'
  };

  const targetLangName = langMap[targetLang] || 'English';

  const prompt = `You are a helpful assistant that summarizes web pages for a bookmark manager.
  
  ${isUrlMode ?
      `I cannot fetch the content of this webpage, but here is the URL: "${actualContent}". 
     Please use your internal knowledge to summarize what this website or page is likely about based on the URL.`
      :
      `1. Analyze the content and provide a concise summary (max 2 sentences) in ${targetLangName}.`
    }

  2. Provide 5-10 relevant tags (in ${targetLangName}).
  3. IMPORTANT: Generate a "keywords" string that includes synonyms, related concepts, and translations (English <-> ${targetLangName}) to aid search. 
  4. Return the response in this JSON format: 
     { 
       "summary": "Summary in ${targetLangName}...", 
       "tags": ["tag1", "tag2"],
       "keywords": "synonyms related terms translations..."
     }
  
  Content:
  ${actualContent}...`;

  const generate = async (retryCount = 0) => {
    try {
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      // Handle Rate Limiting (429)
      if (error.message.includes('429') && retryCount < 3) {
        console.warn(`Quota exhausted. Retrying in ${(retryCount + 1) * 5}s...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 5000));
        return generate(retryCount + 1);
      }
      throw error;
    }
  };

  try {
    return await generate();
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    return null;
  }
};

export const getEmbedding = async (apiKey, text) => {
  const genAI = createGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    return null;
  }
};

export const rerankBookmarks = async (apiKey, query, candidates) => {
  const genAI = createGeminiClient(apiKey);

  const candidatesText = candidates.map(c =>
    `ID: ${c.id}\nTitle: ${c.title}\nURL: ${c.url}\nSummary: ${c.summary}`
  ).join('\n---\n');

  const prompt = `You are a search ranking expert.
  User Query: "${query}"
  
  Candidate Bookmarks:
  ${candidatesText}
  
  Task: Rank these bookmarks by relevance to the user's query.
  CRITICAL:
  1. Understand the USER INTENT. "购买电车" means "Buy Electric Car". 
  2. Prioritize bookmarks that are DIRECTLY related to the intent (e.g., Tesla, EV manufacturers, car reviews).
  3. Handle CROSS-LINGUAL matches intelligently. If the query is Chinese ("电车") and the bookmark is English ("Tesla Model Y"), it IS a match.
  4. Downrank irrelevant items even if they have high keyword overlap (e.g., a generic store page vs the specific product page).
  
  Return a JSON object with a "rankedIds" array containing the IDs of the candidates sorted by relevance (most relevant first).
  Include ALL candidate IDs in the output, sorted.
  
  JSON Response:`;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return parsed.rankedIds;
  } catch (error) {
    console.error("Reranking Error:", error);
    // Throw a more descriptive error that can be shown in the UI
    if (error.message && error.message.includes("SAFETY")) {
      throw new Error("AI blocked content due to safety settings.");
    }
    if (error instanceof SyntaxError) {
      throw new Error("AI returned invalid JSON.");
    }
    throw error;
  }
};
