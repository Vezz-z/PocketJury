// ==============================================================================
// PocketJury — Onboarding Wizard Page
// ==============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useUIStore } from '@/store';
import { toast } from 'sonner';
import {
  Globe,
  User,
  Briefcase,
  GraduationCap,
  MapPin,
  Shield,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { LocationSelect } from '@/components/ui/LocationSelect';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
];

const PERSONAS = [
  { code: 'GENERAL', icon: '👤', label: 'General', desc: 'Easy language, everyday terms' },
  { code: 'STUDENT', icon: '🎓', label: 'Student', desc: 'Simple, clear explanations for students' },
  { code: 'RURAL_USER', icon: '🌾', label: 'Rural', desc: 'Simple, accessible explanation' },
  { code: 'SENIOR_CITIZEN', icon: '🧓', label: 'Senior Citizen', desc: 'Patient, detailed explanations' },
  { code: 'PROFESSIONAL', icon: '⚖️', label: 'Professional', desc: 'For legal practitioners' },
];

const STEPS = [
  { key: 'language', icon: Globe },
  { key: 'persona', icon: User },
  { key: 'profile', icon: Briefcase },
  { key: 'consent', icon: Shield },
];

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const pathname = usePathname();
  const updateLanguage = useAuthStore((s) => s.updateLanguage);
  const updatePersona = useAuthStore((s) => s.updatePersona);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const setShowConsent = useUIStore((s) => s.setShowConsent);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    language: 'en',
    persona: 'GENERAL',
    fullName: '',
    state: '',
    district: '',
    professionType: '',
    fieldOfStudy: '',
    currentRole: '',
    businessSector: '',
    highestQualification: '',
    consentData: false,
    consentDisclaimer: false,
  });

  // Load state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('onboardingState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setStep(parsed.step);

        // Sync language with current URL dynamically (in case Header modified locale)
        const currentLoc = window.location.pathname.split('/')[1];
        setForm({
          ...parsed.form,
          language: (LANGUAGES.some(l => l.code === currentLoc) ? currentLoc : parsed.form.language)
        });
      } catch (e) {
        console.error('Failed to parse onboarding state', e);
      }
    } else {
      const currentLoc = window.location.pathname.split('/')[1];
      if (currentLoc && LANGUAGES.some(l => l.code === currentLoc)) {
        setForm(prev => ({ ...prev, language: currentLoc }));
      }
    }
  }, []);

  // Save state to sessionStorage whenever it changes so route pushes don't wipe progress
  useEffect(() => {
    sessionStorage.setItem('onboardingState', JSON.stringify({ step, form }));
  }, [step, form]);

  useEffect(() => {
    if (user?.profile?.fullName && !form.fullName) {
      setForm(prev => ({ ...prev, fullName: user.profile!.fullName! }));
    }
  }, [user, form.fullName]);

  const canProceed = () => {
    switch (step) {
      case 0: return !!form.language;
      case 1: return !!form.persona;
      case 2:
        if (!form.fullName || !form.state || !form.district || !form.professionType) return false;
        if (form.professionType === 'STUDENT' && !form.fieldOfStudy) return false;
        if (form.professionType === 'EMPLOYED' && !form.currentRole) return false;
        if (form.professionType === 'SELF_EMPLOYED' && !form.businessSector) return false;
        if (form.professionType === 'UNEMPLOYED' && !form.highestQualification) return false;
        return true;
      case 3: return form.consentDisclaimer;
      default: return false;
    }
  };

  const handleComplete = async () => {
    try {
      await updateLanguage(form.language);
      await updatePersona(form.persona);
      if (form.fullName || form.state || form.professionType) {
        await updateProfile({
          fullName: form.fullName,
          locationState: form.state,
          locationDistrict: form.district,
          professionType: form.professionType,
          fieldOfStudy: form.professionType === 'STUDENT' ? form.fieldOfStudy : undefined,
          currentProfession:
            form.professionType === 'EMPLOYED' ? form.currentRole :
              form.professionType === 'SELF_EMPLOYED' ? form.businessSector :
                form.professionType === 'UNEMPLOYED' ? form.highestQualification : undefined,
        });
      }
      setShowConsent(false);
      sessionStorage.removeItem('onboardingState');
      toast.success(t('complete'));
      router.push('/chat');
    } catch {
      toast.error(t('error'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${i < step
                  ? 'bg-secondary-500 text-white'
                  : i === step
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-secondary-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="card p-8"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 0: Language */}
            {step === 0 && (
              <>
                <h2 className="text-xl font-bold text-heading">{t('languageTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('languageDesc')}</p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      className={`card p-4 text-left transition-colors ${form.language === lang.code
                        ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-blue-900/30'
                        : 'hover:bg-elevated'
                        }`}
                      onClick={() => {
                        setForm({ ...form, language: lang.code });
                        const segments = pathname.split('/');
                        segments[1] = lang.code;
                        router.push(segments.join('/'));
                      }}
                    >
                      <span className="text-lg font-medium text-heading">
                        {lang.native}
                      </span>
                      <span className="block text-xs text-muted mt-1">
                        {lang.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 1: Persona */}
            {step === 1 && (
              <>
                <h2 className="text-xl font-bold text-heading">{t('personaTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('personaDesc')}</p>
                <div className="space-y-3 mt-6">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.code}
                      className={`w-full card p-4 text-left transition-colors ${form.persona === p.code
                        ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-blue-900/30'
                        : 'hover:bg-elevated'
                        }`}
                      onClick={() => setForm({ ...form, persona: p.code })}
                    >
                      <span className="text-lg mr-2">{p.icon}</span>
                      <span className="font-medium text-heading">{t(`personas.${p.code}.label`)}</span>
                      <span className="block text-xs text-muted mt-1 ml-8">
                        {t(`personas.${p.code}.desc`)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Profile (optional) */}
            {step === 2 && (
              <>
                <h2 className="text-xl font-bold text-heading">{t('profileTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('profileDesc')}</p>
                <div className="space-y-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-body mb-1">
                      {t('fullName')}
                    </label>
                    <input
                      className="input"
                      placeholder={t('fullNamePlaceholder')}
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <LocationSelect
                      label={t('state')}
                      placeholder={t('statePlaceholder')}
                      type="state"
                      value={form.state}
                      onChange={(val) => setForm({ ...form, state: val, district: '' })}
                    />
                    <LocationSelect
                      label={t('district')}
                      placeholder={t('districtPlaceholder')}
                      type="district"
                      stateName={form.state}
                      value={form.district}
                      onChange={(val) => setForm({ ...form, district: val })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-body mb-1">
                      {t('professionType')}
                    </label>
                    <select
                      className="input w-full"
                      value={form.professionType}
                      onChange={(e) => setForm({ ...form, professionType: e.target.value })}
                    >
                      <option value="">{t('selectProfession')}</option>
                      <option value="STUDENT">{t('professionStudent')}</option>
                      <option value="EMPLOYED">{t('professionEmployed')}</option>
                      <option value="SELF_EMPLOYED">{t('professionSelfEmployed')}</option>
                      <option value="UNEMPLOYED">{t('professionUnemployed')}</option>
                    </select>
                  </div>

                  {form.professionType === 'STUDENT' && (
                    <div>
                      <label className="block text-sm font-medium text-body mb-1">
                        {t('fieldOfStudy')}
                      </label>
                      <input
                        className="input"
                        placeholder={t('fieldOfStudyPlaceholder')}
                        value={form.fieldOfStudy}
                        onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
                      />
                    </div>
                  )}

                  {form.professionType === 'EMPLOYED' && (
                    <div>
                      <label className="block text-sm font-medium text-body mb-1">
                        {t('currentRole')}
                      </label>
                      <input
                        className="input"
                        placeholder={t('currentRolePlaceholder')}
                        value={form.currentRole}
                        onChange={(e) => setForm({ ...form, currentRole: e.target.value })}
                      />
                    </div>
                  )}

                  {form.professionType === 'SELF_EMPLOYED' && (
                    <div>
                      <label className="block text-sm font-medium text-body mb-1">
                        {t('businessSector')}
                      </label>
                      <input
                        className="input"
                        placeholder={t('businessSectorPlaceholder')}
                        value={form.businessSector}
                        onChange={(e) => setForm({ ...form, businessSector: e.target.value })}
                      />
                    </div>
                  )}

                  {form.professionType === 'UNEMPLOYED' && (
                    <div>
                      <label className="block text-sm font-medium text-body mb-1">
                        {t('highestQualification')}
                      </label>
                      <input
                        className="input"
                        placeholder={t('highestQualificationPlaceholder')}
                        value={form.highestQualification}
                        onChange={(e) => setForm({ ...form, highestQualification: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3: Consent */}
            {step === 3 && (
              <>
                <h2 className="text-xl font-bold text-heading">{t('consentTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('consentDesc')}</p>
                <div className="space-y-4 mt-6">
                  <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-all ${form.consentData ? 'border-primary-500 bg-primary-50 dark:bg-blue-900/20 dark:border-blue-500' : 'border-[var(--color-border)] hover:border-primary-300 dark:hover:border-blue-700 hover:bg-elevated'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 accent-[var(--color-primary)]"
                      checked={form.consentData}
                      onChange={(e) => setForm({ ...form, consentData: e.target.checked })}
                    />
                    <div>
                      <span className="text-sm font-medium text-heading">
                        {t('consentDataLabel')}
                      </span>
                      <p className="text-xs text-muted mt-1">
                        {t('consentDataDesc')}
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-all ${form.consentDisclaimer ? 'border-primary-500 bg-primary-50 dark:bg-blue-900/20 dark:border-blue-500' : 'border-[var(--color-border)] hover:border-primary-300 dark:hover:border-blue-700 hover:bg-elevated'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 accent-[var(--color-primary)]"
                      checked={form.consentDisclaimer}
                      onChange={(e) => setForm({ ...form, consentDisclaimer: e.target.checked })}
                    />
                    <div>
                      <span className="text-sm font-medium text-heading">
                        {t('consentDisclaimerLabel')}
                      </span>
                      <p className="text-xs text-muted mt-1">
                        {t('consentDisclaimerDesc')}
                      </p>
                    </div>
                  </label>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                className="btn-ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('back')}
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  className="btn-primary"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed()}
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleComplete}
                  disabled={!canProceed()}
                >
                  {t('finish')}
                  <Check className="h-4 w-4 ml-1" />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Skip */}
        {step < 3 && (
          <p className="mt-4 text-center">
            <button
              className="text-xs text-muted hover:text-body"
              onClick={() => {
                setShowConsent(false);
                router.push('/chat');
              }}
            >
              {t('skipForNow')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
