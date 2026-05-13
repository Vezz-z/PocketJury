// ==============================================================================
// PocketJury — Reset Password Page
// ==============================================================================
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Scale, Lock, Eye, EyeOff, AlertCircle, Check, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'At least one uppercase letter')
      .regex(/[a-z]/, 'At least one lowercase letter')
      .regex(/[0-9]/, 'At least one digit')
      .regex(/[^A-Za-z0-9]/, 'At least one special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof schema>;

const pwdChecks = [
  { key: 'length', label: '8+ characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit', label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
  });

  const newPassword = watch('newPassword', '');

  const onSubmit = async (data: ResetForm) => {
    if (!token) {
      toast.error(t('resetPasswordError'));
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: data.newPassword });
      setSuccess(true);
      toast.success(t('resetPasswordSuccess'));
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      toast.error(t('resetPasswordError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/20 dark:via-[var(--color-bg)] dark:to-green-950/10">
        <div className="card p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-heading mb-2">{t('resetPasswordError')}</h2>
          <Link href="/login" className="btn-primary inline-block px-6 py-2.5 mt-4">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

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
            {t('resetPassword')}
          </h1>

          {success ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-body">{t('resetPasswordSuccess')}</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-heading mb-1">
                  {t('newPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    autoFocus
                    {...register('newPassword')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {pwdChecks.map((c) => (
                      <div
                        key={c.key}
                        className={`flex items-center gap-1 text-xs ${c.test(newPassword) ? 'text-green-600 dark:text-green-400' : 'text-muted'}`}
                      >
                        <Check className="h-3 w-3" />
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-heading mb-1">
                  {t('confirmNewPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10"
                    {...register('confirmPassword')}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('resetPassword')}
                  </span>
                ) : (
                  t('resetPassword')
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
