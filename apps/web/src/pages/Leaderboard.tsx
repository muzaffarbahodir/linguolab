/**
 * LeaderboardPage — рейтинг студентов по очкам активности.
 * Подиум топ-3 + список. Текущий пользователь подсвечен. Route: /leaderboard
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trophy, Crown } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useLeaderboard, type LeaderboardEntry } from '../api/users';
import { EmptyState } from '../components/EmptyState';

const MEDAL = ['🥇', '🥈', '🥉'];

function Avatar({ entry, size = 40 }: { entry: LeaderboardEntry; size?: number }) {
  if (entry.avatar_url) {
    return (
      <img
        src={entry.avatar_url}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="bg-brand/15 text-brand flex items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size }}
    >
      {entry.name[0]?.toUpperCase()}
    </div>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLeaderboard();

  useBackButton(() => navigate('/profile'));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }
  if (isError || !data || data.top.length === 0) {
    return (
      <div className="p-4">
        <EmptyState emoji="🏆" title={t('leaderboard.empty')} />
      </div>
    );
  }

  const podium = data.top.slice(0, 3);
  const rest = data.top.slice(3);
  // Порядок подиума: 2 — 1 — 3 (центр выше).
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-10 pt-6">
      <div className="mb-1 flex items-center gap-2">
        <Trophy size={22} className="text-warn" />
        <h1 className="text-xl font-bold">{t('leaderboard.title')}</h1>
      </div>
      <p className="text-muted mb-4 text-sm">{t('leaderboard.subtitle')}</p>

      {/* Podium */}
      <div className="mb-4 flex items-end justify-center gap-3">
        {podiumOrder.map((e) => {
          const top1 = e.rank === 1;
          const h = top1 ? 96 : e.rank === 2 ? 74 : 60;
          return (
            <div key={e.id} className="flex flex-1 flex-col items-center">
              <div className="relative mb-2">
                {top1 && (
                  <Crown
                    size={18}
                    className="text-warn absolute -top-4 left-1/2 -translate-x-1/2 fill-current"
                  />
                )}
                <Avatar entry={e} size={top1 ? 60 : 48} />
                <span className="absolute -bottom-1 -right-1 text-lg">{MEDAL[e.rank - 1]}</span>
              </div>
              <p className="max-w-full truncate text-center text-xs font-semibold">{e.name}</p>
              <p className="text-brand text-sm font-bold">{e.points}</p>
              <div
                className="mt-1 w-full rounded-t-xl"
                style={{
                  height: h,
                  background: top1 ? 'linear-gradient(180deg,#F59E0B,#D97706)' : 'var(--surface-2)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden rounded-2xl">
          {rest.map((e, i) => (
            <Row key={e.id} entry={e} last={i === rest.length - 1} />
          ))}
        </div>
      )}

      {/* Sticky my-rank card if outside top 30 */}
      {data.me && data.me.rank > 30 && (
        <div className="mt-3">
          <p className="text-muted mb-1 px-1 text-xs font-semibold uppercase tracking-wide">
            {t('leaderboard.you')}
          </p>
          <div className="glass-card overflow-hidden rounded-2xl">
            <Row entry={data.me} last />
          </div>
        </div>
      )}

      <p className="text-faint mt-4 text-center text-xs">{t('leaderboard.points_hint')}</p>
    </div>
  );
}

function Row({ entry, last }: { entry: LeaderboardEntry; last: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${last ? '' : 'border-hairline border-b'} ${
        entry.is_me ? 'bg-brand/10' : ''
      }`}
    >
      <span className="text-muted w-6 text-center text-sm font-bold tabular-nums">
        {entry.rank}
      </span>
      <Avatar entry={entry} size={34} />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {entry.name}
        {entry.is_me && (
          <span className="text-brand-400 ml-1 text-xs">· {t('leaderboard.me')}</span>
        )}
      </p>
      <span className="text-brand shrink-0 text-sm font-bold">{entry.points}</span>
    </div>
  );
}
