// ==============================================================================
// PocketJury — DLSA / Legal Aid Finder Page
// ==============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { dlsaApi } from '@/lib/api';
import {
  MapPin,
  Phone,
  Search,
  Navigation,
  Building2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { LocationSelect } from '@/components/ui/LocationSelect';

interface DLSAContact {
  id: string;
  name: string;
  state: string;
  district: string;
  address?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
}

interface Helpline {
  id: string;
  name: string;
  number: string;
  description?: string;
  category?: string;
  availableHours?: string;
}

export default function DLSAPage() {
  const t = useTranslations('dlsa');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [contacts, setContacts] = useState<DLSAContact[]>([]);
  const [helplines, setHelplines] = useState<Helpline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    dlsaApi.helplines().then((data) => setHelplines(data.helplines || data)).catch(() => { });
  }, []);

  const handleSearch = async () => {
    if (!state) return;
    setIsLoading(true);
    try {
      const data = await dlsaApi.search(state, district || undefined);
      setContacts(data.contacts || data);
    } catch {
      toast.error(t('searchError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNearestMe = () => {
    if (!navigator.geolocation) {
      toast.error(t('geoNotSupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await dlsaApi.nearest(pos.coords.latitude, pos.coords.longitude);
          setContacts(data.contacts || data);
        } catch {
          toast.error(t('searchError'));
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error(t('geoError'));
        setLocating(false);
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-heading">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>

      {/* Search */}
      <div className="card p-6 mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <LocationSelect
              label={t('state')}
              placeholder={t('statePlaceholder')}
              type="state"
              value={state}
              onChange={(val) => {
                setState(val);
                setDistrict('');
              }}
            />
          </div>
          <div>
            <LocationSelect
              label={t('district')}
              placeholder={t('districtPlaceholder')}
              type="district"
              stateName={state}
              value={district}
              onChange={(val) => setDistrict(val)}
            />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary flex-1" onClick={handleSearch} disabled={isLoading}>
              <Search className="h-4 w-4 mr-1" />
              {t('search')}
            </button>
            <button
              className="btn-outline"
              onClick={handleNearestMe}
              disabled={locating}
            >
              <Navigation className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {contacts.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-heading">
            {t('results')} ({contacts.length})
          </h2>
          {contacts.map((c, i) => (
            <motion.div
              key={c.id}
              className="card p-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary-600 dark:text-blue-400" />
                    <h3 className="font-medium text-heading">{c.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-body">
                    {c.district}, {c.state}
                  </p>
                  {c.address && (
                    <p className="mt-1 text-xs text-muted flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {c.address}
                    </p>
                  )}
                  {c.distanceKm !== undefined && (
                    <span className="badge badge-secondary mt-2 text-xs">
                      {c.distanceKm.toFixed(1)} km away
                    </span>
                  )}
                </div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="btn-primary text-sm px-3 py-1.5"
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    {t('call')}
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Helplines */}
      {helplines.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-heading mb-4">{t('helplines')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {helplines.map((h) => (
              <div key={h.id} className="helpline-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-heading text-sm">{h.name}</h3>
                    {h.description && (
                      <p className="text-xs text-body mt-0.5">{h.description}</p>
                    )}
                    {h.availableHours && (
                      <p className="text-xs text-muted mt-0.5">{h.availableHours}</p>
                    )}
                  </div>
                  <a
                    href={`tel:${h.number}`}
                    className="flex items-center gap-1 text-sm font-bold text-accent-600 dark:text-orange-400 hover:opacity-80 whitespace-nowrap"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {h.number}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
