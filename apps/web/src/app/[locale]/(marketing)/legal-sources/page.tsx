'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, ExternalLink, Scale } from 'lucide-react';
import React from 'react';
import { LegalHeader } from '@/components/layout/LegalHeader';

const SOURCES = [
    { key: 'BNS', url: 'https://legislative.gov.in/bns-2023-chapter-v' },
    { key: 'Constitution', url: 'https://legislative.gov.in/constitution-of-india' },
    { key: 'CPA', url: 'https://legislative.gov.in/consumer-protection-act-2019' },
    { key: 'RTI', url: 'https://legislative.gov.in/rti-act-2005' },
    { key: 'PWDVA', url: 'https://legislative.gov.in/pwdva-2005' },
    { key: 'SeniorCitizens', url: 'https://legislative.gov.in/senior-citizens-act-2007' },
    { key: 'LegalAid', url: 'https://legislative.gov.in/lsa-act-1987' },
    { key: 'Cyber', url: 'https://legislative.gov.in/it-act-2000' },
    { key: 'Property', url: 'https://legislative.gov.in/transfer-property-act-1882-lease' },
];

export default function LegalSourcesPage() {
    const t = useTranslations('legal.legalSources');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-32 pb-20">
            <LegalHeader />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-6">
                        <Scale className="w-8 h-8 text-primary-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                        {t('title')}
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        {t('description')}
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
                    <div className="p-6 sm:p-8 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    {t('primarySource')}
                                </h3>
                                <a
                                    href="https://legislative.gov.in/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-primary-600 dark:text-blue-400 font-medium hover:underline"
                                >
                                    {t('primarySourceLinkText')}
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-slate-400" />
                            {t('embeddedStatutesTitle')}
                        </h2>

                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {SOURCES.map(({ key, url }) => (
                                <div
                                    key={key}
                                    className="flex flex-col p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-primary-500 transition-colors h-full"
                                >
                                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2">
                                        {t(`sources.${key}.title`)}
                                    </h3>
                                    <p className="flex-1 text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3">
                                        {t(`sources.${key}.chapters`)}
                                    </p>
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-blue-400 hover:text-primary-700 dark:hover:text-blue-300 w-fit"
                                    >
                                        {t('readDocument')}
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
                    <p className="text-amber-800 dark:text-amber-200 font-medium">
                        ⚠️ {t('disclaimer')}
                    </p>
                </div>
            </div>
        </div>
    );
}
