'use client';

import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';
import React from 'react';
import { LegalHeader } from '@/components/layout/LegalHeader';

export default function TermsPage() {
    const t = useTranslations('legal.terms');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-32 pb-20">
            <LegalHeader />
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <Shield className="w-8 h-8 text-primary-600" />
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        {t('title')}
                    </h1>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 md:p-12">
                    <p className="text-sm text-slate-500 mb-8 font-medium">
                        {t('lastUpdated')}
                    </p>

                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <p className="lead text-lg text-slate-700 dark:text-slate-300 mb-8">
                            {t('intro')}
                        </p>

                        <div className="space-y-8">
                            {[1, 2, 3].map((sectionIndex) => (
                                <section key={sectionIndex}>
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                                        {t(`sections.${sectionIndex}.heading`)}
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t(`sections.${sectionIndex}.content`)}
                                    </p>
                                </section>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
