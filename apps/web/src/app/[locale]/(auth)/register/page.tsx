// ==============================================================================
// PocketJury — Register Page
// ==============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Scale, Mail, Lock, Eye, EyeOff, AlertCircle, Check, User } from 'lucide-react';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'At least one uppercase letter')
      .regex(/[a-z]/, 'At least one lowercase letter')
      .regex(/[0-9]/, 'At least one digit')
      .regex(/[^A-Za-z0-9]/, 'At least one special character'),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const verifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type RegisterForm = z.infer<typeof registerSchema>;
type VerifyForm = z.infer<typeof verifySchema>;

const pwdChecks = [
  { key: 'length', label: '8+ characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit', label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const registerFn = useAuthStore((s) => s.register);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    // Only show session modal if already authenticated AND not in the middle of registration
    if (isAuthenticated && user && !verificationRequired) {
      setShowSessionModal(true);
    }
  }, [isAuthenticated, user, verificationRequired]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptTerms: false as unknown as true },
  });

  const {
    register: registerVerify,
    handleSubmit: handleVerifySubmit,
    formState: { errors: verifyErrors },
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
  });

  const password = watch('password', '');

  const onSubmit = async (data: RegisterForm) => {
    try {
      setUserEmail(data.email);
      await registerFn(data.email, data.password, data.fullName);
      // Always show verification — the backend sends a code on register
      setVerificationRequired(true);
      setResendTimer(30);
      toast.info(t('verificationSent') || 'Verification code sent to your email');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('registerError');
      toast.error(message);
    }
  };

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const handleResendVerification = async () => {
    try {
      // Re-register triggers a new verification code from the backend
      await registerFn(userEmail, '', '', '');
    } catch {
      // Expected — re-register may fail but backend still sends a new code
    }
    setResendTimer(30);
    toast.info(t('verificationSent') || 'Verification code re-sent');
  };

  const onVerifySubmit = async (data: VerifyForm) => {
    try {
      await verifyEmail(userEmail, data.code);
      toast.success(t('registerSuccess'));
      router.push('/onboarding');
    } catch {
      toast.error(t('mfaError') || 'Invalid verification code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/20 dark:via-[var(--color-bg)] dark:to-green-950/10">
      {/* Session awareness modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-8 max-w-sm w-full mx-4 text-center space-y-4"
          >
            <Scale className="h-8 w-8 text-primary-600 dark:text-blue-400 mx-auto" />
            <h2 className="text-lg font-bold text-heading">{t('continueAs')}</h2>
            <p className="text-sm text-muted">{user?.email || ''}</p>
            <div className="flex flex-col gap-2">
              <button className="btn-primary w-full py-2.5" onClick={() => router.push('/chat')}>
                {t('continueAsButton')}
              </button>
              <button className="btn-outline w-full py-2.5" onClick={async () => { await logout(); setShowSessionModal(false); }}>
                {t('useDifferentAccount')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-heading">PocketJury</span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-heading text-center">
            {t('registerTitle')}
          </h1>
          <p className="mt-2 text-sm text-body text-center">
            {t('registerSubtitle')}
          </p>

          {verificationRequired ? (
            <form onSubmit={handleVerifySubmit(onVerifySubmit)} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-heading mb-1">
                  {t('verificationCode') || '6-Digit Verification Code'}
                </label>
                <input
                  id="code"
                  type="text"
                  maxLength={6}
                  className="input text-center text-2xl tracking-[0.5em]"
                  placeholder="000000"
                  {...registerVerify('code')}
                />
                {verifyErrors.code && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {verifyErrors.code.message}
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
                    {t('verifying') || 'Verifying...'}
                  </span>
                ) : (
                  t('verifyButton') || 'Verify Email'
                )}
              </button>
              <button
                type="button"
                disabled={resendTimer > 0 || isLoading}
                onClick={handleResendVerification}
                className={`text-sm w-full text-center mt-2 transition-colors ${
                  resendTimer > 0
                    ? 'text-muted cursor-not-allowed'
                    : 'text-primary-600 dark:text-blue-400 hover:underline cursor-pointer'
                }`}
              >
                {resendTimer > 0
                  ? t('resendCodeTimer', { seconds: resendTimer })
                  : t('resendCode')}
              </button>
            </form>
          ) : (
            <>
              {/* Google OAuth */}
              <div className="mt-6">
                <GoogleSignInButton redirectTo="/onboarding" mode="signup" />
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: 'var(--color-border)' }} />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted">{t('orContinueWith')}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-heading mb-1">
                {t('fullName')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  className="input pl-10"
                  placeholder={t('fullNamePlaceholder')}
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.fullName.message}
                </p>
              )}
            </div>


            {/* Email */}
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

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-heading mb-1">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

              {/* Password strength */}
              {password.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {pwdChecks.map((c) => (
                    <div
                      key={c.key}
                      className={`flex items-center gap-1 text-xs ${c.test(password) ? 'text-green-600 dark:text-green-400' : 'text-muted'
                        }`}
                    >
                      <Check className="h-3 w-3" />
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-heading mb-1">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="input pl-10"
                  placeholder={t('confirmPasswordPlaceholder')}
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

            {/* Terms */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-primary-600 focus:ring-primary-500"
                {...register('acceptTerms')}
              />
              <span className="text-xs text-body">
                {t('acceptTerms')}{' '}
                <Link href="/terms" target="_blank" className="text-primary-600 dark:text-blue-400 underline">
                  {t('termsLink')}
                </Link>
                ,{' '}
                <Link href="/privacy" target="_blank" className="text-primary-600 dark:text-blue-400 underline">
                  {t('privacyLink')}
                </Link>
                {' '}&amp;{' '}
                <Link href="/legal-sources" target="_blank" className="text-primary-600 dark:text-blue-400 underline">
                  {t('legalSourcesLink')}
                </Link>
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.acceptTerms.message}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('registering')}
                </span>
              ) : (
                t('registerButton')
              )}
            </button>
          </form>
            <p className="mt-6 text-center text-sm text-body">
              {t('haveAccount')}{' '}
              <Link href="/login" className="font-medium text-primary-600 dark:text-blue-400 hover:opacity-80 transition-opacity">
                {t('loginLink')}
              </Link>
            </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
