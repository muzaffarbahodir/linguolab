/**
 * Courses — каталог направлений: визард подбора (1 раз новому клиенту),
 * затем баннеры + поиск + чипсы категорий + сортировка по популярности.
 * Тап по курсу → /course/:id. Виден всем, в т.ч. новым пользователям.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Users } from 'lucide-react';

import {
  useLanguages,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  type Language,
  type LanguageCategory,
} from '../api/languages';
import { useMe } from '../api/users';
import { EmptyState } from '../components/EmptyState';

type CatFilter = 'all' | LanguageCategory;

export function CoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: languages, isLoading, isError } = useLanguages();
  const { data: me } = useMe();

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CatFilter>('all');

  // Категории, у которых есть направления (для чипсов).
  const categories = useMemo(() => {
    const present = new Set((languages ?? []).map((l) => l.category ?? 'LANGUAGES'));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [languages]);

  // Стартовый фильтр = выбор из опроса.
  const effectiveCat: CatFilter =
    cat === 'all' && me?.preferred_category ? me.preferred_category : cat;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      (languages ?? [])
        .filter((l) => {
          const matchQ =
            !q ||
            l.name_ru.toLowerCase().includes(q) ||
            (l.description ?? '').toLowerCase().includes(q);
          const matchCat = effectiveCat === 'all' || (l.category ?? 'LANGUAGES') === effectiveCat;
          return matchQ && matchCat;
        })
        // Популярные (больше открытых групп) — выше: маркетплейс-логика.
        .sort((a, b) => (b.groups_count ?? 0) - (a.groups_count ?? 0))
    );
  }, [languages, query, effectiveCat]);

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

      {/* Чипсы категорий */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={effectiveCat === 'all'} onClick={() => setCat('all')} label="Все" />
        {categories.map((c) => (
          <Chip
            key={c}
            active={effectiveCat === c}
            onClick={() => setCat(c)}
            label={CATEGORY_LABEL[c]}
          />
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

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`press shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
        active ? 'glass-btn' : 'glass-option'
      }`}
    >
      {label}
    </button>
  );
}

function CourseBanner({ lang, onClick }: { lang: Language; onClick: () => void }) {
  const { t } = useTranslation();
  const accent = lang.color ?? '#C8623F';
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
