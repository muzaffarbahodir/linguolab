/**
 * AdminStudents — поиск и список студентов.
 * MANAGER / ADMIN / SUPER_ADMIN.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useAdminStudents } from '../../api/admin';
import { useAwardPoints } from '../../api/points';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { toast } from '../../store/toast';

// Скачать CSV (через axios с Bearer-токеном)
async function downloadCsv(endpoint: string, filename: string, onError: () => void) {
  try {
    const res = await apiClient.get<Blob>(endpoint, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    WebApp.HapticFeedback.notificationOccurred('success');
  } catch {
    onError();
  }
}

export function AdminStudentsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canExport = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useAdminStudents(page, debouncedSearch || undefined);

  const award = useAwardPoints();
  const [awardFor, setAwardFor] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  useBackButton(() => navigate('/admin'));

  const submitAward = () => {
    if (!awardFor) return;
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    award.mutate(
      { user_id: awardFor.id, amount: amt, description: desc.trim() || undefined },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          toast.success(t('admin.points_award.done', { n: amt }));
          setAwardFor(null);
        },
        onError: () => toast.error(t('app.server_error')),
      },
    );
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => setDebouncedSearch(val), 400));
  };

  const pages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">🎓 {t('admin.students.title')}</h1>
          <p className="text-tg-hint mt-0.5 text-sm">
            {data ? t('admin.students.count', { n: data.total }) : t('admin.students.loading')}
          </p>
        </div>
        {canExport && (
          <button
            onClick={() =>
              downloadCsv('/admin/students/export', `students-${Date.now()}.csv`, () =>
                WebApp.showAlert(t('admin.students.export_error')),
              )
            }
            className="bg-ok/15 text-ok press rounded-xl px-3 py-1.5 text-xs font-semibold"
          >
            📥 CSV
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('admin.students.search_ph')}
          className="bg-surface-2 border-hairline w-full rounded-2xl border py-3 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">👤</p>
          <p className="text-tg-hint text-sm">
            {debouncedSearch ? t('admin.students.empty_search') : t('admin.students.empty_all')}
          </p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {data.items.map((s) => {
            const initials =
              (s.first_name[0] ?? '?').toUpperCase() + (s.last_name?.[0]?.toUpperCase() ?? '');

            return (
              <div key={s.id} className="glass-card rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="bg-brand/20 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {s.first_name} {s.last_name ?? ''}
                    </p>
                    <p className="text-tg-hint text-xs">
                      {s.telegram_username ? `@${s.telegram_username} · ` : ''}
                      ID: {s.telegram_user_id}
                    </p>
                    <p className="text-tg-hint text-xs">
                      {new Date(s.created_at).toLocaleDateString(i18n.language)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAwardFor({
                        id: s.id,
                        name: `${s.first_name} ${s.last_name ?? ''}`.trim(),
                      });
                      setAmount('');
                      setDesc('');
                    }}
                    aria-label={t('admin.points_award.title')}
                    className="bg-warn/15 text-warn press shrink-0 rounded-lg px-2 py-1 text-sm font-semibold"
                  >
                    🎁
                  </button>
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.is_active ? '#10B981' : '#EF4444' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Начисление баллов */}
      {awardFor && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/65"
          onClick={() => setAwardFor(null)}
        >
          <div
            className="w-full rounded-t-3xl px-5 pb-10 pt-5"
            style={{ background: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <h2 className="mb-1 font-bold">🎁 {t('admin.points_award.title')}</h2>
            <p className="text-muted mb-4 text-xs">{awardFor.name}</p>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('admin.points_award.amount_ph')}
              className="bg-surface-2 border-hairline mb-3 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t('admin.points_award.desc_ph')}
              className="bg-surface-2 border-hairline mb-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
            <button
              onClick={submitAward}
              disabled={award.isPending || !amount}
              className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#fbbf24)' }}
            >
              {award.isPending ? '…' : t('admin.points_award.confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="glass-option press rounded-xl px-4 py-2 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-tg-hint text-sm">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="glass-option press rounded-xl px-4 py-2 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
