
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Settings as SettingsIcon, ExternalLink, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import Settings from './components/Settings';
import BookmarkCard from './components/BookmarkCard';
import Onboarding from './components/Onboarding';
import { getTree, flattenBookmarks } from './lib/bookmarks';
import { getEmbedding, rerankBookmarks } from './lib/gemini';

const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

function App() {
  const [view, setView] = useState('home'); // 'home' | 'settings' | 'onboarding'
  const [hasKey, setHasKey] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [semanticScores, setSemanticScores] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [rerankedIds, setRerankedIds] = useState(null);
  const [isReranking, setIsReranking] = useState(false);
  const [rerankError, setRerankError] = useState(null);


  // Check for API Key and set initial view
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
          setHasKey(true);
          setApiKey(result.geminiApiKey);
          setView('home');
        } else {
          setHasKey(false);
          setView('onboarding');
        }
      });
    }
  }, []); // Run only once on component mount

  // Load Bookmarks and Metadata
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return;

    const loadData = async () => {
      // Load Bookmarks
      const tree = await getTree();
      const flat = flattenBookmarks(tree);
      setBookmarks(flat);

      // Load Metadata
      const keys = flat.map(b => `bookmark_${b.id}`);
      chrome.storage.local.get(keys, (result) => {
        setMetadata(result);
      });
    };

    loadData();

    // Listen for metadata updates from background script
    const handleStorageChange = (changes, area) => {
      if (area === 'local') {
        setMetadata(prev => {
          const next = { ...prev };
          for (const [key, { newValue }] of Object.entries(changes)) {
            if (key.startsWith('bookmark_')) {
              next[key] = newValue;
            }
          }
          return next;
        });
        // Also update API key if it changed
        if (changes.geminiApiKey) {
          setApiKey(changes.geminiApiKey.newValue);
          setHasKey(!!changes.geminiApiKey.newValue);
          if (!changes.geminiApiKey.newValue) { // If key is removed, go to onboarding
            setView('onboarding');
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Semantic Search & Reranking Effect
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery || searchQuery.length < 2 || !apiKey) {
        setSemanticScores({});
        setRerankedIds(null);
        setRerankError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setRerankedIds(null); // Reset reranking while searching
      setRerankError(null);

      let scores = {};
      let embeddingSuccess = false;

      try {
        // 1. Get Query Embedding
        const queryEmbedding = await getEmbedding(apiKey, searchQuery);

        if (queryEmbedding) {
          embeddingSuccess = true;
          Object.entries(metadata).forEach(([key, data]) => {
            if (data && data.embedding) {
              const score = cosineSimilarity(queryEmbedding, data.embedding);
              if (score > 0.15) { // Keep reasonable threshold for "good" semantic matches
                scores[key] = score;
              }
            }
          });
          setSemanticScores(scores);
        } else {
          console.warn("Embedding failed or returned null. Falling back to keyword search.");
        }
      } catch (embedErr) {
        console.error("Embedding error:", embedErr);
      }

      // 2. Identify Top Candidates for Reranking
      const lowerQuery = searchQuery.toLowerCase();
      const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 1); // Split into terms for fuzzy match

      // Get all items with their scores
      const allItemsWithScores = bookmarks.map(b => ({
        ...b,
        score: scores[`bookmark_${b.id} `] || 0,
        meta: metadata[`bookmark_${b.id} `]
      }));

      // Sort by score descending
      allItemsWithScores.sort((a, b) => b.score - a.score);

      // Filter candidates
      const candidatesPool = allItemsWithScores.filter(b => {
        const meta = b.meta;
        const title = b.title.toLowerCase();
        const summary = meta?.summary?.toLowerCase() || '';
        const keywords = meta?.keywords?.toLowerCase() || '';

        // 1. Exact phrase match (strongest)
        if (title.includes(lowerQuery) || summary.includes(lowerQuery) || keywords.includes(lowerQuery)) return true;

        // 2. Semantic match (if embedding worked)
        if (b.score > 0.05) return true;

        // 3. Term match (fallback if embedding failed or for specific terms)
        // If ALL terms are present in title/summary/keywords
        const allTermsMatch = queryTerms.every(term =>
          title.includes(term) || summary.includes(term) || keywords.includes(term)
        );
        if (allTermsMatch) return true;

        return false;
      });

      // Limit to top 15 for reranking
      const candidates = candidatesPool
        .slice(0, 15)
        .map(b => ({
          id: b.id,
          title: b.title,
          url: b.url,
          summary: b.meta?.summary || ''
        }));

      // 3. AI Reranking (if we have candidates)
      if (candidates.length > 0) {
        setIsReranking(true);
        try {
          const rankedIds = await rerankBookmarks(apiKey, searchQuery, candidates);

          if (rankedIds && Array.isArray(rankedIds) && rankedIds.length > 0) {
            setRerankedIds(rankedIds);
          } else {
            console.warn("Reranking returned empty. Ignoring.");
          }
        } catch (rerankErr) {
          console.error("Reranking failed:", rerankErr);
          setRerankError(rerankErr.message || "Reranking failed");
        } finally {
          setIsReranking(false);
        }
      } else {
        setIsReranking(false);
      }

      setIsSearching(false);
    };

    const timeoutId = setTimeout(performSearch, 800);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, apiKey, metadata]);

  // Filtered Bookmarks for Display
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery) return bookmarks;

    // If we have reranked IDs, use them strictly as they are the "gold standard" from AI
    if (rerankedIds && rerankedIds.length > 0) {
      const rankedMap = new Map();
      // Normalize all IDs to strings to avoid number/string mismatch (AI often returns numbers)
      rerankedIds.forEach((id, index) => rankedMap.set(String(id), index));

      return bookmarks
        .filter(b => rankedMap.has(String(b.id)))
        .sort((a, b) => rankedMap.get(String(a.id)) - rankedMap.get(String(b.id)));
    }

    // Fallback: Robust Scoring System
    // This handles cases where AI reranking fails or semantic search is weak.
    // It ensures we always show *relevant* results instead of a blank screen.
    const lowerQuery = searchQuery.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 0);

    const scoredBookmarks = bookmarks.map(b => {
      const meta = metadata[`bookmark_${b.id} `];
      const title = b.title.toLowerCase();
      const summary = meta?.summary?.toLowerCase() || '';
      const keywords = meta?.keywords?.toLowerCase() || '';
      const fullText = `${title} ${summary} ${keywords} `;

      let matchScore = 0;

      // 1. Exact Phrase Match (Highest Priority)
      if (fullText.includes(lowerQuery)) {
        matchScore += 100;
      }

      // 2. Term Matching
      let termsMatched = 0;
      queryTerms.forEach(term => {
        if (fullText.includes(term)) {
          termsMatched++;
        }
      });

      if (termsMatched === queryTerms.length) {
        matchScore += 50; // All terms present
      } else if (termsMatched > 0) {
        matchScore += (termsMatched / queryTerms.length) * 30; // Partial match
      }

      // 3. Semantic Score (from Embedding)
      const semanticScore = semanticScores[`bookmark_${b.id} `] || 0;
      // Scale semantic score (0-1) to be comparable (e.g., 0.5 -> 25 points)
      // We give it significant weight but less than exact keyword matches to avoid "hallucinations"
      matchScore += semanticScore * 50;

      return { ...b, matchScore };
    });

    // Filter out irrelevant items (score < 5)
    // This threshold ensures we don't show complete garbage, but is low enough to show "partial" matches (like "ev" in "purchase ev")
    const filtered = scoredBookmarks.filter(b => b.matchScore > 5);

    // Sort by score descending
    return filtered.sort((a, b) => b.matchScore - a.matchScore);
  }, [bookmarks, searchQuery, semanticScores, rerankedIds, metadata]);

  // Trigger AI Analysis for visible bookmarks
  const handleAnalyze = () => {
    setIsSyncing(true);

    // Get IDs of currently filtered bookmarks
    const idsToProcess = filteredBookmarks.map(b => b.id);

    if (idsToProcess.length === 0) {
      setIsSyncing(false);
      return;
    }

    // Send batch processing request to background script
    chrome.runtime.sendMessage({
      action: 'BATCH_PROCESS_BOOKMARKS',
      bookmarkIds: idsToProcess
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Batch process error:", chrome.runtime.lastError);
      }
      // The background script will handle the queue. 
      // We just keep the spinner for a bit to show "activity"
      setTimeout(() => setIsSyncing(false), 2000);
    });
  };

  if (view === 'onboarding') {
    return <Onboarding onComplete={() => setView('home')} />;
  }

  if (view === 'settings') {
    return <Settings onBack={() => setView('home')} />;
  }

  return (
    <div className="w-full h-full bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Sparkles size={18} />
          </div>
          <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Lumina
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAnalyze}
            disabled={isSyncing}
            className={`p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all ${isSyncing ? 'animate-spin text-blue-600' : ''}`}
            title="Analyze Bookmarks with AI"
          >
            {isSyncing ? <RefreshCw size={20} /> : <RefreshCw size={20} />}
          </button>
          <button
            onClick={() => setView('settings')}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!hasKey && (
          <div className="m-4 mb-0 bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800 flex items-center gap-2">
            <span className="font-bold">⚠️ Setup Required:</span>
            Please add your Gemini API Key in settings.
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 pb-2">
          <div className="mb-6 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search bookmarks (e.g., 'electric cars', 'coding tutorials')..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
              {isReranking && !isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-blue-500 flex items-center gap-1 bg-white pl-2">
                  <Sparkles size={12} className="animate-pulse" />
                  Thinking...
                </div>
              )}
            </div>
            {rerankError && (
              <div className="absolute top-full mt-1 right-0 text-xs text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">
                AI Error: {rerankError}
              </div>
            )}
          </div>
        </div>

        {/* Bookmark List */}
        <div className="flex-1 overflow-y-auto p-4 pt-2 scrollbar-hide">
          {filteredBookmarks.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>No bookmarks found.</p>
            </div>
          ) : (
            filteredBookmarks.map(b => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                metadata={metadata[`bookmark_${b.id}`]}
                score={semanticScores[`bookmark_${b.id}`]}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

