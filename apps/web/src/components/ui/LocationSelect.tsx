import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Search } from 'lucide-react';
import locationData from '@/lib/locations.json';

interface LocationSelectProps {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    type: 'state' | 'district';
    stateName?: string; // Required if type === 'district'
}

export function LocationSelect({
    label,
    placeholder,
    value,
    onChange,
    type,
    stateName,
}: LocationSelectProps) {
    const t = useTranslations('locations');
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Fetch options based on type
    const options = useMemo(() => {
        try {
            if (type === 'state') {
                return locationData.states || [];
            } else if (type === 'district' && stateName) {
                // Find districts for the given state name
                const districts = (locationData.districts as Record<string, string[]>)[stateName];
                return Array.isArray(districts) ? districts : [];
            }
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
        return [];
    }, [type, stateName]);

    // Safely translate location names
    // In a real app with all translations, we'd use t(`states.${name}`)
    // Here we use a safe translation wrapper
    const getTranslatedName = (name: string | Record<string, any>) => {
        if (!name) return '';

        // Safety handler: If a corrupted district object is passed from the DB legacy package, 
        // stringify it or parse out its value. Example: { name: 'Mumbai' } -> 'Mumbai'
        let parsedName = typeof name === 'string' ? name : '';
        if (typeof name === 'object') {
            if (name.name) parsedName = String(name.name);
            else if (name.value) parsedName = String(name.value);
            else parsedName = JSON.stringify(name);
        }

        if (type === 'district') {
            try {
                // Create a valid JSON key
                const key = `districts.${parsedName.replace(/\s+/g, '_')}`;
                // Let next-intl seamlessly translate if the string exists in the JSON, otherwise return raw parsedName
                return t.has(key) ? t(key) : parsedName;
            } catch (e) {
                return parsedName;
            }
        }

        try {
            // Create a valid JSON key (e.g., "Andhra Pradesh" -> "Andhra_Pradesh")
            const key = `${type}s.${parsedName.replace(/\s+/g, '_')}`;
            return t.has(key) ? t(key) : parsedName;
        } catch (e) {
            return parsedName;
        }
    };

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        const lowerQuery = searchQuery.toLowerCase();
        return options.filter((opt: string) => {
            const translated = getTranslatedName(opt).toLowerCase();
            const original = opt.toLowerCase();
            return translated.includes(lowerQuery) || original.includes(lowerQuery);
        });
    }, [options, searchQuery]);

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-body mb-1">
                {label}
            </label>
            <button
                type="button"
                className="input w-full flex items-center justify-between text-left"
                onClick={() => setIsOpen(!isOpen)}
                disabled={type === 'district' && !stateName}
            >
                <span className={value ? 'text-heading' : 'text-muted'}>
                    {value ? getTranslatedName(value) : placeholder}
                </span>
                <ChevronDown className="h-4 w-4 text-muted shrink-0" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60"
                        style={{ borderColor: 'var(--color-border)' }}
                    >
                        <div className="p-2 border-b bg-secondary-50/50 dark:bg-slate-800/50" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                                <input
                                    autoFocus
                                    className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md bg-transparent border-none focus:ring-0 text-heading placeholder:text-muted"
                                    placeholder={type === 'state' ? "Search state..." : "Search district..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto p-1 flex-1 scrollbar-thin">
                            {filteredOptions.length === 0 ? (
                                <div className="p-3 text-sm text-center text-muted">No results found</div>
                            ) : (
                                filteredOptions.map((opt: string) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors hover:bg-elevated ${value === opt ? 'bg-primary-50 text-primary-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium' : 'text-body'
                                            }`}
                                        onClick={() => {
                                            onChange(opt);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <span>{getTranslatedName(opt)}</span>
                                        {value === opt && <Check className="h-4 w-4 shrink-0" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
