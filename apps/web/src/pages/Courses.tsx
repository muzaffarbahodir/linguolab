/**
 * Courses — каталог направлений: визард подбора (1 раз новому клиенту),
 * затем баннеры + поиск + чипсы категорий + сортировка по популярности.
 * Тап по курсу → /course/:id. Виден всем, в т.ч. новым пользователям.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Star, ChevronRight } from 'lucide-react';

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

  /** Порог, ниже которого поиск бесполезен: столько карточек видно сразу. */
  const SEARCH_THRESHOLD = 8;
  const showSearch = (languages?.length ?? 0) > SEARCH_THRESHOLD;

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
        // Один разумный порядок вместо переключателя: сначала где больше
        // открытых групп, при равенстве — с лучшим рейтингом. Выбор между
        // «популярные» и «по рейтингу» на десятке курсов ничего не менял, а
        // занимал строку и требовал решения от человека, который просто зашёл
        // посмотреть, чему тут учат.
        .sort(
          (a, b) =>
            (b.groups_count ?? 0) - (a.groups_count ?? 0) ||
            (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
        )
    );
  }, [languages, query, effectiveCat]);

  // Бестселлер: курс с наибольшим числом студентов (от 3) — соц-доказательство.
  const bestsellerId = useMemo(() => {
    const top = [...(languages ?? [])]
      .filter((l) => (l.students_count ?? 0) >= 3)
      .sort((a, b) => (b.students_count ?? 0) - (a.students_count ?? 0))[0];
    return top?.id ?? null;
  }, [languages]);

  return (
    <div className="glass-fade-in flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-xl font-bold">{t('courses.title')}</h1>

      {/*
        Поиск нужен, когда список не помещается на экран. На восьми курсах
        листать быстрее, чем печатать, а поле съедает верх страницы.
      */}
      {showSearch && (
        <div className="bg-surface border-hairline flex items-center gap-2 rounded-2xl border px-3 py-2.5">
          <Search size={18} className="text-faint shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('courses.search_ph')}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      )}

      {/* Направления. Одна категория — фильтровать не из чего. */}
      {categories.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip
            active={effectiveCat === 'all'}
            onClick={() => setCat('all')}
            label={t('courses.filter_all')}
          />
          {categories.map((c) => (
            <Chip
              key={c}
              active={effectiveCat === c}
              onClick={() => setCat(c)}
              label={CATEGORY_LABEL[c]}
            />
          ))}
        </div>
      )}

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
              bestseller={lang.id === bestsellerId}
              onClick={() => navigate(`/course/${lang.id}`)}
            />
          ))}
        </div>
      )}

      {/*
        Вход в каталог преподавателей.
        Курс выбирают по языку, а учиться идут к человеку — до этой ссылки
        профили открывались только из уже своего класса, то есть когда выбор
        давно сделан.
      */}
      <button
        onClick={() => navigate('/teachers')}
        className="glass-option press flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <Users size={18} className="text-brand-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('teacher.catalog_title')}</p>
          <p className="text-faint truncate text-xs">{t('teacher.catalog_sub')}</p>
        </div>
        <ChevronRight size={16} className="text-faint shrink-0" />
      </button>
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

function CourseBanner({
  lang,
  bestseller,
  onClick,
}: {
  lang: Language;
  bestseller?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const accent = lang.color ?? '#6366f1';
  const groups = lang.groups_count ?? 0;
  const students = lang.students_count ?? 0;

  return (
    <button onClick={onClick} className="press glass-card overflow-hidden rounded-2xl text-left">
      <div className="relative h-24 w-full">
        {lang.image_url ? (
          <img src={lang.image_url} alt={lang.name_ru} className="h-full w-full object-cover" />
        ) : (
          // Заглушка на случай, когда фото направления ещё не загрузили.
          // Название, а не флаг-эмодзи: Windows их не рисует и вместо флага
          // показывает пару букв — «GB», «CN». На телефоне флаг виден, на
          // десктопе выходило похоже на недогруженную картинку.
          <div
            className="flex h-full w-full items-center justify-center px-3 text-center text-lg font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          >
            {lang.name_ru}
          </div>
        )}
        {bestseller && (
          <span className="bg-warn absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-black">
            {t('courses.bestseller')}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-bold">
          {lang.flag_emoji} {lang.name_ru}
        </p>
        {lang.duration_label && (
          <p className="text-faint truncate text-xs">{lang.duration_label}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs">
          {lang.avg_rating != null && (
            <span className="flex items-center gap-0.5 font-semibold">
              <Star size={11} className="text-warn fill-current" /> {lang.avg_rating}
            </span>
          )}
          <span className="text-muted flex items-center gap-1">
            <Users size={12} />
            {students > 0
              ? t('courses.students_n', { n: students })
              : groups > 0
                ? t('courses.groups_open', { n: groups })
                : t('courses.no_groups_short')}
          </span>
        </div>
      </div>
    </button>
  );
}
