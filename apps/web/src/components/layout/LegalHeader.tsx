'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Scale, Globe, ChevronDown, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'bn', label: 'বাংলা' },
];

export function LegalHeader() {
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
        <header className="fixed top-0 inset-x-0 border-b bg-card/80 backdrop-blur-md z-40" style={{ borderColor: 'var(--color-border)' }}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                <Link href={`/${currentLocale}`} className="flex flex-1 items-center gap-2">
                    <Scale className="h-6 w-6 text-primary-600 dark:text-blue-400" />
                    <span className="text-lg font-bold text-heading hidden sm:inline-block">PocketJury</span>
                </Link>

                <div className="flex-1 flex justify-center">
                    <div className="relative" ref={langRef}>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            className="flex items-center gap-1 text-sm font-medium text-body hover:text-heading transition-colors px-3 py-1.5 rounded-md hover:bg-elevated border"
                            style={{ borderColor: 'var(--color-border)' }}
                        >
                            <Globe className="h-4 w-4 text-primary-600 dark:text-blue-400" />
                            <span>{LANGUAGES.find((l) => l.code === currentLocale)?.label || 'English'}</span>
                            <ChevronDown className="h-3 w-3" />
                        </button>
                        {langOpen && (
                            <div
                                className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-36 rounded-lg shadow-lg border overflow-hidden z-50"
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
                </div>

                <div className="flex flex-1 items-center justify-end">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
