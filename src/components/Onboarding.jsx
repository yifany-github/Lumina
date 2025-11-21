import React, { useState } from 'react';
import { Shield, Globe, Key, ArrowRight, Check } from 'lucide-react';
import { translations } from '../lib/translations';

export default function Onboarding({ onComplete }) {
    const [step, setStep] = useState(0);
    const [language, setLanguage] = useState('en'); // Default to English, user can change
    const [apiKey, setApiKey] = useState('');

    const t = translations[language] || translations['en'];

    const handleLanguageSelect = (lang) => {
        setLanguage(lang);
        chrome.storage.local.set({ language: lang });
    };

    const handleSaveKey = () => {
        if (apiKey.trim()) {
            chrome.storage.local.set({ geminiApiKey: apiKey.trim() }, () => {
                setStep(step + 1);
            });
        }
    };

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

    const steps = [
        // Step 0: Welcome & Language
        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{t.welcome}</h2>
            <p className="text-gray-600">{t.welcomeDesc}</p>

            <div className="w-full max-w-xs space-y-3 mt-8">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t.languageTitle}</p>
                <div className="grid grid-cols-2 gap-3">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleLanguageSelect(lang.code)}
                            className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${language === lang.code
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>,

        // Step 1: Privacy
        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{t.privacyTitle}</h2>
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-left">
                <p className="text-gray-600 leading-relaxed text-sm">
                    {t.privacyDesc}
                </p>
            </div>
        </div>,

        // Step 2: API Key
        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
                <Key className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{t.apiKeyTitle}</h2>
            <p className="text-gray-600 text-sm">{t.apiKeyDesc}</p>

            <div className="w-full space-y-4">
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t.apiKeyPlaceholder}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
                <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-1"
                >
                    {t.getKey} <ArrowRight size={12} />
                </a>
            </div>
        </div>,

        // Step 3: Complete
        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{t.setupComplete}</h2>
            <p className="text-gray-600">{t.setupDesc}</p>
        </div>
    ];

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Progress Bar */}
            <div className="w-full h-1 bg-gray-100">
                <div
                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                    style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                />
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-center px-8 max-w-md mx-auto w-full overflow-y-auto py-8">
                {steps[step]}
            </div>

            {/* Footer Navigation */}
            <div className="p-6 border-t border-gray-100 bg-white">
                <div className="max-w-md mx-auto w-full flex justify-between items-center">
                    {/* Dots */}
                    <div className="flex gap-2">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-blue-500' : 'bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Button */}
                    <button
                        onClick={() => {
                            if (step === 2) {
                                handleSaveKey();
                            } else if (step === steps.length - 1) {
                                onComplete();
                            } else {
                                setStep(step + 1);
                            }
                        }}
                        disabled={step === 2 && !apiKey.trim()}
                        className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${step === 2 && !apiKey.trim()
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30'
                            }`}
                    >
                        {step === steps.length - 1 ? t.finish : t.next}
                        {step !== steps.length - 1 && <ArrowRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
