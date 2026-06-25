import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../hooks/useBackButton';
import { useMyAchievements, type Achievement } from '../api/achievements';
import { EmptyState } from '../components/EmptyState';

// ─── Achievement Card ─────────────────────────────────────────────────────────

function AchievementCard({ a, lang }: { a: Achievement; lang: string }) {
  const titleKey = `title_${lang}` as keyof Achievement;
  const descKey = `description_${lang}` as keyof Achievement;
  const title = (a[titleKey] as string) || a.title_ru;
  const desc = (a[descKey] as string) || a.description_ru;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-4 ${
        a.is_unlocked ? 'glass-card' : 'glass-option opacity-50'
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${
          a.is_unlocked ? 'bg-warn/15' : 'bg-surface grayscale'
        }`}
      >
        {a.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${a.is_unlocked ? '' : 'text-muted'}`}>{title}</p>
        <p className="text-tg-hint mt-0.5 line-clamp-2 text-xs">{desc}</p>
        {a.is_unlocked && a.unlocked_at && (
          <p className="text-warn mt-1 text-xs">
            🏅{' '}
            {new Date(a.unlocked_at).toLocaleDateString(lang, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AchievementsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyAchievements();

  useBackButton(() => navigate(-1));

  // Map i18n language code → field suffix (ru | uz | en, default ru)
  const lang = ['ru', 'uz', 'en'].includes(i18n.language) ? i18n.language : 'ru';

  return (
    <div className="glass-fade-in min-h-screen">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{t('achievements.title')}</h1>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="border-warn/30 border-t-warn h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && <EmptyState emoji="⚠️" title={t('achievements.load_error')} />}

        {data && (
          <>
            {/* Unlocked section */}
            <div>
              <h2 className="text-tg-hint mb-2 text-xs font-semibold uppercase tracking-wide">
                {t('achievements.unlocked')} ({data.unlocked.length})
              </h2>
              {data.unlocked.length === 0 ? (
                <p className="text-tg-hint py-4 text-center text-sm">
                  {t('achievements.empty_unlocked')}
                </p>
              ) : (
                <div className="stagger space-y-2">
                  {data.unlocked.map((a) => (
                    <AchievementCard key={a.id} a={a} lang={lang} />
                  ))}
                </div>
              )}
            </div>

            {/* Locked section */}
            {data.locked.length > 0 && (
              <div>
                <h2 className="text-tg-hint mb-2 text-xs font-semibold uppercase tracking-wide">
                  {t('achievements.locked')} ({data.locked.length})
                </h2>
                <div className="stagger space-y-2">
                  {data.locked.map((a) => (
                    <AchievementCard key={a.id} a={a} lang={lang} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
