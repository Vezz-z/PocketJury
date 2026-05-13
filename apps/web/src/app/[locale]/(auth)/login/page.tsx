// ==============================================================================
// PocketJury — Login Page (Password + Mandatory OTP Verification)
// ==============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Mail, Lock, Eye, EyeOff, AlertCircle, KeyRound, ArrowLeft, Pencil } from 'lucide-react';
import { useAuthStore } from '@/store';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';

// -- Schemas --
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const mfaSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type LoginForm = z.infer<typeof loginSchema>;
type MfaForm = z.infer<typeof mfaSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const verifyMfa = useAuthStore((s) => s.verifyMfa);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [emailVerificationNeeded, setEmailVerificationNeeded] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('pocketjury-remember') === 'true';
    setRememberMe(saved);
  }, []);

  // Session awareness: detect if user is already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      setShowSessionModal(true);
    }
  }, [isAuthenticated, user]);

  // -- Forms --
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerMfa,
    handleSubmit: handleMfaSubmit,
    formState: { errors: mfaErrors },
  } = useForm<MfaForm>({
    resolver: zodResolver(mfaSchema),
  });

  // -- Handlers --
  const onRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
    localStorage.setItem('pocketjury-remember', String(e.target.checked));
  };

  const onPasswordLogin = async (data: LoginForm) => {
    try {
      setUserEmail(data.email);
      const res = await login(data.email, data.password);
      if (res?.mfaRequired) {
        setMfaRequired(true);
        toast.info(t('mfaSent'));
        return;
      }
      // If somehow no MFA required (shouldn't happen now), redirect
      toast.success(t('loginSuccess'));
      router.push('/chat');
    } catch (err: unknown) {
      // Handle "Email not verified" — backend sends 403 and re-sends a verification code
      const apiErr = err as { status?: number; data?: { error?: string } };
      if (apiErr?.status === 403 && apiErr?.data?.error?.includes('not verified')) {
        setEmailVerificationNeeded(true);
        setMfaRequired(true);
        toast.info(apiErr.data.error);
        return;
      }
      toast.error(t('loginError'));
    }
  };

  // Start 30-second resend cooldown when MFA step is shown
  useEffect(() => {
    if (mfaRequired) {
      setResendTimer(30);
    }
  }, [mfaRequired]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const handleResendCode = useCallback(async () => {
    try {
      // Re-trigger login to resend the OTP/verification code
      await login(userEmail, '');
    } catch {
      // Backend will re-send the code even if the password is wrong for unverified,
      // or we can just toast info
    }
    setResendTimer(30);
    toast.info(t('mfaSent'));
  }, [userEmail, login, t]);

  const onMfaSubmit = async (data: MfaForm) => {
    try {
      if (emailVerificationNeeded) {
        // Unverified email — use verify-email endpoint (code stored in DB)
        await verifyEmail(userEmail, data.code);
        setEmailVerificationNeeded(false);
      } else {
        // Normal MFA — use verify-mfa endpoint (OTP stored in Redis)
        await verifyMfa(userEmail, data.code);
      }
      toast.success(t('loginSuccess'));
      router.push('/chat');
    } catch {
      toast.error(t('mfaError'));
    }
  };

  // Handle editing email in OTP step
  const onEditEmail = async () => {
    if (!editedEmail || editedEmail === userEmail) {
      setEditingEmail(false);
      return;
    }
    try {
      // Cancel old OTP
      await authApi.cancelOtp(userEmail);
      // Re-login with new email to trigger new OTP
      setUserEmail(editedEmail);
      setEditingEmail(false);
      toast.info(t('otpCancelled'));
      // Go back to login step so user re-enters password with new email
      setMfaRequired(false);
    } catch {
      toast.error(t('loginError'));
    }
  };

  // Animation variant
  const stepContent = {
    hidden: { opacity: 0, x: 12 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/20 dark:via-[var(--color-bg)] dark:to-green-950/10">
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
              <button
                className="btn-primary w-full py-2.5"
                onClick={() => router.push('/chat')}
              >
                {t('continueAsButton')}
              </button>
              <button
                className="btn-outline w-full py-2.5"
                onClick={async () => {
                  await logout();
                  setShowSessionModal(false);
                }}
              >
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

          <AnimatePresence mode="wait">
            {/* ===== STEP 2: OTP Verification ===== */}
            {mfaRequired ? (
              <motion.div key="mfa" variants={stepContent} initial="hidden" animate="visible" exit="exit">
                <div className="text-center mt-6 mb-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 dark:bg-blue-900/30 mb-3">
                    <KeyRound className="h-7 w-7 text-primary-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm text-body">
                    {t('otpSentMessage')}
                  </p>
                  {editingEmail ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        className="input text-sm flex-1"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={onEditEmail}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        {t('resendCode')}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <p className="text-xs text-muted">{userEmail}</p>
                      <button
                        type="button"
                        onClick={() => { setEditedEmail(userEmail); setEditingEmail(true); }}
                        className="text-primary-600 hover:text-primary-700 dark:text-blue-400"
                        title={t('editEmail')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleMfaSubmit(onMfaSubmit)} className="space-y-4">
                  <div>
                    <label htmlFor="mfa-code" className="block text-sm font-medium text-heading mb-1">
                      {t('verificationCode')}
                    </label>
                    <input
                      id="mfa-code"
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input text-center text-2xl tracking-[0.5em]"
                      placeholder="000000"
                      autoFocus
                      {...registerMfa('code')}
                    />
                    {mfaErrors.code && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {mfaErrors.code.message}
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('verifying')}
                      </span>
                    ) : (
                      t('verifyButton')
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={resendTimer > 0 || isLoading}
                    onClick={handleResendCode}
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
                  <button
                    type="button"
                    onClick={() => setMfaRequired(false)}
                    className="text-sm text-primary-600 dark:text-blue-400 hover:underline w-full text-center mt-2 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t('backToLogin')}
                  </button>
                </form>
              </motion.div>
            ) : (
              /* ===== STEP 1: Password Login ===== */
              <motion.div key="login" variants={stepContent} initial="hidden" animate="visible" exit="exit">
                {/* Google OAuth */}
                <div className="mt-6">
                  <GoogleSignInButton redirectTo="/chat" mode="signin" />
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" style={{ borderColor: 'var(--color-border)' }} />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted">{t('orContinueWith')}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onPasswordLogin)} className="space-y-4">
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={onRememberChange}
                        className="h-4 w-4 rounded border-[var(--color-border)] text-primary-600 focus:ring-primary-600"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-body">
                        {t('rememberMe')}
                      </label>
                    </div>
                    <Link href="/forgot-password" className="text-sm text-primary-600 dark:text-blue-400 hover:underline">
                      {t('forgotPassword')}
                    </Link>
                  </div>

                  <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
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
              </motion.div>
            )}
          </AnimatePresence>
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
            <a href="mailto:pocketjuryai@gmail.com" className="hover:text-primary-600 dark:hover:text-blue-400 underline transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
