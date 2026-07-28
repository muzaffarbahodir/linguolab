import { useNavigate } from 'react-router-dom';
import { Laptop, MapPin, Star } from 'lucide-react';

import { useRecommendedClasses, type MatchReason, type RecommendedClass } from '../api/classes';
import { useMe, useSetStudyFormat, type StudyFormat } from '../api/users';
import { useCurrency } from '../hooks/useCurrency';
import { toast } from '../store/toast';
import { Badge, Button, Card, SectionHeader, cx } from './ui';

const DAY_SHORT: Record<string, string> = {
  MON: 'Пн',
  TUE: 'Вт',
  WED: 'Ср',
  THU: 'Чт',
  FRI: 'Пт',
  SAT: 'Сб',
  SUN: 'Вс',
};

/**
 * Подписи к причинам подбора.
 *
 * Показываем не балл, а словами: «12 баллов совпадения» ничего не значит для
 * человека, «подходит по вашим дням» — значит.
 */
const REASON_LABEL: Partial<Record<MatchReason, string>> = {
  LEVEL_EXACT: 'ваш уровень',
  LEVEL_NEAR: 'близкий уровень',
  DAYS_ALL: 'в ваши дни',
  DAYS_SOME: 'частично в ваши дни',
  TIME: 'в удобное время',
};

/** Причины, ради которых стоит занимать место на карточке. */
function visibleReasons(reasons: MatchReason[]): string[] {
  return reasons
    .map((r) => REASON_LABEL[r])
    .filter((label): label is string => !!label)
    .slice(0, 2);
}

function ClassRow({ cls, onOpen }: { cls: RecommendedClass; onOpen: () => void }) {
  const { fmt } = useCurrency();
  const reasons = visibleReasons(cls.match_reasons);
  const online = cls.format === 'ONLINE';

  return (
    <Card interactive onClick={onOpen} padding="sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{cls.language.flag_emoji}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">
              {cls.title}
            </p>
            <span className="shrink-0 text-sm font-bold text-[color:var(--text)]">
              {fmt(cls.price_uzs)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span
              className={cx(
                'inline-flex items-center gap-1 font-medium',
                online ? 'text-brand-400' : 'text-muted',
              )}
            >
              {online ? <Laptop size={12} /> : <MapPin size={12} />}
              {online ? 'Онлайн' : 'Очно'}
            </span>
            <span className="text-faint">{cls.level}</span>
            {cls.schedule_days.length > 0 && (
              <span className="text-faint">
                {cls.schedule_days.map((d) => DAY_SHORT[d] ?? d).join(' ')}
                {cls.schedule_time ? ` · ${cls.schedule_time}` : ''}
              </span>
            )}
            {cls.teacher.avg_rating !== null && (
              <span className="text-warn inline-flex items-center gap-0.5">
                <Star size={11} fill="currentColor" />
                {cls.teacher.avg_rating}
              </span>
            )}
          </div>

          {reasons.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reasons.map((r) => (
                <Badge key={r} tone="ok">
                  {r}
                </Badge>
              ))}
              {cls.is_full && <Badge tone="warn">мест нет</Badge>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * «Вам подойдёт» — курсы в порядке пригодности.
 *
 * Появился потому, что ответы стартового опроса никуда не влияли: студент
 * выбирал онлайн и всё равно видел общий каталог в порядке добавления.
 *
 * Формат в подборе весит больше всего, так что выбравший онлайн видит онлайн
 * первым. Очные курсы при этом не прячутся — они просто ниже, и переключатель
 * рядом меняет предпочтение одним нажатием.
 */
export function RecommendedClasses() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const setFormat = useSetStudyFormat();
  // Пока опрос не пройден, предпочтений нет и подбор выродится в общий
  // каталог — показывать его как «вам подойдёт» было бы неправдой.
  const enabled = !!me?.discovery_done_at;
  const { data: classes, isLoading } = useRecommendedClasses(enabled);

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Вам подойдёт" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!classes?.length) return null;

  const current: StudyFormat = me?.study_format ?? 'OFFLINE';
  const other: StudyFormat = current === 'ONLINE' ? 'OFFLINE' : 'ONLINE';

  const switchFormat = () => {
    setFormat.mutate(other, {
      onSuccess: () =>
        toast.success(other === 'ONLINE' ? 'Показываем онлайн-курсы' : 'Показываем очные курсы'),
      onError: () => toast.error('Не удалось переключить'),
    });
  };

  return (
    <div>
      <SectionHeader
        title="Вам подойдёт"
        hint={current === 'ONLINE' ? 'Сначала онлайн-курсы' : 'Сначала очные курсы'}
      />

      <div className="flex flex-col gap-2">
        {classes.slice(0, 4).map((cls) => (
          <ClassRow key={cls.id} cls={cls} onOpen={() => navigate(`/course/${cls.language.id}`)} />
        ))}
      </div>

      {/*
        Переключатель под списком, а не над ним: сверху он читался бы как
        фильтр каталога, тогда как это смена предпочтения в профиле — она
        меняет выдачу и здесь, и на всех остальных экранах.
      */}
      <Button
        variant="ghost"
        size="lg"
        className="mt-2"
        onClick={switchFormat}
        loading={setFormat.isPending}
        leftIcon={other === 'ONLINE' ? <Laptop size={15} /> : <MapPin size={15} />}
      >
        {other === 'ONLINE' ? 'Хочу учиться онлайн' : 'Хочу учиться очно'}
      </Button>
    </div>
  );
}
