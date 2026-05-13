// ==============================================================================
// PocketJury — Guest Sidebar (for unauthenticated "Try Now" mode)
// ==============================================================================
'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Scale, LogIn, UserPlus, X, ExternalLink, Phone } from 'lucide-react';

interface GuestSidebarProps {
  open: boolean;
  desktopOpen: boolean;
  onClose: () => void;
}

export function GuestSidebar({ open, desktopOpen, onClose }: GuestSidebarProps) {
  const t = useTranslations('guest');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out
        md:static md:z-auto
        ${open ? 'translate-x-0' : '-translate-x-full'}
        ${desktopOpen ? 'md:translate-x-0' : 'md:-translate-x-full md:w-0 md:overflow-hidden'}
        flex flex-col bg-card border-r
      `}
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between h-14 px-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary-600 dark:text-blue-400" />
          <span className="text-lg font-bold text-heading">PocketJury</span>
        </Link>
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md hover:bg-elevated transition-colors text-body"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Preview Badge */}
      <div className="mx-4 mt-4">
        <div
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold"
          style={{
            background: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--color-primary)' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--color-primary)' }} />
          </span>
          {t('previewBadge')}
        </div>
      </div>

      {/* CTA Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4">
          {/* Illustration-like icon */}
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-primary-light)' }}
          >
            <Scale className="h-8 w-8 text-primary-600 dark:text-blue-400" />
          </div>

          <h3 className="text-base font-semibold text-heading">
            {t('sidebarLoginPrompt')}
          </h3>
          <p className="text-sm text-body leading-relaxed">
            {t('sidebarDesc')}
          </p>

          <div className="flex flex-col gap-3 w-full pt-2">
            <Link
              href={`/${locale}/register`}
              className="btn-primary w-full justify-center text-sm py-2.5"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {t('signupCta')}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="btn-outline w-full justify-center text-sm py-2.5"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {t('loginCta')}
            </Link>
          </div>
        </div>
      </div>

      {/* Free Legal Aid (DLSA) nav link */}
      <div className="px-4 pb-2">
        <Link
          href={`/${locale}/try/dlsa`}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-body hover:bg-elevated transition-colors"
        >
          <Phone className="h-4 w-4 text-primary-600 dark:text-blue-400" />
          {tNav('dlsa')}
        </Link>
      </div>

      {/* Footer links */}
      <div
        className="px-4 py-3 border-t flex-shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-body">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-heading transition-colors inline-flex items-center gap-0.5">
            Terms <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-heading transition-colors inline-flex items-center gap-0.5">
            Privacy <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href="/legal-sources" target="_blank" rel="noopener noreferrer" className="hover:text-heading transition-colors inline-flex items-center gap-0.5">
            Sources <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
