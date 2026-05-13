// ==============================================================================
// PocketJury — Forgot Password Page
// ==============================================================================
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Scale, Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
      toast.success(t('resetLinkSent'));
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  const stepContent = {
    hidden: { opacity: 0, x: 12 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/20 dark:via-[var(--color-bg)] dark:to-green-950/10">
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
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-heading">PocketJury</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-heading text-center">
            {t('forgotPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-body text-center">
            {t('forgotPasswordSubtitle')}
          </p>

          {sent ? (
            <motion.div variants={stepContent} initial="hidden" animate="visible" className="mt-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-body">{t('resetLinkSent')}</p>
              <Link
                href="/login"
                className="text-sm text-primary-600 hover:underline flex items-center justify-center gap-1 mt-4"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('backToLogin')}
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
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
                    autoFocus
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
              <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('sendResetLink')}
                  </span>
                ) : (
                  t('sendResetLink')
                )}
              </button>
              <Link
                href="/login"
                className="text-sm text-primary-600 hover:underline w-full text-center mt-2 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('backToLogin')}
              </Link>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
