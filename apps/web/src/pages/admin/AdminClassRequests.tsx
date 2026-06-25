/**
 * AdminClassRequests — список заявок учителей на открытие курсов.
 * Route: /admin/class-requests
 * Доступ: MANAGER, ADMIN, SUPER_ADMIN
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useAdminClassRequests,
  useApproveClassRequest,
  useRejectClassRequest,
  type ClassRequestItem,
} from '../../api/admin';
import { toast } from '../../store/toast';

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
};

const inputCls =
  'bg-surface-2 border-hairline w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none';
const dtCls =
  'bg-surface-2 border-hairline w-full rounded-xl border px-2 py-2 text-xs text-white outline-none';

// ── Approve Modal ─────────────────────────────────────────────────────────────

function ApproveModal({ req, onClose }: { req: ClassRequestItem; onClose: () => void }) {
  const { t } = useTranslation();
  const approve = useApproveClassRequest();

  const [priceUzs, setPriceUzs] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [semesterLabel, setSemesterLabel] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [enrollmentOpens, setEnrollmentOpens] = useState('');
  const [enrollmentCloses, setEnrollmentCloses] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [adminNote, setAdminNote] = useState('');

  function handleApprove() {
    const uzs = parseInt(priceUzs, 10);
    const usd = parseInt(priceUsd, 10);
    if (isNaN(uzs) || uzs <= 0 || isNaN(usd) || usd <= 0) {
      toast.error(t('admin_cr.err_prices'));
      return;
    }

    approve.mutate(
      {
        id: req.id,
        price_uzs: uzs,
        price_usd: usd,
        semester_label: semesterLabel || undefined,
        enrollment_opens_at: enrollmentOpens || undefined,
        enrollment_closes_at: enrollmentCloses || undefined,
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
        admin_note: adminNote || undefined,
      },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          onClose();
        },
        onError: () => toast.error(t('admin_cr.err_approve')),
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="mb-1 font-bold">{t('admin_cr.approve_title')}</h2>
        <p className="text-muted mb-4 text-sm">
          {req.language.flag_emoji} {req.title} · {req.level}
        </p>

        {/* Цены */}
        <p className="text-muted mb-1 text-xs font-semibold">{t('admin_cr.prices_label')}</p>
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <p className="text-faint mb-1 text-xs">{t('admin_cr.uzs_label')}</p>
            <input
              value={priceUzs}
              onChange={(e) => setPriceUzs(e.target.value)}
              placeholder="500 000"
              type="number"
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <p className="text-faint mb-1 text-xs">{t('admin_cr.usd_label')}</p>
            <input
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="40"
              type="number"
              className={inputCls}
            />
          </div>
        </div>

        {/* Семестр */}
        <p className="text-muted mb-1 text-xs font-semibold">{t('admin_cr.semester_label')}</p>
        <input
          value={semesterLabel}
          onChange={(e) => setSemesterLabel(e.target.value)}
          placeholder="2026-07"
          className={`${inputCls} mb-3`}
        />

        {/* Даты */}
        <p className="text-muted mb-1 text-xs font-semibold">{t('admin_cr.dates_label')}</p>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <p className="text-faint mb-1 text-xs">{t('admin_cr.enroll_open')}</p>
            <input
              type="datetime-local"
              value={enrollmentOpens}
              onChange={(e) => setEnrollmentOpens(e.target.value)}
              className={dtCls}
            />
          </div>
          <div>
            <p className="text-faint mb-1 text-xs">{t('admin_cr.enroll_close')}</p>
            <input
              type="datetime-local"
              value={enrollmentCloses}
              onChange={(e) => setEnrollmentCloses(e.target.value)}
              className={dtCls}
            />
          </div>
          <div>
            <p className="text-faint mb-1 text-xs">{t('admin_cr.sem_start')}</p>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={dtCls}
            />
          </div>
          <div>
            <p className="text-faint mb-1 text-xs">{t('admin_cr.sem_end')}</p>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={dtCls}
            />
          </div>
        </div>

        {/* Комментарий */}
        <p className="text-muted mb-1 text-xs">{t('admin_cr.note_label')}</p>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder={t('admin_cr.note_ph')}
          rows={2}
          className={`${inputCls} mb-4 resize-none`}
        />

        <button
          onClick={handleApprove}
          disabled={approve.isPending || !priceUzs || !priceUsd}
          className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
        >
          {approve.isPending ? '...' : t('admin_cr.approve_create')}
        </button>
      </div>
    </div>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({ req }: { req: ClassRequestItem }) {
  const { t } = useTranslation();
  const reject = useRejectClassRequest();
  const [showApprove, setShowApprove] = useState(false);

  const statusColor = STATUS_COLOR[req.status] ?? '#fff';
  const statusLabel = t(`admin_cr.status_${req.status}`);

  function handleReject() {
    WebApp.showConfirm(t('admin_cr.reject_confirm', { title: req.title }), (ok) => {
      if (!ok) return;
      reject.mutate(
        { id: req.id },
        {
          onSuccess: () => WebApp.HapticFeedback.notificationOccurred('success'),
          onError: () => toast.error(t('admin_cr.err_reject')),
        },
      );
    });
  }

  return (
    <>
      <div className="bg-surface border-hairline rounded-2xl border p-4">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span>{req.language.flag_emoji}</span>
              <span className="font-semibold">{req.title}</span>
              <span className="bg-brand/20 text-brand-400 rounded-full px-1.5 py-0.5 text-xs font-bold">
                {req.level}
              </span>
            </div>
            <p className="text-muted mt-0.5 text-xs">
              👤 {req.teacher.user.first_name} {req.teacher.user.last_name ?? ''}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: `${statusColor}22`,
              color: statusColor,
              border: `1px solid ${statusColor}44`,
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Meta */}
        <div className="text-muted mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {req.schedule_days.length > 0 && <span>📅 {req.schedule_days.join(', ')}</span>}
          {req.schedule_time && <span>🕐 {req.schedule_time}</span>}
          {req.max_students && <span>👥 {t('admin_cr.seats_to', { n: req.max_students })}</span>}
        </div>

        {req.description && (
          <p className="text-muted mb-2 text-xs leading-relaxed">{req.description}</p>
        )}

        {req.note && (
          <p className="bg-surface text-muted mb-2 rounded-xl p-2 text-xs">💬 {req.note}</p>
        )}

        {req.admin_note && (
          <p className="bg-ok/5 mb-2 rounded-xl p-2 text-xs" style={{ color: '#6EE7B7' }}>
            ✅ {req.admin_note}
          </p>
        )}

        {req.approved_class && (
          <p className="text-ok mb-2 text-xs">
            {t('admin_cr.class_created', { title: req.approved_class.title })}
          </p>
        )}

        {/* Actions */}
        {req.status === 'PENDING' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowApprove(true)}
              className="press flex-1 rounded-xl py-2 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
            >
              {t('admin_cr.approve')}
            </button>
            <button
              onClick={handleReject}
              disabled={reject.isPending}
              className="bg-danger/15 text-danger press flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
            >
              {t('admin_cr.reject')}
            </button>
          </div>
        )}
      </div>

      {showApprove && <ApproveModal req={req} onClose={() => setShowApprove(false)} />}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminClassRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>('PENDING');
  const { data: requests, isLoading } = useAdminClassRequests(statusFilter);

  useBackButton(() => navigate('/admin/classes'));

  const tabs: { label: string; value: string | undefined }[] = [
    { label: t('admin_cr.tab_pending'), value: 'PENDING' },
    { label: t('admin_cr.tab_all'), value: undefined },
    { label: t('admin_cr.tab_approved'), value: 'APPROVED' },
    { label: t('admin_cr.tab_rejected'), value: 'REJECTED' },
  ];

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <h1 className="mb-3 text-lg font-bold">📋 {t('admin_cr.title')}</h1>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={String(tab.value)}
              onClick={() => setStatusFilter(tab.value)}
              className={`press shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                statusFilter === tab.value ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {!isLoading && requests?.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">📋</span>
            <p className="font-bold">{t('admin_cr.empty')}</p>
          </div>
        )}

        {requests?.map((req) => (
          <RequestCard key={req.id} req={req} />
        ))}
      </div>
    </div>
  );
}
