// ==============================================================================
// PocketJury — Guest Header (for unauthenticated "Try Now" mode)
// ==============================================================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Scale, LogIn, UserPlus, Globe, ChevronDown, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useUIStore } from '@/store';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
];

export function GuestHeader() {
  const t = useTranslations('guest');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleDesktopSidebar = useUIStore((s) => s.toggleDesktopSidebar);

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    setLangOpen(false);
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <header
      className="flex items-center h-14 px-4 border-b bg-card/95 backdrop-blur-md flex-shrink-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Sidebar toggle (mobile) */}
      <button
        className="md:hidden p-2 -ml-2 mr-2 rounded-md hover:bg-elevated transition-colors text-body"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar toggle */}
      <button
        className="hidden md:flex p-2 -ml-2 mr-2 rounded-md hover:bg-elevated transition-colors text-body"
        onClick={toggleDesktopSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Brand (mobile only, desktop has sidebar brand) */}
      <Link href={`/${locale}`} className="md:hidden flex items-center gap-1.5 mr-auto">
        <Scale className="h-5 w-5 text-primary-600 dark:text-blue-400" />
        <span className="text-base font-bold text-heading">PocketJury</span>
      </Link>

      {/* Preview badge */}
      <div
        className="hidden md:flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold mr-auto"
        style={{
          background: 'var(--color-primary-light)',
          color: 'var(--color-primary)',
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--color-primary)' }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: 'var(--color-primary)' }} />
        </span>
        {t('previewBadge')}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1 text-sm text-body hover:text-heading transition-colors px-2 py-1 rounded-md hover:bg-elevated"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">
              {LANGUAGES.find((l) => l.code === locale)?.label || 'English'}
            </span>
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
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-elevated ${
                    locale === lang.code ? 'font-semibold text-heading' : 'text-body'
                  }`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ThemeToggle />

        {/* Login / Signup CTAs */}
        <div className="hidden sm:flex items-center gap-2">
          <Link
            href={`/${locale}/login`}
            className="btn-ghost text-sm py-1.5 px-3"
          >
            <LogIn className="h-4 w-4 mr-1" />
            {t('loginCta')}
          </Link>
          <Link
            href={`/${locale}/register`}
            className="btn-primary text-sm py-1.5 px-3"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            {t('signupCta')}
          </Link>
        </div>
      </div>
    </header>
  );
}
