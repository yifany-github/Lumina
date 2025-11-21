chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'FETCH_CONTENT' && msg.target === 'offscreen') {
        fetchAndParse(msg.url).then(sendResponse);
        return true; // Keep channel open for async response
    }
});

async function fetchAndParse(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include', // Send cookies (might help with some sites)
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const text = await response.text();

        // Use DOMParser to extract text safely
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // Remove scripts and styles
        const scripts = doc.querySelectorAll('script, style, noscript, iframe, svg, link, meta');
        scripts.forEach(script => script.remove());

        // Get text content
        const bodyText = doc.body.innerText || doc.body.textContent;

        // Clean up whitespace
        return bodyText.replace(/\s+/g, ' ').trim().substring(0, 20000);
    } catch (err) {
        console.error('Offscreen fetch error:', err);
        return { error: err.message };
    }
}
