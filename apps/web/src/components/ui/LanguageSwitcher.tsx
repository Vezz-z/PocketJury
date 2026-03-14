'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'bn', label: 'বাংলা' },
];

export function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const [langOpen, setLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);

    const currentLocale = pathname.split('/')[1] || 'en';

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLanguageChange = (code: string) => {
        setLangOpen(false);
        const rest = pathname.replace(/^\/[a-z]{2}/, '');
        router.push(`/${code}${rest || '/'}`);
    };

    return (
        <div className="relative" ref={langRef}>
            <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 text-sm font-medium text-body hover:text-heading transition-colors px-3 py-1.5 rounded-md hover:bg-elevated border"
                style={{ borderColor: 'var(--color-border)' }}
            >
                <Globe className="h-4 w-4 text-primary-600 dark:text-blue-400" />
                <span className="hidden sm:inline-block">{LANGUAGES.find((l) => l.code === currentLocale)?.label || 'English'}</span>
                <span className="sm:hidden">{currentLocale.toUpperCase()}</span>
                <ChevronDown className="h-3 w-3" />
            </button>
            {langOpen && (
                <div
                    className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg border overflow-hidden z-50"
                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-elevated ${currentLocale === lang.code ? 'font-semibold text-heading' : 'text-body'
                                }`}
                            onClick={() => handleLanguageChange(lang.code)}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
