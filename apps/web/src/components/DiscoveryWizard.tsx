/**
 * DiscoveryWizard — подбор курса для нового клиента (показывается один раз).
 *
 * Не карусель «полистай про наши преимущества», а воронка выбора: на каждом
 * экране нужно что-то выбрать. Так человек вовлекается, а мы попутно узнаём
 * всё, что нужно для подбора, — вместо того чтобы спрашивать это потом.
 *
 * Шаг 1: онлайн/очно            — определяет, что человек увидит первым
 * Шаг 2: направление
 * Шаг 3: зачем учит             — набор целей зависит от направления
 * Шаг 4: индивидуально/группа
 * Шаг 5: свой уровень
 * Шаг 6: удобные дни и время    — по ним подбирается группа
 * Шаг 7: что будет на первом занятии + предложение подтвердить уровень тестом
 *
 * По завершении сохраняет ответы (PATCH /users/me/discovery) → onDone().
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { ChevronLeft } from 'lucide-react';

import { useLanguages, CATEGORY_ORDER, type LanguageCategory } from '../api/languages';
import {
  useSaveDiscovery,
  type CEFRLevel,
  type DiscoveryInput,
  type StudyFormat,
  type StudyMode,
  type TimeSlot,
  type Weekday,
} from '../api/users';
import { GOAL_LABEL, LEVEL_OPTIONS, TIME_SLOTS, WEEKDAYS, goalsFor } from './discovery-goals';
import { Button, ChoiceCard, cx } from './ui';

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

const TOTAL = 7;

export function DiscoveryWizard({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const { data: languages } = useLanguages();
  const save = useSaveDiscovery();

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<StudyFormat | null>(null);
  const [category, setCategory] = useState<LanguageCategory | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [mode, setMode] = useState<StudyMode | null>(null);
  const [level, setLevel] = useState<CEFRLevel | null>(null);
  const [days, setDays] = useState<Weekday[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  // Категории, у которых есть хотя бы одно направление.
  const categories = useMemo(() => {
    const present = new Set((languages ?? []).map((l) => l.category ?? 'LANGUAGES'));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [languages]);

  const goals = useMemo(() => goalsFor(category), [category]);

  const tap = () => WebApp.HapticFeedback?.selectionChanged?.();
  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1));

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  /**
   * Ответы уходят одним запросом в конце — до последнего шага человек может
   * вернуться и передумать, и промежуточные сохранения оставляли бы в базе
   * половину опроса от тех, кто его не закончил.
   *
   * afterSave: тест уровня открываем только после успешной записи, иначе
   * студент уйдёт в тест, а предпочтения потеряются.
   */
  const finish = (afterSave?: () => void) => {
    if (!format || save.isPending) return;
    const dto: DiscoveryInput = {
      study_format: format,
      study_mode: mode,
      preferred_category: category,
      learning_goal: goal,
      self_level: level,
      available_days: days,
      available_slots: slots,
    };
    WebApp.HapticFeedback?.notificationOccurred?.('success');
    const done = () => {
      afterSave?.();
      onDone();
    };
    // И при ошибке продолжаем: держать нового клиента в опросе из-за сбоя
    // сети — верный способ его потерять. Предпочтения он поправит в профиле.
    save.mutate(dto, { onSuccess: done, onError: done });
  };

  return (
    <div className="flex min-h-[85vh] flex-col px-4 pb-8 pt-6">
      <div className="mb-5 flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => {
              tap();
              setStep((s) => s - 1);
            }}
            className="press text-muted -ml-1 shrink-0"
            aria-label="Назад"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} className={cxProgress(i <= step)} />
          ))}
        </div>
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
              next();
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
              next();
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
                // Цель принадлежит направлению: сменив направление, прежний
                // ответ становится бессмысленным и бэк его всё равно отбросит.
                setGoal(null);
                next();
              }}
            />
          ))}
          <SkipLink
            onClick={() => {
              tap();
              setCategory(null);
              setGoal(null);
              next();
            }}
          />
        </Step>
      )}

      {/* Цель — единственный ответ, который не влияет на подбор напрямую,
          зато он нужен преподавателю на первом занятии: программа для
          «сдать IELTS» и для «поговорить в отпуске» разная. */}
      {step === 2 && (
        <Step title="Зачем вам язык?" subtitle="Преподаватель построит программу под эту цель">
          {goals.map((g) => {
            const label = GOAL_LABEL[g];
            if (!label) return null;
            return (
              <ChoiceCard
                key={g}
                title={label.title}
                description={label.description}
                art={label.art}
                tint={category ? CATEGORY_TINT[category] : '#6C5CE7'}
                onClick={() => {
                  tap();
                  setGoal(g);
                  next();
                }}
              />
            );
          })}
          <SkipLink
            onClick={() => {
              tap();
              setGoal(null);
              next();
            }}
          />
        </Step>
      )}

      {step === 3 && (
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
              next();
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
              next();
            }}
          />
          <SkipLink
            label="Пропустить и показать всё"
            onClick={() => {
              tap();
              setMode(null);
              next();
            }}
          />
        </Step>
      )}

      {step === 4 && (
        <Step title="Какой у вас уровень?" subtitle="Примерно — точный определим на тесте">
          <div className="flex flex-col gap-2">
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                onClick={() => {
                  tap();
                  setLevel(opt.level);
                  next();
                }}
                className="press border-hairline bg-surface flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
              >
                <span className="bg-brand/15 text-brand-400 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                  {opt.level}
                </span>
                <span className="text-muted text-sm leading-snug">{opt.hint}</span>
              </button>
            ))}
          </div>
          <SkipLink
            label="Не знаю — определите тестом"
            onClick={() => {
              tap();
              setLevel(null);
              next();
            }}
          />
        </Step>
      )}

      {step === 5 && (
        <Step title="Когда вам удобно?" subtitle="Подберём группу под ваше расписание">
          <div>
            <p className="text-muted mb-2 text-sm font-medium">Дни недели</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ day, short }) => {
                const active = days.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => {
                      tap();
                      setDays((d) => toggle(d, day));
                    }}
                    aria-pressed={active}
                    className={cx(
                      'press h-12 w-12 rounded-2xl border text-sm font-semibold transition-colors',
                      active
                        ? 'bg-brand border-brand text-white'
                        : 'border-hairline bg-surface text-muted',
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-muted mb-2 text-sm font-medium">Время</p>
            <div className="flex flex-col gap-2">
              {TIME_SLOTS.map(({ slot, title, hint, art }) => {
                const active = slots.includes(slot);
                return (
                  <button
                    key={slot}
                    onClick={() => {
                      tap();
                      setSlots((s) => toggle(s, slot));
                    }}
                    aria-pressed={active}
                    className={cx(
                      'press flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                      active ? 'bg-brand/15 border-brand' : 'border-hairline bg-surface',
                    )}
                  >
                    <span className="text-2xl">{art}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[color:var(--text)]">
                        {title}
                      </span>
                      <span className="text-faint block text-xs">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-6">
            {/* Кнопка активна и без выбора: человек может не знать своего
                расписания наперёд, и запирать его на этом шаге незачем —
                подбор просто не станет учитывать время. */}
            <Button
              size="lg"
              onClick={() => {
                tap();
                next();
              }}
            >
              {days.length || slots.length ? 'Дальше' : 'Пока не знаю'}
            </Button>
          </div>
        </Step>
      )}

      {/* Последний экран отвечает на вопрос, который держит новичка сильнее
          цены: «а что вообще будет происходить?». Конкретика тут работает
          лучше любых обещаний. */}
      {step === 6 && (
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

          <div className="mt-auto flex flex-col gap-2 pt-6">
            {/* Тест предлагается первым: уровень со слов студента расходится
                с реальным сплошь и рядом, а группа подбирается по уровню. */}
            <Button
              size="lg"
              onClick={() => finish(() => navigate('/placement-test'))}
              loading={save.isPending}
            >
              Пройти тест уровня
            </Button>
            <button
              onClick={() => finish()}
              disabled={save.isPending}
              className="press text-muted py-2 text-sm font-medium disabled:opacity-50"
            >
              Позже — показать курсы
            </button>
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
