import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Trash2, Shield, Globe, AlertTriangle, Check } from 'lucide-react';

import { translations } from '../lib/translations';

const Settings = ({ onBack }) => {
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState('');
    const [language, setLanguage] = useState('en');
    const [isClearing, setIsClearing] = useState(false);

    useEffect(() => {
        chrome.storage.local.get(['geminiApiKey', 'language'], (result) => {
            if (result.geminiApiKey) setApiKey(result.geminiApiKey);
            if (result.language) setLanguage(result.language);
        });
    }, []);

    const handleSave = () => {
        chrome.storage.local.set({
            geminiApiKey: apiKey.trim(),
            language: language
        }, () => {
            setStatus('saved');
            setTimeout(() => setStatus(''), 2000);
        });
    };

    const handleClearMetadata = async () => {
        if (window.confirm('Are you sure? This will delete all AI generated data.')) {
            setIsClearing(true);
            // Get all keys
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(allData).filter(k => k.startsWith('bookmark_'));

            await chrome.storage.local.remove(keysToRemove);
            setIsClearing(false);
            setStatus('cleared');
            setTimeout(() => setStatus(''), 2000);
        }
    };

    const t = translations[language] || translations['en'];

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'zh', label: '简体中文' },
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'vi', label: 'Tiếng Việt' },
        { code: 'es', label: 'Español' },
        { code: 'fr', label: 'Français' },
        { code: 'ja', label: '日本語' },
        { code: 'ko', label: '한국어' }
    ];

    return (
        <div className="w-full h-full bg-gray-50 overflow-y-auto pb-8">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">{t.settings}</h1>
                    <div className="w-10" /> {/* Spacer for alignment */}
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

                {/* Language Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Globe size={20} />
                        </div>
                        <h2 className="font-medium text-gray-800">{t.language}</h2>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => setLanguage(lang.code)}
                                    className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${language === lang.code
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-100 hover:border-gray-200 text-gray-600'
                                        }`}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* API Key Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <KeyIcon />
                        </div>
                        <h2 className="font-medium text-gray-800">{t.apiKey}</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
                            >
                                {status === 'saved' ? <CheckIcon /> : <Save size={16} />}
                                {status === 'saved' ? t.saved : t.save}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Privacy Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                            <Shield size={20} />
                        </div>
                        <h2 className="font-medium text-gray-800">{t.privacy}</h2>
                    </div>
                    <div className="p-6 bg-gray-50/50">
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {t.privacyText}
                        </p>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                    <div className="p-4 border-b border-red-50 flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg text-red-600">
                            <AlertTriangle size={20} />
                        </div>
                        <h2 className="font-medium text-red-600">{t.dangerZone}</h2>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <p className="text-xs text-gray-500 max-w-[200px]">
                            {t.clearDataDesc}
                        </p>
                        <button
                            onClick={handleClearMetadata}
                            disabled={isClearing}
                            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            {isClearing ? t.clearing : t.clearData}
                        </button>
                    </div>
                </div>

                {/* Creator Info */}
                <div className="text-center pt-4 pb-2">
                    <a
                        href="https://github.com/yifany-github/Lumina"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-blue-500 transition-colors font-medium"
                    >
                        Created by Yifan
                    </a>
                </div>

            </div>
        </div>
    );
};

const KeyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
);

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default Settings;
