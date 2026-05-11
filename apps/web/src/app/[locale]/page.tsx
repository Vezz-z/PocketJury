// ==============================================================================
// PocketJury — Landing Page
// ==============================================================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Scale,
  Shield,
  Globe,
  MessageCircle,
  BookOpen,
  Phone,
  ChevronRight,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Detect current locale from pathname
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

  const features = [
    {
      icon: MessageCircle,
      title: t('app.features.aiChat'),
      desc: t('app.features.aiChatDesc'),
    },
    {
      icon: BookOpen,
      title: t('app.features.legalKB'),
      desc: t('app.features.legalKBDesc'),
    },
    {
      icon: Globe,
      title: t('app.features.multilingual'),
      desc: t('app.features.multilingualDesc'),
    },
    {
      icon: Shield,
      title: t('app.features.privacy'),
      desc: t('app.features.privacyDesc'),
    },
    {
      icon: Scale,
      title: t('app.features.ipcBns'),
      desc: t('app.features.ipcBnsDesc'),
    },
    {
      icon: Phone,
      title: t('app.features.helplines'),
      desc: t('app.features.helplinesDesc'),
    },
  ];

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href={`/${currentLocale}`} className="flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary-600 dark:text-blue-400" />
            <span className="text-xl font-bold text-heading">PocketJury</span>
          </Link>
          <nav className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 text-sm text-body hover:text-heading transition-colors px-2 py-1 rounded-md hover:bg-elevated"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{LANGUAGES.find((l) => l.code === currentLocale)?.label || 'English'}</span>
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
            <ThemeToggle />
            <div className="hidden min-[740px]:flex items-center gap-3">
              <Link href={`/${currentLocale}/login`} className="btn-ghost text-sm">
                {t('nav.login')}
              </Link>
              <Link href="mailto:pocketjuryai@gmail.com" className="btn-ghost text-sm">
                {t('nav.contactUs')}
              </Link>
              <Link href={`/${currentLocale}/register`} className="btn-primary text-sm">
                {t('nav.getStarted')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <button
              className="min-[740px]:hidden p-2 rounded-md hover:bg-elevated transition-colors text-body"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>
        </div>
        {mobileMenuOpen && (
          <div className="min-[740px]:hidden border-t bg-card/95 backdrop-blur-md px-4 py-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)' }}>
            <Link href={`/${currentLocale}/login`} className="btn-ghost text-sm">
              {t('nav.login')}
            </Link>
            <Link href="mailto:pocketjuryai@gmail.com" className="btn-ghost text-sm">
              {t('nav.contactUs')}
            </Link>
            <Link href={`/${currentLocale}/register`} className="btn-primary text-sm">
              {t('nav.getStarted')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/30 dark:via-[var(--color-bg)] dark:to-green-950/20" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-extrabold tracking-tight text-heading sm:text-5xl lg:text-6xl">
              {t('app.hero.title')}
            </h1>
            <p className="mt-6 text-lg text-body leading-relaxed sm:text-xl">
              {t('app.hero.subtitle')}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={`/${currentLocale}/register`} className="btn-primary text-base px-8 py-3">
                {t('app.hero.cta')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link href={`/${currentLocale}/login`} className="btn-outline text-base px-8 py-3">
                {t('nav.login')}
              </Link>
            </div>

            {/* Disclaimer banner */}
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="disclaimer-banner text-sm">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span>{t('app.hero.disclaimer')}</span>
              </div>
              <Link href="mailto:pocketjuryai@gmail.com" className="btn-outline text-sm px-6 py-2">
                {t('nav.contactUs')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-heading">
              {t('app.features.heading')}
            </h2>
            <p className="mt-4 text-body max-w-2xl mx-auto">
              {t('app.features.subheading')}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                className="card p-6 hover:shadow-lg transition-shadow"
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                  <feature.icon className="h-6 w-6 text-primary-600 dark:text-blue-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-heading">
                  {feature.title}
                </h3>
                <p className="mt-2 text-body text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-page">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-heading mb-16">
            {t('app.howItWorks.heading')}
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((step) => (
              <motion.div
                key={step}
                className="text-center"
                custom={step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <div className="mx-auto h-14 w-14 rounded-full bg-primary-600 dark:bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  {step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-heading">
                  {t(`app.howItWorks.step${step}Title`)}
                </h3>
                <p className="mt-2 text-body text-sm">
                  {t(`app.howItWorks.step${step}Desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary-600 dark:text-blue-400" />
              <span className="font-bold text-heading">PocketJury</span>
            </div>
            <p className="text-xs text-muted">
              {t('app.footer.disclaimer')}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <Link href={`/${currentLocale}/terms`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-primary-600 dark:hover:text-blue-400 transition-colors">
                {t('auth.termsLink')}
              </Link>
              <Link href={`/${currentLocale}/privacy`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-primary-600 dark:hover:text-blue-400 transition-colors">
                {t('auth.privacyLink')}
              </Link>
              <Link href={`/${currentLocale}/legal-sources`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-primary-600 dark:hover:text-blue-400 transition-colors">
                {t('auth.legalSourcesLink')}
              </Link>
              <Link href="mailto:pocketjuryai@gmail.com" className="text-muted hover:text-primary-600 dark:hover:text-blue-400 transition-colors text-right">
                {t('nav.contactUs')}
              </Link>
            </div>
            <p className="text-xs text-muted">
              © {new Date().getFullYear()} PocketJury. {t('app.footer.rights')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
