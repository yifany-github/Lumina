import React from 'react';
import { ExternalLink, Tag, Clock } from 'lucide-react';

const BookmarkCard = ({ bookmark, metadata, score }) => {
    const { title, url, dateAdded } = bookmark;
    const { summary, tags, status, error } = metadata || {};

    const date = new Date(dateAdded).toLocaleDateString();

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all mb-3 group relative overflow-hidden">
            {status === 'loading' && (
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden">
                    <div className="h-full bg-blue-500 animate-progress origin-left-right"></div>
                </div>
            )}

            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                        {title}
                    </h3>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 flex items-center gap-1 mt-1 hover:text-gray-600 truncate"
                    >
                        <ExternalLink size={10} />
                        {new URL(url).hostname}
                    </a>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1">
                    {score && <span className="text-blue-500 font-mono mr-1">{(score * 100).toFixed(0)}%</span>}
                    <Clock size={10} />
                    {date}
                </span>
            </div>

            {status === 'error' && (
                <div className="mt-2 flex items-center justify-between text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                    <span>AI Error: {error || 'Unknown error'}</span>
                    {error !== 'Restricted URL' && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                // Visual feedback
                                e.target.innerText = 'Retrying...';
                                e.target.disabled = true;

                                chrome.runtime.sendMessage({
                                    action: 'PROCESS_BOOKMARK',
                                    id: bookmark.id,
                                    url: bookmark.url
                                }, (response) => {
                                    console.log("Retry sent:", response);
                                });
                            }}
                            className="text-red-700 hover:text-red-900 font-medium underline disabled:opacity-50 disabled:no-underline"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            {summary && (
                <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 whitespace-pre-line">
                    {summary}
                </div>
            )}

            {tags && tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                        >
                            <Tag size={10} className="mr-1" />
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BookmarkCard;
