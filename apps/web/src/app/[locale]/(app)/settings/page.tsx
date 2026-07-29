// ==============================================================================
// PocketJury — Settings Page
// ==============================================================================
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import {
  Globe,
  User,
  Shield,
  Trash2,
  Download,
  Moon,
  Sun,
  Monitor,
  Pencil,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  GraduationCap,
  Scale,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditProfileModal } from '@/components/profile/EditProfileModal';

const LANGUAGE_CODES = ['en', 'hi', 'ta', 'bn'] as const;
const LANGUAGE_NATIVE: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  bn: 'বাংলা',
};

const PERSONA_CODES = ['GENERAL', 'STUDENT', 'RURAL_USER', 'SENIOR_CITIZEN', 'PROFESSIONAL'] as const;

const THEME_OPTIONS = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tOnboard = useTranslations('onboarding');
  const tLocations = useTranslations('locations');
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const updateLanguage = useAuthStore((s) => s.updateLanguage);
  const updatePersona = useAuthStore((s) => s.updatePersona);
  const logout = useAuthStore((s) => s.logout);
  const changePassword = useAuthStore((s) => s.changePassword);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleLanguageChange = async (lang: string) => {
    try {
      await updateLanguage(lang);
      // Replace the locale segment in the current URL path
      const segments = pathname.split('/');
      // segments[0] is '', segments[1] is the locale
      segments[1] = lang;
      const newPath = segments.join('/');
      router.push(newPath);
      router.refresh();
    } catch {
      toast.error(t('languageError'));
    }
  };

  const handlePersonaChange = async (persona: string) => {
    try {
      await updatePersona(persona);
      toast.success(t('personaUpdated'));
    } catch {
      toast.error(tCommon('failedToUpdate'));
    }
  };

  const handleExport = async () => {
    try {
      const { userApi } = await import('@/lib/api');
      const data = await userApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pocketjury-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('dataExported'));
    } catch {
      toast.error(t('exportError'));
    }
  };

  const handleDeleteAccountClick = () => setDeleteAccountConfirmOpen(true);

  const confirmDeleteAccount = async () => {
    setDeleteAccountConfirmOpen(false);
    try {
      const { userApi } = await import('@/lib/api');
      await userApi.deleteAccount();
      await logout();
      router.push('/en');
      toast.success(t('accountDeleted'));
    } catch {
      toast.error(t('deleteError'));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8 pb-32" style={{ marginTop: '0', marginBottom: '0' }}>
      <h1 className="text-2xl font-bold text-heading">{t('title')}</h1>

      {/* Profile Details */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-heading">{t('profileDetails')}</h2>
          </div>
          <button
            className="p-2 rounded-md hover:bg-elevated transition-colors text-primary-600 dark:text-blue-400"
            onClick={() => setIsEditProfileOpen(true)}
            aria-label={t('editProfile')}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <span className="block text-xs text-muted mb-1 flex items-center gap-1"><User className="h-3 w-3" /> {tAuth('fullName')}</span>
            <span className="text-sm font-medium text-heading">{user?.profile?.fullName || '-'}</span>
          </div>
          <div>
            <span className="block text-xs text-muted mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> {tAuth('email')}</span>
            <span className="text-sm font-medium text-heading">{user?.email || '-'}</span>
          </div>
          <div>
            <span className="block text-xs text-muted mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> {tAuth('dateOfBirth')}</span>
            <span className="text-sm font-medium text-heading">
              {user?.profile?.dateOfBirth && !isNaN(new Date(user.profile.dateOfBirth).getTime()) ? new Date(user.profile.dateOfBirth).toLocaleDateString() : '-'}
            </span>
          </div>
          <div>
            <span className="block text-xs text-muted mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {t('location')}</span>
            <span className="text-sm font-medium text-heading">
              {user?.profile?.locationDistrict || user?.profile?.locationState ? (
                `${user?.profile?.locationDistrict ? (tLocations.has(`districts.${user.profile.locationDistrict.replace(/\s+/g, '_')}`) ? tLocations(`districts.${user.profile.locationDistrict.replace(/\s+/g, '_')}`) : user.profile.locationDistrict) : ''}${user?.profile?.locationDistrict && user?.profile?.locationState ? ', ' : ''}${user?.profile?.locationState ? (tLocations.has(`states.${user.profile.locationState.replace(/\s+/g, '_')}`) ? tLocations(`states.${user.profile.locationState.replace(/\s+/g, '_')}`) : user.profile.locationState) : ''}`
              ) : '-'}
            </span>
          </div>
          <div>
            <span className="block text-xs text-muted mb-1 flex items-center gap-1"><Briefcase className="h-3 w-3" /> {tOnboard('professionType')}</span>
            <span className="text-sm font-medium text-heading">
              {user?.profile?.professionType ? tOnboard(`profession${user.profile.professionType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')}`) : '-'}
            </span>
          </div>
          {user?.profile?.professionType === 'STUDENT' && (
            <div>
              <span className="block text-xs text-muted mb-1 flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {tOnboard('fieldOfStudy')}</span>
              <span className="text-sm font-medium text-heading">{user?.profile?.fieldOfStudy || '-'}</span>
            </div>
          )}
          {user?.profile?.professionType === 'EMPLOYED' && (
            <div>
              <span className="block text-xs text-muted mb-1 flex items-center gap-1"><Briefcase className="h-3 w-3" /> {tOnboard('currentRole')}</span>
              <span className="text-sm font-medium text-heading">{user?.profile?.currentProfession || '-'}</span>
            </div>
          )}
          {user?.profile?.professionType === 'SELF_EMPLOYED' && (
            <div>
              <span className="block text-xs text-muted mb-1 flex items-center gap-1"><Briefcase className="h-3 w-3" /> {tOnboard('businessSector')}</span>
              <span className="text-sm font-medium text-heading">{user?.profile?.currentProfession || '-'}</span>
            </div>
          )}
          {user?.profile?.professionType === 'UNEMPLOYED' && (
            <div>
              <span className="block text-xs text-muted mb-1 flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {tOnboard('highestQualification')}</span>
              <span className="text-sm font-medium text-heading">{user?.profile?.currentProfession || '-'}</span>
            </div>
          )}
        </div>
      </section>

      {/* Language */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-heading">{t('language')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGE_CODES.map((code) => (
            <button
              key={code}
              className={`card p-3 text-left transition-colors ${user?.preferredLanguage === code
                ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-blue-900/30'
                : 'hover:bg-elevated'
                }`}
              onClick={() => handleLanguageChange(code)}
            >
              <span className="font-medium text-heading">{LANGUAGE_NATIVE[code]}</span>
              <span className="block text-xs text-muted mt-0.5">{code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Persona */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-heading">{t('persona')}</h2>
        </div>
        <div className="space-y-3">
          {PERSONA_CODES.map((code) => (
            <button
              key={code}
              className={`w-full card p-4 text-left transition-colors ${user?.personaMode === code
                ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-blue-900/30'
                : 'hover:bg-elevated'
                }`}
              onClick={() => handlePersonaChange(code)}
            >
              <span className="font-medium text-heading">{t(`personaOptions.${code}`)}</span>
              <span className="block text-xs text-muted mt-0.5">{t(`personaDesc.${code}`)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-heading">{t('appearance')}</h2>
        </div>
        <div className="flex gap-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`flex-1 card p-3 flex flex-col items-center gap-2 transition-colors ${theme === opt.key ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-blue-900/30' : 'hover:bg-elevated'
                }`}
              onClick={() => setTheme(opt.key)}
            >
              <opt.icon className="h-5 w-5 text-body" />
              <span className="text-sm text-heading">{t(`themeOptions.${opt.key}`)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Security — Change Password */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-heading">{tAuth('changePassword')}</h2>
        </div>

        {user?.authProvider === 'GOOGLE' && !user?.profile ? (
          <p className="text-sm text-muted">{tAuth('passwordManagedByGoogle')}</p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder={tAuth('currentPassword')}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="input pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading"
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder={tAuth('newPassword')}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="input"
            />
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder={tAuth('confirmNewPassword')}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="input"
            />
            {newPwd && confirmPwd && newPwd !== confirmPwd && (
              <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match</p>
            )}
            <button
              className="btn-primary w-full py-2.5"
              disabled={isLoading || !currentPwd || !newPwd || newPwd !== confirmPwd || newPwd.length < 8}
              onClick={async () => {
                try {
                  await changePassword(currentPwd, newPwd);
                  toast.success(tAuth('passwordChanged'));
                  setCurrentPwd('');
                  setNewPwd('');
                  setConfirmPwd('');
                } catch {
                  toast.error(tAuth('loginError'));
                }
              }}
            >
              {tAuth('changePassword')}
            </button>
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 dark:text-blue-400 hover:underline block text-center"
            >
              {tAuth('forgotCurrentPassword')} {tAuth('resetItHere')}
            </Link>
          </div>
        )}
      </section>

      {/* Privacy & Data */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-heading">{t('privacy')}</h2>
        </div>

        <div className="space-y-3">
          <button
            className="btn-outline w-full justify-start"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('exportData')}
          </button>
          <button
            className="w-full flex items-center justify-start px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
            onClick={handleDeleteAccountClick}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('deleteAccount')}
          </button>
        </div>
      </section>

      {/* Legal & Policies */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-heading">{t('termsAndPolicies')}</h2>
        </div>
        <div className="space-y-3">
          <Link
            href={`/${user?.preferredLanguage || 'en'}/terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-start px-4 py-2.5 rounded-lg text-body hover:bg-elevated transition-colors text-sm font-medium"
          >
            {t('termsOfService')}
          </Link>
          <Link
            href={`/${user?.preferredLanguage || 'en'}/privacy`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-start px-4 py-2.5 rounded-lg text-body hover:bg-elevated transition-colors text-sm font-medium"
          >
            {t('privacyPolicy')}
          </Link>
          <Link
            href={`/${user?.preferredLanguage || 'en'}/legal-sources`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-start px-4 py-2.5 rounded-lg text-body hover:bg-elevated transition-colors text-sm font-medium"
          >
            {t('legalSources')}
          </Link>
          <a
            href="mailto:reply.to.pocketjuryai@gmail.com"
            className="w-full flex items-center justify-start px-4 py-2.5 rounded-lg text-body hover:bg-elevated transition-colors text-sm font-medium"
          >
            <Mail className="h-4 w-4 mr-2" />
            {t('contactUs')}
          </a>
        </div>
      </section>

      <ConfirmDialog
        isOpen={deleteAccountConfirmOpen}
        onClose={() => setDeleteAccountConfirmOpen(false)}
        onConfirm={confirmDeleteAccount}
        title={tCommon('deleteAccountTitle')}
        description={tCommon('deleteAccountDesc')}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        variant="danger"
        icon="trash"
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
}
