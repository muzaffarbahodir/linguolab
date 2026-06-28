/**
 * AdminPromos — управление промокодами (MANAGER+). Route: /admin/promos
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Plus, Ticket } from 'lucide-react';

import { useBackButton } from '../../hooks/useBackButton';
import { useAdminPromos, useUpsertPromo, useDeletePromo, type PromoCode } from '../../api/promo';

type Draft = {
  id?: string;
  code: string;
  discount_percent: string;
  max_uses: string;
  valid_until: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  code: '',
  discount_percent: '10',
  max_uses: '',
  valid_until: '',
  is_active: true,
};

function toDraft(p: PromoCode): Draft {
  return {
    id: p.id,
    code: p.code,
    discount_percent: String(p.discount_percent),
    max_uses: p.max_uses != null ? String(p.max_uses) : '',
    valid_until: p.valid_until ? p.valid_until.slice(0, 10) : '',
    is_active: p.is_active,
  };
}

export function AdminPromosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: promos, isLoading } = useAdminPromos();
  const upsert = useUpsertPromo();
  const del = useDeletePromo();
  const [draft, setDraft] = useState<Draft | null>(null);

  useBackButton(() => {
    if (draft) setDraft(null);
    else navigate('/admin');
  });

  const handleSave = () => {
    if (!draft) return;
    if (draft.code.trim().length < 2) {
      WebApp.showAlert(t('admin.promos.code_required'));
      return;
    }
    const pct = parseInt(draft.discount_percent, 10);
    const maxUses = parseInt(draft.max_uses, 10);
    const payload = {
      code: draft.code.trim().toUpperCase(),
      discount_percent: Number.isFinite(pct) ? pct : 0,
      max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      valid_until: draft.valid_until || null,
      is_active: draft.is_active,
    };
    upsert.mutate(draft.id ? { id: draft.id, ...payload } : payload, {
      onSuccess: () => setDraft(null),
    });
  };

  const handleDelete = () => {
    if (!draft?.id) return;
    WebApp.showConfirm(t('admin.promos.delete_confirm'), (ok) => {
      if (!ok || !draft.id) return;
      del.mutate(draft.id, { onSuccess: () => setDraft(null) });
    });
  };

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('admin.promos.title')}</h1>
          <p className="text-tg-hint text-sm">{t('admin.promos.desc')}</p>
        </div>
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="glass-btn press flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <Plus size={15} /> {t('admin.promos.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !promos?.length ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">🎟️</p>
          <p className="text-tg-hint text-sm">{t('admin.promos.empty')}</p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {promos.map((p) => (
            <button
              key={p.id}
              onClick={() => setDraft(toDraft(p))}
              className={`glass-card press flex items-center gap-3 rounded-2xl p-3 text-left ${
                p.is_active ? '' : 'opacity-50'
              }`}
            >
              <div className="bg-brand/12 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Ticket size={18} className="text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold">{p.code}</p>
                <p className="text-tg-hint text-xs">
                  −{p.discount_percent}% ·{' '}
                  {t('admin.promos.used', {
                    n: p.used_count,
                    max: p.max_uses ?? '∞',
                  })}
                </p>
              </div>
              {!p.is_active && (
                <span className="bg-surface-2 text-faint rounded-full px-2 py-0.5 text-xs">
                  {t('admin.promos.off')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {draft && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDraft(null);
          }}
        >
          <div
            className="overflow-y-auto rounded-t-3xl p-6"
            style={{
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              background: 'var(--secondary-bg)',
            }}
          >
            <div className="bg-[color:var(--text)]/15 mx-auto mb-4 h-1 w-10 rounded-full" />
            <h3 className="mb-4 text-base font-bold">
              {draft.id ? t('admin.promos.edit') : t('admin.promos.add')}
            </h3>

            <div className="flex flex-col gap-3">
              <Field label={t('admin.promos.f_code')}>
                <input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  className="input font-mono uppercase"
                  placeholder="WELCOME10"
                  maxLength={24}
                />
              </Field>
              <Field label={t('admin.promos.f_discount')}>
                <input
                  value={draft.discount_percent}
                  onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })}
                  className="input"
                  inputMode="numeric"
                  placeholder="10"
                />
              </Field>
              <Field label={t('admin.promos.f_max')}>
                <input
                  value={draft.max_uses}
                  onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })}
                  className="input"
                  inputMode="numeric"
                  placeholder={t('admin.promos.f_max_ph')}
                />
              </Field>
              <Field label={t('admin.promos.f_until')}>
                <input
                  type="date"
                  value={draft.valid_until}
                  onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })}
                  className="input"
                />
              </Field>
              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-medium">{t('admin.promos.f_active')}</span>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-5 w-5 accent-[#6366f1]"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              {draft.id && (
                <button
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="bg-danger/15 text-danger border-danger/30 press rounded-2xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {t('admin.promos.delete')}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="glass-btn press flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-60"
              >
                {upsert.isPending ? t('admin.users.saving') : t('admin.promos.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-tg-hint mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
