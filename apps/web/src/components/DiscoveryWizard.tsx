/**
 * DiscoveryWizard — подбор курса для нового клиента (показывается один раз).
 *
 * Не карусель «полистай про наши преимущества», а воронка выбора: на каждом
 * экране нужно что-то выбрать. Так человек вовлекается, а мы попутно узнаём
 * формат, направление и предпочтения — вместо того чтобы спрашивать это потом.
 *
 * Шаг 1: онлайн/очно (обязательно)
 * Шаг 2: категория (можно пропустить)
 * Шаг 3: индивидуально/группа (можно пропустить)
 * Шаг 4: что будет на первом занятии — снимает главный страх новичка
 *
 * По завершении сохраняет преференсы (PATCH /users/me/discovery) → onDone().
 */
import { useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';

import { useLanguages, CATEGORY_ORDER, type LanguageCategory } from '../api/languages';
import {
  useSaveDiscovery,
  type StudyFormat,
  type StudyMode,
  type DiscoveryInput,
} from '../api/users';
import { Button, ChoiceCard } from './ui';

const CATEGORY_FULL: Record<LanguageCategory, string> = {
  LANGUAGES: 'Языки',
  IELTS: 'IELTS',
  SAT: 'SAT',
  CEFR: 'CEFR',
  DTM: 'DTM (Davlat testi)',
  MILLIY_SERTIFIKAT: 'Milliy sertifikat',
};

const CATEGORY_DESC: Record<LanguageCategory, string> = {
  LANGUAGES: 'Английский, французский, китайский и другие',
  IELTS: 'Подготовка к международному экзамену',
  SAT: 'Для поступления в зарубежные вузы',
  CEFR: 'Общеевропейские уровни A1–C2',
  DTM: 'Подготовка к государственному тестированию',
  MILLIY_SERTIFIKAT: 'Национальный сертификат по языку',
};

const CATEGORY_ART: Record<LanguageCategory, string> = {
  LANGUAGES: '🌍',
  IELTS: '🎓',
  SAT: '📐',
  CEFR: '📘',
  DTM: '🏛️',
  MILLIY_SERTIFIKAT: '🏅',
};

/**
 * Цвет закреплён за смыслом, а не выбирается на глаз при вёрстке. Одна
 * категория — один оттенок во всём приложении: так цвет помогает узнавать
 * раздел, а не превращает экран в витрину красок.
 */
const CATEGORY_TINT: Record<LanguageCategory, string> = {
  LANGUAGES: '#6C5CE7',
  IELTS: '#0EA5E9',
  SAT: '#F59E0B',
  CEFR: '#10B981',
  DTM: '#EC4899',
  MILLIY_SERTIFIKAT: '#8B5CF6',
};

export function DiscoveryWizard({ onDone }: { onDone: () => void }) {
  const { data: languages } = useLanguages();
  const save = useSaveDiscovery();

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<StudyFormat | null>(null);
  const [category, setCategory] = useState<LanguageCategory | null>(null);
  const [mode, setMode] = useState<StudyMode | null>(null);

  // Категории, у которых есть хотя бы одно направление.
  const categories = useMemo(() => {
    const present = new Set((languages ?? []).map((l) => l.category ?? 'LANGUAGES'));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [languages]);

  const tap = () => WebApp.HapticFeedback?.selectionChanged?.();

  /** Выбор сохраняется на последнем шаге — до него человек может передумать. */
  const finish = () => {
    if (!format || save.isPending) return;
    const dto: DiscoveryInput = {
      study_format: format,
      study_mode: mode,
      preferred_category: category,
    };
    WebApp.HapticFeedback?.notificationOccurred?.('success');
    save.mutate(dto, { onSuccess: onDone, onError: onDone });
  };

  const TOTAL = 4;

  return (
    <div className="flex min-h-[85vh] flex-col px-4 pb-8 pt-6">
      <div className="mb-7 flex gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} className={cxProgress(i <= step)} />
        ))}
      </div>

      {step === 0 && (
        <Step title="Как удобнее учиться?" subtitle="Выберите формат занятий">
          <ChoiceCard
            title="Онлайн"
            description="Из дома, по видеосвязи. Не нужно никуда ехать."
            art="💻"
            tint="#0EA5E9"
            onClick={() => {
              tap();
              setFormat('ONLINE');
              setStep(1);
            }}
          />
          <ChoiceCard
            title="Очно"
            description="В учебном центре, рядом с преподавателем и группой."
            art="🏫"
            tint="#6C5CE7"
            onClick={() => {
              tap();
              setFormat('OFFLINE');
              setStep(1);
            }}
          />
        </Step>
      )}

      {step === 1 && (
        <Step title="Что хотите изучать?" subtitle="Поможем подобрать направление">
          {categories.map((c) => (
            <ChoiceCard
              key={c}
              title={CATEGORY_FULL[c]}
              description={CATEGORY_DESC[c]}
              art={CATEGORY_ART[c]}
              tint={CATEGORY_TINT[c]}
              onClick={() => {
                tap();
                setCategory(c);
                setStep(2);
              }}
            />
          ))}
          <SkipLink
            onClick={() => {
              tap();
              setCategory(null);
              setStep(2);
            }}
          />
        </Step>
      )}

      {step === 2 && (
        <Step title="Индивидуально или в группе?" subtitle="Это можно изменить позже">
          <ChoiceCard
            title="Индивидуально"
            description="Программа под вас и максимум внимания преподавателя."
            art="🎯"
            tint="#10B981"
            ribbon="рекомендуем"
            onClick={() => {
              tap();
              setMode('INDIVIDUAL');
              setStep(3);
            }}
          />
          <ChoiceCard
            title="В группе"
            description="Дешевле, и учиться вместе с другими интереснее."
            art="👥"
            tint="#6C5CE7"
            onClick={() => {
              tap();
              setMode('GROUP');
              setStep(3);
            }}
          />
          <SkipLink
            label="Пропустить и показать всё"
            onClick={() => {
              tap();
              setMode(null);
              setStep(3);
            }}
          />
        </Step>
      )}

      {/* Последний экран отвечает на вопрос, который держит новичка сильнее
          цены: «а что вообще будет происходить?». Конкретика тут работает
          лучше любых обещаний. */}
      {step === 3 && (
        <Step title="Что будет на первом занятии?" subtitle="Три шага, всё займёт около часа">
          <ol className="border-hairline bg-surface flex flex-col gap-4 rounded-3xl border p-5">
            {[
              'Определим ваш уровень и цели — без оценок и экзаменов.',
              'Покажем, как проходит занятие и как пользоваться приложением.',
              'Подберём преподавателя и составим программу под вас.',
            ].map((text, i) => (
              <li key={i} className="flex gap-3">
                <span className="bg-brand/15 text-brand-400 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm leading-snug text-[color:var(--text)]">{text}</span>
              </li>
            ))}
          </ol>

          <div className="mt-auto pt-6">
            <Button size="lg" onClick={finish} loading={save.isPending}>
              Подобрать курс
            </Button>
          </div>
        </Step>
      )}
    </div>
  );
}

function cxProgress(filled: boolean): string {
  return `h-1.5 flex-1 rounded-full ${filled ? 'bg-brand' : 'bg-hairline'}`;
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="mb-2">
        {/* Заголовок крупный: на экране выбора он единственная точка входа
            в смысл, и мелкий кегль превращает шаг в анкету. */}
        <h1 className="text-3xl font-bold leading-tight text-[color:var(--text)]">{title}</h1>
        <p className="text-muted mt-2 text-base">{subtitle}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </div>
  );
}

function SkipLink({ label = 'Пропустить', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press text-muted mx-auto mt-2 py-2 text-sm font-medium">
      {label} →
    </button>
  );
}
