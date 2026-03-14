'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LocationSelect } from '@/components/ui/LocationSelect';
import { toast } from 'sonner';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PROFESSIONS = ['STUDENT', 'EMPLOYED', 'UNEMPLOYED', 'SELF_EMPLOYED'] as const;

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const t = useTranslations('settings'); // or a new 'profile' namespace later
    const tCommon = useTranslations('common');
    const tAuth = useTranslations('auth');
    const tOnboard = useTranslations('onboarding');
    const user = useAuthStore((s) => s.user);
    const updateProfile = useAuthStore((s) => s.updateProfile);

    const [form, setForm] = useState({
        fullName: '',
        email: '',
        dateOfBirth: '',
        locationState: '',
        locationDistrict: '',
        professionType: '',
        fieldOfStudy: '',
        currentProfession: '',
    });

    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            setForm({
                fullName: user.profile?.fullName || '',
                email: user.email || '',
                dateOfBirth: user.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split('T')[0] : '',
                locationState: user?.profile?.locationState || '',
                locationDistrict: user?.profile?.locationDistrict || '',
                professionType: user?.profile?.professionType || '',
                fieldOfStudy: user?.profile?.fieldOfStudy || '',
                currentProfession: user?.profile?.currentProfession || '',
            });
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const hasUnsavedChanges = () => {
        const originalDob = user?.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split('T')[0] : '';
        return (
            form.fullName !== (user?.profile?.fullName || '') ||
            form.email !== (user?.email || '') ||
            form.dateOfBirth !== originalDob ||
            form.locationState !== (user?.profile?.locationState || '') ||
            form.locationDistrict !== (user?.profile?.locationDistrict || '') ||
            form.professionType !== (user?.profile?.professionType || '') ||
            form.fieldOfStudy !== (user?.profile?.fieldOfStudy || '') ||
            form.currentProfession !== (user?.profile?.currentProfession || '')
        );
    };

    const handleCloseRequest = () => {
        if (hasUnsavedChanges()) {
            setShowCancelConfirm(true);
        } else {
            onClose();
        }
    };

    const handleSaveRequest = () => {
        if (!hasUnsavedChanges()) {
            onClose();
            return;
        }
        setShowSaveConfirm(true);
    };

    const executeSave = async () => {
        setShowSaveConfirm(false);
        setIsSaving(true);
        try {
            await updateProfile({
                fullName: form.fullName || undefined,
                email: form.email || undefined,
                dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
                locationState: form.locationState || undefined,
                locationDistrict: form.locationDistrict || undefined,
                professionType: form.professionType || undefined,
                fieldOfStudy: form.fieldOfStudy || undefined,
                currentProfession: form.currentProfession || undefined,
            });
            toast.success(tCommon('saved'));
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ marginTop: '0', marginBottom: '0' }}>
                <div className="w-full max-w-lg bg-card border shadow-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-bold text-heading">{t('editProfile')}</h2>
                        <button
                            onClick={handleCloseRequest}
                            className="p-1 rounded-md text-muted hover:bg-elevated transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 overflow-y-auto space-y-4 flex-1">
                        <div>
                            <label className="block text-sm font-medium text-body mb-1">
                                {tAuth('fullName')}
                            </label>
                            <input
                                type="text"
                                className="input w-full"
                                value={form.fullName}
                                placeholder={tAuth('fullNamePlaceholder')}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-body mb-1">
                                {tAuth('email')}
                            </label>
                            <input
                                type="email"
                                className="input w-full"
                                value={form.email}
                                placeholder={tAuth('emailPlaceholder')}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-body mb-1">
                                {tAuth('dateOfBirth')}
                            </label>
                            <input
                                type="date"
                                className="input w-full"
                                value={form.dateOfBirth}
                                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <LocationSelect
                                label={tOnboard('state')}
                                placeholder={tOnboard('statePlaceholder')}
                                type="state"
                                value={form.locationState}
                                onChange={(val: string) => setForm({ ...form, locationState: val, locationDistrict: '' })}
                            />
                            <LocationSelect
                                label={tOnboard('district')}
                                placeholder={tOnboard('districtPlaceholder')}
                                type="district"
                                stateName={form.locationState}
                                value={form.locationDistrict}
                                onChange={(val: string) => setForm({ ...form, locationDistrict: val })}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-body mb-1">
                                {tOnboard('professionType')}
                            </label>
                            <select
                                className="input w-full"
                                value={form.professionType}
                                onChange={(e) => setForm({
                                    ...form,
                                    professionType: e.target.value,
                                    fieldOfStudy: '',
                                    currentProfession: ''
                                })}
                            >
                                <option value="">{tOnboard('selectProfession')}</option>
                                {PROFESSIONS.map((p) => (
                                    <option key={p} value={p}>
                                        {tOnboard(`profession${p.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')}`)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {form.professionType === 'STUDENT' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-body mb-1">
                                    {tOnboard('fieldOfStudy')}
                                </label>
                                <input
                                    type="text"
                                    className="input w-full"
                                    placeholder={tOnboard('fieldOfStudyPlaceholder')}
                                    value={form.fieldOfStudy}
                                    onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
                                />
                            </div>
                        )}

                        {form.professionType === 'EMPLOYED' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-body mb-1">
                                    {tOnboard('currentRole')}
                                </label>
                                <input
                                    className="input w-full"
                                    placeholder={tOnboard('currentRolePlaceholder')}
                                    value={form.currentProfession}
                                    onChange={(e) => setForm({ ...form, currentProfession: e.target.value })}
                                />
                            </div>
                        )}

                        {form.professionType === 'SELF_EMPLOYED' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-body mb-1">
                                    {tOnboard('businessSector')}
                                </label>
                                <input
                                    className="input w-full"
                                    placeholder={tOnboard('businessSectorPlaceholder')}
                                    value={form.currentProfession}
                                    onChange={(e) => setForm({ ...form, currentProfession: e.target.value })}
                                />
                            </div>
                        )}

                        {form.professionType === 'UNEMPLOYED' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-body mb-1">
                                    {tOnboard('highestQualification')}
                                </label>
                                <input
                                    className="input w-full"
                                    placeholder={tOnboard('highestQualificationPlaceholder')}
                                    value={form.currentProfession}
                                    onChange={(e) => setForm({ ...form, currentProfession: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-elevated/50 flex justify-end gap-3">
                        <button
                            className="btn-outline"
                            onClick={handleCloseRequest}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleSaveRequest}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => {
                    setShowCancelConfirm(false);
                    onClose();
                }}
                title="Discard changes?"
                description="Any unsaved edits will be lost."
                confirmText="Discard"
                cancelText="Keep Editing"
                variant="danger"
                icon="alert"
            />

            <ConfirmDialog
                isOpen={showSaveConfirm}
                onClose={() => setShowSaveConfirm(false)}
                onConfirm={executeSave}
                title="Save changes?"
                description="Are you sure you want to update your profile with these details?"
                confirmText="Save"
                cancelText="Cancel"
                variant="primary"
            />
        </>
    );
}
