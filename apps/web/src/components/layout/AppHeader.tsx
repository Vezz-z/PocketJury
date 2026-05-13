// ==============================================================================
// PocketJury — AppHeader Component
// ==============================================================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useUIStore, useChatStore } from '@/store';
import {
  Menu,
  Scale,
  LogOut,
  Settings,
  Globe,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
];

export function AppHeader() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateLanguage = useAuthStore((s) => s.updateLanguage);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeChat = useChatStore((s) => s.activeChat);

  const [langOpen, setLangOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogoutClick = () => setLogoutConfirmOpen(true);

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false);
    await logout();
    router.push('/en/login');
  };

  const handleLanguageChange = async (code: string) => {
    setLangOpen(false);
    try {
      await updateLanguage(code);
      // Replace locale segment in current path
      const segments = pathname.split('/');
      segments[1] = code;
      router.push(segments.join('/'));
      router.refresh();
    } catch {
      toast.error('Failed to update language');
    }
  };

  return (
    <>
      <header
        className="h-14 border-b bg-card/80 backdrop-blur-md flex items-center justify-between px-4 z-20"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-3" style={{ marginLeft: '3rem' }}>
          {/* Mobile sidebar toggle */}
          <button
            className="p-1.5 rounded-md text-body hover:bg-elevated md:hidden transition-colors"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/chat" className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary-600 dark:text-blue-400" />
            <span className="font-bold text-heading hidden sm:inline">PocketJury</span>
          </Link>
          {activeChat && (
            <span className="text-sm text-muted truncate max-w-[200px] hidden sm:inline">
              / {activeChat.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher Dropdown */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="badge badge-primary text-xs cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <Globe className="h-3 w-3" />
              {user?.preferredLanguage?.toUpperCase() || 'EN'}
              <ChevronDown className="h-3 w-3" />
            </button>

            {langOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg border overflow-hidden z-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-elevated ${user?.preferredLanguage === lang.code ? 'font-semibold text-heading' : 'text-body'
                      }`}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {useAuthStore((s) => s.isAuthenticated) ? (
            <>
              {/* Settings */}
              <Link
                href="/settings"
                className="p-1.5 rounded-md text-body hover:bg-elevated transition-colors"
                aria-label={t('settings')}
                title={`${t('settings')} (Ctrl+Shift+S)`}
              >
                <Settings className="h-4 w-4" />
              </Link>

              <button
                className="p-1.5 rounded-md text-body hover:bg-elevated transition-colors"
                onClick={handleLogoutClick}
                aria-label={t('logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href={`/${pathname.split('/')[1] || 'en'}/login`} className="btn-ghost text-xs px-2 py-1">
                {t('login')}
              </Link>
              <Link href={`/${pathname.split('/')[1] || 'en'}/register`} className="btn-primary text-xs px-3 py-1">
                {t('getStarted')}
              </Link>
            </>
          )}
        </div>
      </header>

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
        title={tCommon('logoutTitle')}
        description={tCommon('logoutDesc')}
        confirmText={tCommon('logoutTitle')}
        cancelText={tCommon('cancel')}
        variant="warning"
        icon="logout"
      />
    </>
  );
}
