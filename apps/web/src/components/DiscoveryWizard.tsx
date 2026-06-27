/**
 * DiscoveryWizard — опрос подбора курса (показывается новому клиенту 1 раз).
 * Шаг 1: онлайн/очно (обязательно). Шаг 2: категория (можно пропустить).
 * Шаг 3: индивидуально/группа (можно пропустить, рекомендуем индивид).
 * По завершении сохраняет преференсы (PATCH /users/me/discovery) → onDone().
 */
import { useMemo, useState, type ReactNode } from 'react';
import WebApp from '@twa-dev/sdk';
import {
  Globe,
  School,
  User,
  Users,
  TrendingUp,
  Languages as LanguagesIcon,
  GraduationCap,
  Ruler,
  BookOpen,
  Landmark,
  Award,
} from 'lucide-react';

import { useLanguages, CATEGORY_ORDER, type LanguageCategory } from '../api/languages';
import {
  useSaveDiscovery,
  type StudyFormat,
  type StudyMode,
  type DiscoveryInput,
} from '../api/users';

/** Иконка категории (lucide). */
const CATEGORY_ICON: Record<LanguageCategory, ReactNode> = {
  LANGUAGES: <LanguagesIcon size={22} />,
  IELTS: <GraduationCap size={22} />,
  SAT: <Ruler size={22} />,
  CEFR: <BookOpen size={22} />,
  DTM: <Landmark size={22} />,
  MILLIY_SERTIFIKAT: <Award size={22} />,
};

const CATEGORY_FULL: Record<LanguageCategory, string> = {
  LANGUAGES: 'Языки',
  IELTS: 'IELTS',
  SAT: 'SAT',
  CEFR: 'CEFR',
  DTM: 'DTM (Davlat testi)',
  MILLIY_SERTIFIKAT: 'Milliy sertifikat',
};

export function DiscoveryWizard({ onDone }: { onDone: () => void }) {
  const { data: languages } = useLanguages();
  const save = useSaveDiscovery();

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<StudyFormat | null>(null);
  const [category, setCategory] = useState<LanguageCategory | null>(null);

  // Категории, у которых есть хотя бы одно направление.
  const categories = useMemo(() => {
    const present = new Set((languages ?? []).map((l) => l.category ?? 'LANGUAGES'));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [languages]);

  const tap = () => WebApp.HapticFeedback?.selectionChanged?.();

  const finish = (mode: StudyMode | null) => {
    if (!format || save.isPending) return;
    const dto: DiscoveryInput = {
      study_format: format,
      study_mode: mode,
      preferred_category: category,
    };
    save.mutate(dto, { onSuccess: onDone, onError: onDone });
  };

  return (
    <div className="glass-fade-in flex min-h-[80vh] flex-col px-4 pt-6">
      {/* Прогресс */}
      <div className="mb-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-hairline'}`}
          />
        ))}
      </div>

      {/* Шаг 1 — формат (обязательно) */}
      {step === 0 && (
        <Step title="Как удобнее учиться?" subtitle="Выберите формат занятий">
          <BigOption
            icon={<Globe size={22} />}
            title="Онлайн"
            desc="Из дома, по видеосвязи"
            onClick={() => {
              tap();
              setFormat('ONLINE');
              setStep(1);
            }}
          />
          <BigOption
            icon={<School size={22} />}
            title="Очно"
            desc="В учебном центре"
            onClick={() => {
              tap();
              setFormat('OFFLINE');
              setStep(1);
            }}
          />
        </Step>
      )}

      {/* Шаг 2 — категория (можно пропустить) */}
      {step === 1 && (
        <Step title="Что хотите изучать?" subtitle="Поможем подобрать направление">
          <div className="flex flex-col gap-2.5">
            {categories.map((c) => (
              <BigOption
                key={c}
                icon={CATEGORY_ICON[c]}
                title={CATEGORY_FULL[c]}
                onClick={() => {
                  tap();
                  setCategory(c);
                  setStep(2);
                }}
              />
            ))}
          </div>
          <SkipLink
            onClick={() => {
              tap();
              setCategory(null);
              setStep(2);
            }}
          />
        </Step>
      )}

      {/* Шаг 3 — индивид/группа (можно пропустить, рекомендуем индивид) */}
      {step === 2 && (
        <Step title="Индивидуально или в группе?" subtitle="Можно изменить позже">
          <div className="bg-brand/10 border-brand/20 mb-3 rounded-2xl border p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp size={16} style={{ color: 'var(--brand)' }} />
              Индивидуально — эффективнее
            </p>
            <p className="text-muted mt-1 text-xs">
              По нашей статистике до 98% учеников на индивидуальных занятиях достигают цели быстрее.
            </p>
          </div>
          <BigOption
            icon={<User size={22} />}
            title="Индивидуально"
            desc="Рекомендуем · максимум результата"
            recommended
            onClick={() => {
              tap();
              finish('INDIVIDUAL');
            }}
          />
          <BigOption
            icon={<Users size={22} />}
            title="В группе"
            desc="Дешевле, учимся вместе"
            onClick={() => {
              tap();
              finish('GROUP');
            }}
          />
          <SkipLink label="Пропустить и показать всё" onClick={() => finish(null)} />
        </Step>
      )}

      {save.isPending && <p className="text-muted mt-4 text-center text-sm">Сохраняем…</p>}
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="glass-fade-in flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-muted mt-1 text-sm">{subtitle}</p>
      </div>
      <div className="mt-2 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function BigOption({
  icon,
  title,
  desc,
  recommended,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`press flex w-full items-center gap-3 rounded-2xl p-4 text-left ${
        recommended ? 'border-brand bg-brand/10 border-2' : 'glass-card'
      }`}
    >
      {icon && (
        <span className="shrink-0" style={{ color: 'var(--brand)' }}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {desc && <p className="text-muted truncate text-xs">{desc}</p>}
      </div>
    </button>
  );
}

function SkipLink({ label = 'Пропустить', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-muted press mx-auto mt-4 py-2 text-sm font-medium">
      {label} →
    </button>
  );
}
