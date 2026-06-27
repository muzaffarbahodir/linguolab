/**
 * AdminEnrollments — управление зачислениями студентов.
 * PENDING → ACTIVE (подтвердить) / ACTIVE → DROPPED (отчислить)
 * Route: /admin/enrollments
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useAllEnrollments,
  useUpdateEnrollmentStatus,
  type ManagerEnrollment,
} from '../../api/enrollments';

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  ACTIVE: '#10B981',
  DROPPED: '#EF4444',
};

function EnrollmentCard({ enrollment }: { enrollment: ManagerEnrollment }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateEnrollmentStatus();
  const color = STATUS_COLOR[enrollment.status] ?? '#C8623F';
  const langColor = enrollment.class.language.color ?? '#C8623F';

  function act(status: 'ACTIVE' | 'DROPPED') {
    const qKey = status === 'ACTIVE' ? 'admin.enrollments.confirm_q' : 'admin.enrollments.drop_q';
    const msg = t(qKey, {
      name: enrollment.student.first_name,
      class: enrollment.class.title,
    });
    WebApp.showConfirm(msg, (ok) => {
      if (!ok) return;
      update.mutate(
        { id: enrollment.id, status },
        {
          onSuccess: () => WebApp.HapticFeedback.notificationOccurred('success'),
          onError: () => WebApp.showAlert(t('admin.enrollments.status_error')),
        },
      );
    });
  }

  const date = new Date(enrollment.enrolled_at).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="bg-surface border-hairline rounded-2xl border p-4">
      {/* Student */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#C8623F,#E0875A)' }}
          >
            {enrollment.student.first_name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {enrollment.student.first_name} {enrollment.student.last_name ?? ''}
            </p>
            {enrollment.student.telegram_username && (
              <p className="text-muted text-xs">@{enrollment.student.telegram_username}</p>
            )}
          </div>
        </div>
        <span
          className="rounded-lg px-2 py-0.5 text-xs font-bold"
          style={{ background: `${color}22`, color }}
        >
          {t(`schedule.status_${enrollment.status.toLowerCase()}`)}
        </span>
      </div>

      {/* Class info */}
      <div
        className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: `${langColor}14` }}
      >
        <span>{enrollment.class.language.flag_emoji}</span>
        <div className="flex-1">
          <p className="text-xs font-semibold">{enrollment.class.title}</p>
          <p className="text-muted text-[10px]">
            {enrollment.class.language.name_ru} · {enrollment.class.level}
          </p>
        </div>
        <p className="text-faint text-[10px]">{date}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {enrollment.status === 'PENDING' && (
          <button
            onClick={() => act('ACTIVE')}
            disabled={update.isPending}
            className="bg-ok/15 text-ok press flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-40"
          >
            {t('admin.enrollments.confirm')}
          </button>
        )}
        {enrollment.status === 'ACTIVE' && (
          <button
            onClick={() => act('DROPPED')}
            disabled={update.isPending}
            className="bg-danger/10 text-danger press flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-40"
          >
            {t('admin.enrollments.drop')}
          </button>
        )}
        {enrollment.status === 'DROPPED' && (
          <button
            onClick={() => act('ACTIVE')}
            disabled={update.isPending}
            className="bg-ok/10 text-ok press flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-40"
          >
            {t('admin.enrollments.restore')}
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminEnrollmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>('PENDING');
  const { data, isLoading, isError } = useAllEnrollments(activeTab);

  const STATUS_TABS: { key: string | undefined; label: string }[] = [
    { key: undefined, label: t('courses.all') },
    { key: 'PENDING', label: '⏳ ' + t('schedule.status_pending') },
    { key: 'ACTIVE', label: '✅ ' + t('schedule.status_active') },
    { key: 'DROPPED', label: '❌ ' + t('schedule.status_dropped') },
  ];

  useBackButton(() => navigate('/admin'));

  const pending = data?.filter((e) => e.status === 'PENDING').length ?? 0;

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📋 {t('admin.enrollments.title')}</h1>
            {pending > 0 && (
              <p className="text-warn text-xs">
                {t('admin.enrollments.pending_count', { n: pending })}
              </p>
            )}
          </div>
          {data && (
            <span className="text-muted text-xs">
              {t('admin.enrollments.records', { n: data.length })}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={String(tab.key)}
                onClick={() => setActiveTab(tab.key)}
                className={`press shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  active ? 'bg-brand text-white' : 'bg-brand/10 text-muted'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="stagger flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && (
          <p className="text-muted py-10 text-center text-sm">
            {t('admin.enrollments.load_error')}
          </p>
        )}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">📋</span>
            <p className="font-bold">{t('admin.enrollments.no_records')}</p>
            <p className="text-muted text-sm">{t('admin.enrollments.no_records_sub')}</p>
          </div>
        )}

        {data?.map((e) => (
          <EnrollmentCard key={e.id} enrollment={e} />
        ))}
      </div>
    </div>
  );
}
