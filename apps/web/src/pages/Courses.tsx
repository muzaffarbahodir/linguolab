/**
 * Courses — главный каталог курсов (направлений): баннеры + поиск + фильтр.
 * Тап по курсу → /course/:id (инфо, требования, учителя, рекомендация).
 * Виден всем, в т.ч. новым пользователям (витрина).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Users } from 'lucide-react';

import { useLanguages, type Language } from '../api/languages';
import { EmptyState } from '../components/EmptyState';

type Filter = 'all' | 'open';

export function CoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: languages, isLoading, isError } = useLanguages();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (languages ?? []).filter((l) => {
      const matchQ =
        !q ||
        l.name_ru.toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q);
      const matchF = filter === 'all' || (l.groups_count ?? 0) > 0;
      return matchQ && matchF;
    });
  }, [languages, query, filter]);

  return (
    <div className="glass-fade-in flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-xl font-bold">{t('courses.title')}</h1>

      {/* Поиск */}
      <div className="bg-surface border-hairline flex items-center gap-2 rounded-2xl border px-3 py-2.5">
        <Search size={18} className="text-faint shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('courses.search_ph')}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {/* Фильтр */}
      <div className="flex gap-2">
        {(['all', 'open'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`press rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === f ? 'glass-btn' : 'glass-option'
            }`}
          >
            {f === 'all' ? t('courses.all') : t('courses.filter_open')}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState emoji="⚠️" title={t('courses.load_error')} />}

      {!isLoading && !isError && list.length === 0 && (
        <EmptyState emoji="📚" title={t('courses.empty')} />
      )}

      {!isLoading && !isError && list.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {list.map((lang) => (
            <CourseBanner
              key={lang.id}
              lang={lang}
              onClick={() => navigate(`/course/${lang.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseBanner({ lang, onClick }: { lang: Language; onClick: () => void }) {
  const { t } = useTranslation();
  const accent = lang.color ?? '#6C5CE7';
  const groups = lang.groups_count ?? 0;

  return (
    <button onClick={onClick} className="press glass-card overflow-hidden rounded-2xl text-left">
      <div className="relative h-24 w-full">
        {lang.image_url ? (
          <img src={lang.image_url} alt={lang.name_ru} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-4xl"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          >
            {lang.flag_emoji}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-bold">
          {lang.flag_emoji} {lang.name_ru}
        </p>
        {lang.duration_label && (
          <p className="text-faint truncate text-xs">{lang.duration_label}</p>
        )}
        <p className="text-muted mt-1 flex items-center gap-1 text-xs">
          <Users size={12} />
          {groups > 0 ? t('courses.groups_open', { n: groups }) : t('courses.no_groups_short')}
        </p>
      </div>
    </button>
  );
}
