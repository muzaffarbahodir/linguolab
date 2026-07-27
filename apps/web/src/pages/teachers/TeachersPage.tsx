import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Star, Video } from 'lucide-react';

import { useTeachers, type TeacherProfile } from '../../api/teachers';
import { useBackButton } from '../../hooks/useBackButton';
import { EmptyState } from '../../components/EmptyState';
import { Badge, Card, SectionHeader } from '../../components/ui';

/**
 * Карточка в списке — сокращённая витрина.
 *
 * Показывает ровно то, по чему отсеивают на первом экране: имя,
 * специализацию, рейтинг и сколько уроков уже проведено. Остальное — внутри
 * профиля, иначе список превращается в стену текста.
 */
function TeacherCard({ teacher, onOpen }: { teacher: TeacherProfile; onOpen: () => void }) {
  const { t } = useTranslation();
  const fullName = `${teacher.user.first_name} ${teacher.user.last_name ?? ''}`.trim();
  const photo = teacher.photo_url ?? teacher.user.avatar_url;

  return (
    <Card interactive onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {photo ? (
            <img src={photo} alt={fullName} className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="bg-brand/15 text-brand-400 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold">
              {teacher.user.first_name[0]}
            </div>
          )}
          {/* Значок видео — заметная причина открыть именно этот профиль. */}
          {teacher.intro_video_url && (
            <span className="bg-brand absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white">
              <Video size={12} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-[color:var(--text)]">{fullName}</h3>
            <ChevronRight size={15} className="text-faint ml-auto shrink-0" />
          </div>

          {teacher.headline && (
            <p className="text-muted mt-0.5 line-clamp-2 text-xs leading-snug">
              {teacher.headline}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {teacher.avg_rating !== null ? (
              <span className="text-warn flex items-center gap-0.5 font-semibold">
                <Star size={12} fill="currentColor" />
                {teacher.avg_rating}
                <span className="text-faint font-normal">({teacher.ratings_count})</span>
              </span>
            ) : (
              <span className="text-faint">{t('teacher.no_ratings')}</span>
            )}
            {teacher.lessons_conducted > 0 && (
              <span className="text-faint">
                {teacher.lessons_conducted} {t('teacher.stat_lessons')}
              </span>
            )}
            {teacher.experience_years !== null && (
              <span className="text-faint">
                {teacher.experience_years} {t('teacher.stat_experience')}
              </span>
            )}
          </div>

          {teacher.specializations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {teacher.specializations.slice(0, 3).map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Каталог преподавателей.
 *
 * До него профиль открывался только из своего класса или расписания — то есть
 * когда выбор уже сделан. Каталог даёт посмотреть на преподавателей до
 * записи, а это и есть тот момент, ради которого профиль заполняют.
 */
export function TeachersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: teachers, isLoading, isError } = useTeachers();

  useBackButton(() => navigate(-1));

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-10 pt-4">
      <SectionHeader title={t('teacher.catalog_title')} hint={t('teacher.catalog_sub')} />

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState emoji="⚠️" title={t('teacher.catalog_empty')} />}

      {!isLoading && teachers?.length === 0 && (
        <EmptyState emoji="🧑‍🏫" title={t('teacher.catalog_empty')} />
      )}

      <div className="stagger flex flex-col gap-3">
        {teachers?.map((teacher) => (
          <TeacherCard
            key={teacher.id}
            teacher={teacher}
            onOpen={() => navigate(`/teachers/${teacher.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
