// ==============================================================================
// PocketJury — Login Page
// ==============================================================================
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Scale, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success(t('loginSuccess'));
      router.push('/chat');
    } catch {
      toast.error(t('loginError'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/20 dark:via-[var(--color-bg)] dark:to-green-950/10">
      {/* Top right controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-heading">PocketJury</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-heading text-center">
            {t('loginTitle')}
          </h1>
          <p className="mt-2 text-sm text-body text-center">
            {t('loginSubtitle')}
          </p>

          {/* Google OAuth */}
          <button
            type="button"
            className="btn-outline w-full mt-6 py-2.5"
            onClick={() => {
              toast.info('Google Sign-In coming soon');
            }}
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t('continueWithGoogle')}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--color-border)' }} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted">{t('orContinueWith')}</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-heading mb-1">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input pl-10"
                  placeholder={t('emailPlaceholder')}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-heading mb-1">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pl-10 pr-10"
                  placeholder={t('passwordPlaceholder')}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('loggingIn')}
                </span>
              ) : (
                t('loginButton')
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-body">
            {t('noAccount')}{' '}
            <Link href="/register" className="font-medium text-primary-600 dark:text-blue-400 hover:opacity-80 transition-opacity">
              {t('registerLink')}
            </Link>
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center space-y-2 text-center text-xs text-muted">
          <p>{t('termsNotice')}</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-blue-400 underline transition-colors">
              {t('termsLink')}
            </Link>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-blue-400 underline transition-colors">
              {t('privacyLink')}
            </Link>
            <Link href="/legal-sources" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-blue-400 underline transition-colors">
              {t('legalSourcesLink')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
