# How to Install and Use Your AI Bookmark Manager

## Installation
1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** in the top right corner.
3.  Click **Load unpacked**.
4.  Select the `dist` folder in your project directory:
    `/Users/yifan/Downloads/aibookmark-gemini/dist`

## Configuration
1.  Click the extension icon in your toolbar.
2.  Click the **Settings** (gear icon) in the top right.
3.  Enter your **Google Gemini API Key**.
    *   If you don't have one, get it here: [Google AI Studio](https://aistudio.google.com/app/apikey)
4.  Click **Save Key**.

## Usage
1.  **Analyze Bookmarks**: On the home screen, click the **Refresh/Sync** icon (next to settings). This will start processing your bookmarks.
    *   *Note: To avoid rate limits, it processes bookmarks one by one. You might need to wait a bit for all of them to be summarized.*
2.  **Search**: Type in the search bar. You can search by:
    *   Title
    *   URL
    *   **AI Summary** (e.g., "article about react hooks")
    *   **Tags** (e.g., "coding", "tutorial")
3.  **New Bookmarks**: When you add a new bookmark in Chrome, the extension will automatically detect it, fetch the content, and summarize it in the background.
