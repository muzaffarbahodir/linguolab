/**
 * AdminAudit — журнал аудита действий.
 * ADMIN / SUPER_ADMIN.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';

import { useAuditLog, type AuditEntry } from '../../api/admin';

const ACTION_EMOJI: Record<string, string> = {
  student_deleted: '🗑️',
  teacher_created: '👨‍🏫',
  teacher_deleted: '🗑️',
  class_created: '📚',
  class_deleted: '🗑️',
  role_changed: '🔑',
  user_activated: '✅',
  broadcast_sent: '📢',
};

const ACTION_TKEY: Record<string, string> = {
  student_deleted: 'admin.audit.event_student_deleted',
  teacher_created: 'admin.audit.event_teacher_created',
  teacher_deleted: 'admin.audit.event_teacher_deleted',
  class_created: 'admin.audit.event_class_created',
  class_deleted: 'admin.audit.event_class_deleted',
  role_changed: 'admin.audit.event_role_changed',
  user_activated: 'admin.audit.event_user_activated',
  broadcast_sent: 'admin.audit.event_broadcast_sent',
};

const ACTION_COLOR: Record<string, string> = {
  student_deleted: '#EF4444',
  teacher_created: '#10B981',
  teacher_deleted: '#EF4444',
  class_created: '#3B82F6',
  class_deleted: '#EF4444',
  role_changed: '#F59E0B',
  user_activated: '#10B981',
  broadcast_sent: '#818cf8',
};

export function AdminAuditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLog(page);

  useBackButton(() => navigate('/admin'));

  const pages = data?.pages ?? 1;

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">{t('admin.audit.page_title')}</h1>
        <p className="text-tg-hint mt-0.5 text-sm">
          {data ? t('admin.audit.count', { n: data.total }) : t('admin.audit.loading')}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">📭</p>
          <p className="text-tg-hint text-sm">{t('admin.audit.empty')}</p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {data.items.map((entry) => (
            <AuditCard key={entry.id} entry={entry} />
          ))}
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

function AuditCard({ entry }: { entry: AuditEntry }) {
  const { t, i18n } = useTranslation();
  const emoji = ACTION_EMOJI[entry.action] ?? '📝';
  const tKey = ACTION_TKEY[entry.action];
  const label = tKey ? t(tKey) : entry.action;
  const color = ACTION_COLOR[entry.action] ?? 'var(--surface-2)';

  const date = new Date(entry.created_at);
  const dateStr = date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const actorName = entry.actor
    ? `${entry.actor.first_name}${entry.actor.last_name ? ' ' + entry.actor.last_name : ''}`
    : t('admin.audit.system');

  return (
    <div className="glass-card rounded-2xl px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
          style={{ background: `${color}18` }}
        >
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color }}>
              {label}
            </span>
            <span className="text-tg-hint shrink-0 text-xs">
              {dateStr} {timeStr}
            </span>
          </div>
          <p className="text-tg-hint mt-0.5 text-xs">
            {t('admin.audit.actor', { name: actorName })}
          </p>
          {entry.entity_type && (
            <p className="text-tg-hint text-xs">
              {entry.entity_type}
              {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}…` : ''}
            </p>
          )}
          {/* Meta details for role_changed */}
          {entry.action === 'role_changed' && entry.meta && (
            <p className="text-warn mt-1 text-xs">
              {String(entry.meta['old_role'] ?? '?')} → {String(entry.meta['new_role'] ?? '?')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
