/**
 * AdminCertificates — выдача сертификатов студентам.
 * Два режима:
 *  1. По классу — выбрать класс → список его студентов
 *  2. Поиск — глобально найти студента → выбрать класс → выдать
 * Route: /admin/certificates
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useAdminClasses, useAdminStudents } from '../../api/admin';
import { useClassStudents, useIssueCertificate } from '../../api/teacher';

// ─── StudentCertCard ──────────────────────────────────────────────────────────

function StudentCertCard({
  student,
  classId,
  className,
}: {
  student: {
    id: string;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
  };
  classId: string;
  className: string;
}) {
  const { t } = useTranslation();
  const issue = useIssueCertificate();
  const [issued, setIssued] = useState(false);

  function handleIssue() {
    WebApp.showConfirm(
      t('admin.certificates.issue_confirm', {
        name: `${student.first_name} ${student.last_name ?? ''}`.trim(),
      }) + ` («${className}»)`,
      (ok) => {
        if (!ok) return;
        issue.mutate(
          { student_id: student.id, class_id: classId },
          {
            onSuccess: () => {
              WebApp.HapticFeedback.notificationOccurred('success');
              setIssued(true);
            },
            onError: (err: unknown) => {
              const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                t('admin.certificates.issue_error');
              WebApp.showAlert(msg);
            },
          },
        );
      },
    );
  }

  const name = `${student.first_name} ${student.last_name ?? ''}`.trim();

  return (
    <div className="bg-surface border-hairline flex items-center gap-3 rounded-2xl border p-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: 'linear-gradient(135deg,#C8623F,#E0875A)' }}
      >
        {student.avatar_url ? (
          <img src={student.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          name[0]?.toUpperCase()
        )}
      </div>
      <p className="flex-1 text-sm font-medium">{name}</p>

      {issued ? (
        <span className="text-ok text-xs font-bold">{t('admin.certificates.issued_short')}</span>
      ) : (
        <button
          onClick={handleIssue}
          disabled={issue.isPending}
          className="bg-brand/20 text-brand-400 press rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          {issue.isPending ? '...' : t('admin.certificates.issue_short')}
        </button>
      )}
    </div>
  );
}

// ─── ClassStudentsList ────────────────────────────────────────────────────────

function ClassStudentsList({
  classId,
  className,
  filter,
}: {
  classId: string;
  className: string;
  filter: string;
}) {
  const { t } = useTranslation();
  const { data: students, isLoading } = useClassStudents(classId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
      </div>
    );
  }

  if (!students?.length) {
    return (
      <p className="text-muted py-8 text-center text-sm">{t('admin.certificates.no_students')}</p>
    );
  }

  const filtered = filter
    ? students.filter((s) => {
        const name = `${s.first_name} ${s.last_name ?? ''}`.toLowerCase();
        return name.includes(filter.toLowerCase());
      })
    : students;

  if (!filtered.length) {
    return (
      <p className="text-muted py-8 text-center text-sm">{t('admin.certificates.nothing_found')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((s) => (
        <StudentCertCard key={s.id} student={s} classId={classId} className={className} />
      ))}
    </div>
  );
}

// ─── GlobalSearchPanel ────────────────────────────────────────────────────────

function GlobalSearchPanel({
  search,
  classes,
  onPickClass,
}: {
  search: string;
  classes: { id: string; title: string; language: { flag_emoji: string }; level: string }[];
  onPickClass: (classId: string, studentId: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminStudents(1, search.length >= 2 ? search : undefined);

  if (search.length < 2) {
    return (
      <p className="text-muted py-8 text-center text-sm">{t('admin.certificates.min_chars')}</p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <p className="text-muted py-8 text-center text-sm">
        {t('admin.certificates.students_not_found')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.items.map((s) => (
        <FoundStudentRow
          key={s.id}
          student={s}
          classes={classes}
          onPick={(classId) => onPickClass(classId, s.id)}
        />
      ))}
    </div>
  );
}

function FoundStudentRow({
  student,
  classes,
  onPick,
}: {
  student: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
  };
  classes: { id: string; title: string; language: { flag_emoji: string }; level: string }[];
  onPick: (classId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const name = `${student.first_name} ${student.last_name ?? ''}`.trim();

  return (
    <div className="bg-surface border-hairline rounded-2xl border p-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#C8623F,#E0875A)' }}
        >
          {name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {student.telegram_username && (
            <p className="text-muted text-xs">@{student.telegram_username}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="bg-brand/20 text-brand-400 press rounded-xl px-3 py-1.5 text-xs font-semibold"
        >
          {expanded ? '✕' : t('admin.certificates.class_btn')}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-muted mb-1 text-[10px] font-semibold uppercase">
            {t('admin.certificates.select_class_for_cert')}
          </p>
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onPick(c.id);
                setExpanded(false);
              }}
              className="bg-surface press flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs"
            >
              <span>{c.language.flag_emoji}</span>
              <span className="flex-1 font-medium">{c.title}</span>
              <span className="text-muted">{c.level}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Mode = 'by-class' | 'search';

export function AdminCertificatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('by-class');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [filter, setFilter] = useState('');
  const { data: classes, isLoading: classesLoading } = useAdminClasses(1);
  const issue = useIssueCertificate();

  useBackButton(() => navigate('/admin'));

  const activeClasses = classes?.items.filter((c) => c.is_active) ?? [];
  const selected = activeClasses.find((c) => c.id === selectedClass);

  function handleGlobalIssue(classId: string, studentId: string) {
    const cls = activeClasses.find((c) => c.id === classId);
    if (!cls) return;
    WebApp.showConfirm(t('admin.certificates.issue_confirm_class', { class: cls.title }), (ok) => {
      if (!ok) return;
      issue.mutate(
        { student_id: studentId, class_id: classId },
        {
          onSuccess: () => {
            WebApp.HapticFeedback.notificationOccurred('success');
            WebApp.showAlert(t('admin.certificates.issued_alert'));
          },
          onError: (err: unknown) => {
            const msg =
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              t('admin.certificates.issue_error');
            WebApp.showAlert(msg);
          },
        },
      );
    });
  }

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <h1 className="text-lg font-bold">{t('admin.certificates.page_title')}</h1>

        {/* Mode tabs */}
        <div className="mt-3 flex gap-1.5">
          <button
            onClick={() => setMode('by-class')}
            className={`press flex-1 rounded-xl py-2 text-xs font-semibold ${
              mode === 'by-class' ? 'bg-brand text-white' : 'bg-brand/10 text-muted'
            }`}
          >
            {t('admin.certificates.tab_by_class')}
          </button>
          <button
            onClick={() => setMode('search')}
            className={`press flex-1 rounded-xl py-2 text-xs font-semibold ${
              mode === 'search' ? 'bg-brand text-white' : 'bg-brand/10 text-muted'
            }`}
          >
            {t('admin.certificates.tab_search')}
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {mode === 'by-class' ? (
          <>
            <p className="text-muted mb-2 text-xs font-semibold">
              {t('admin.certificates.class_label')}
            </p>
            {classesLoading ? (
              <div className="skeleton h-12 rounded-2xl" />
            ) : (
              <div className="mb-4 flex flex-col gap-2">
                {activeClasses.map((cls) => {
                  const color = cls.language.color ?? '#C8623F';
                  const active = selectedClass === cls.id;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClass(cls.id)}
                      className="press flex items-center gap-3 rounded-2xl p-3 text-left transition-colors"
                      style={{
                        background: active ? `${color}22` : 'var(--surface-2)',
                        border: `1px solid ${active ? color + '55' : 'var(--surface-2)'}`,
                      }}
                    >
                      <span className="text-xl">{cls.language.flag_emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{cls.title}</p>
                        <p className="text-muted text-xs">
                          {cls.language.name_ru} · {cls.level} ·{' '}
                          {t('admin.certificates.students_count', { n: cls.enrolled_count })}
                        </p>
                      </div>
                      {active && (
                        <span className="text-xs font-bold" style={{ color }}>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedClass && selected && (
              <>
                <div className="bg-brand/10 mb-3 flex items-center gap-2 rounded-xl px-3 py-2">
                  <span className="text-base">{selected.language.flag_emoji}</span>
                  <p className="text-sm font-semibold">{selected.title}</p>
                  <span className="text-muted ml-auto text-xs">
                    {t('admin.certificates.students_count', { n: selected.enrolled_count })}
                  </span>
                </div>

                {/* Filter within class */}
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t('admin.certificates.filter_name_ph')}
                  className="bg-surface-2 border-hairline mb-3 w-full rounded-xl border px-3 py-2 text-sm text-white outline-none"
                />

                <ClassStudentsList
                  classId={selectedClass}
                  className={selected.title}
                  filter={filter}
                />
              </>
            )}

            {!selectedClass && !classesLoading && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="text-5xl">🎓</span>
                <p className="font-bold">{t('admin.certificates.select_class')}</p>
                <p className="text-muted text-sm">{t('admin.certificates.select_class_sub')}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('admin.certificates.search_name_ph')}
              className="bg-surface-2 border-hairline mb-4 w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none"
            />
            <GlobalSearchPanel
              search={filter}
              classes={activeClasses}
              onPickClass={handleGlobalIssue}
            />
          </>
        )}
      </div>
    </div>
  );
}
