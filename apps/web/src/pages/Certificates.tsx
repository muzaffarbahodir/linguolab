import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../hooks/useBackButton';

import { useMyCertificates, type Certificate } from '../api/certificates';
import { EmptyState } from '../components/EmptyState';

const LEVEL_COLOR: Record<string, string> = {
  A1: '#10B981',
  A2: '#10B981',
  B1: '#3B82F6',
  B2: '#3B82F6',
  C1: '#818cf8',
  C2: '#818cf8',
};

function CertCard({ cert }: { cert: Certificate }) {
  const { t, i18n } = useTranslation();
  const date = new Date(cert.issued_at).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const levelColor = LEVEL_COLOR[cert.class.level] ?? '#6366f1';

  function handleOpen() {
    WebApp.HapticFeedback.selectionChanged();
    WebApp.openLink(cert.file_url);
  }

  return (
    <div className="bg-brand/10 border-brand/20 rounded-2xl border p-4">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        {/* Certificate icon */}
        <div className="bg-brand/15 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl">
          🏆
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{cert.class.language.flag_emoji}</span>
            <span className="font-bold text-white">{cert.class.title}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className="rounded-lg px-2 py-0.5 text-xs font-bold"
              style={{ background: `${levelColor}22`, color: levelColor }}
            >
              {cert.class.level}
            </span>
            <span className="text-muted text-xs">{cert.class.language.name_ru}</span>
          </div>
        </div>
      </div>

      {/* Date */}
      <p className="text-muted mb-3 text-xs">{t('certificates.issued_date', { date })}</p>

      {/* Download button */}
      <button
        onClick={handleOpen}
        className="press flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #a5b4fc)',
          boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
        }}
      >
        {t('certificates.open_pdf')}
      </button>
    </div>
  );
}

export function CertificatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyCertificates();

  useBackButton(() => navigate(-1));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <div>
            <h1 className="text-lg font-bold">{t('certificates.my_title')}</h1>
            {data && data.length > 0 && (
              <p className="text-muted text-xs">
                {data.length}{' '}
                {data.length === 1
                  ? t('certificates.count_1')
                  : data.length < 5
                    ? t('certificates.count_few')
                    : t('certificates.count_many')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && <EmptyState emoji="⚠️" title={t('certificates.load_error')} />}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            emoji="🏆"
            title={t('certificates.empty')}
            subtitle={t('certificates.empty_sub2')}
          />
        )}

        <div className="stagger flex flex-col gap-3">
          {data?.map((cert) => (
            <CertCard key={cert.id} cert={cert} />
          ))}
        </div>
      </div>
    </div>
  );
}
