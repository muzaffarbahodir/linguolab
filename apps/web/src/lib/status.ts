/**
 * status.ts — единый источник цветов, ярлыков и иконок для всех статусов.
 *
 * Зачем:
 *  - DRY: раньше CLASS_STATUS_COLOR/LABEL, TRIAL_STATUS_*, payment STATUS_COLOR
 *    дублировались в Courses/Payment/Admin. Теперь одно место.
 *  - i18n: labelKey, а не русский литерал → uz/en получают перевод.
 *  - Доступность (дальтоники): к цвету всегда идёт icon + текстовый ярлык,
 *    статус НИКОГДА не передаётся одним цветом. См. ACCESSIBILITY.md.
 *
 * Использование:
 *   const m = CLASS_STATUS[cls.status];
 *   <span style={{ color: m.color }}>{m.icon} {t(m.labelKey)}</span>
 */

export interface StatusMeta {
  /** HEX-цвет статуса (единый для всего приложения) */
  color: string;
  /** Ключ i18n для ярлыка (status.* namespace) */
  labelKey: string;
  /** Иконка — дубль смысла без цвета (для дальтоников) */
  icon: string;
}

/** Lifecycle класса: DRAFT → ENROLLMENT_OPEN → ACTIVE → EXAM → COMPLETED / CANCELLED */
export const CLASS_STATUS: Record<string, StatusMeta> = {
  DRAFT: { color: 'var(--faint)', labelKey: 'status.class_DRAFT', icon: '🕓' },
  ENROLLMENT_OPEN: { color: '#3B82F6', labelKey: 'status.class_ENROLLMENT_OPEN', icon: '📝' },
  ACTIVE: { color: '#10B981', labelKey: 'status.class_ACTIVE', icon: '▶️' },
  EXAM: { color: '#F59E0B', labelKey: 'status.class_EXAM', icon: '📋' },
  COMPLETED: { color: '#818cf8', labelKey: 'status.class_COMPLETED', icon: '✅' },
  CANCELLED: { color: '#EF4444', labelKey: 'status.class_CANCELLED', icon: '❌' },
};

/** Статус пробного урока */
export const TRIAL_STATUS: Record<string, StatusMeta> = {
  PENDING: { color: '#F59E0B', labelKey: 'status.trial_PENDING', icon: '⏳' },
  CONFIRMED: { color: '#10B981', labelKey: 'status.trial_CONFIRMED', icon: '✅' },
  CANCELLED: { color: 'var(--faint)', labelKey: 'status.trial_CANCELLED', icon: '❌' },
};

/** Статус платежа */
export const PAYMENT_STATUS: Record<string, StatusMeta> = {
  PENDING: { color: '#F59E0B', labelKey: 'status.payment_PENDING', icon: '⏳' },
  AUTHORIZED: { color: '#3B82F6', labelKey: 'status.payment_AUTHORIZED', icon: '🔒' },
  PAID: { color: '#10B981', labelKey: 'status.payment_PAID', icon: '✅' },
  CANCELLED: { color: 'var(--faint)', labelKey: 'status.payment_CANCELLED', icon: '❌' },
  REFUNDED: { color: '#F97316', labelKey: 'status.payment_REFUNDED', icon: '↩️' },
  FAILED: { color: '#EF4444', labelKey: 'status.payment_FAILED', icon: '⚠️' },
  EXPIRED: { color: 'var(--faint)', labelKey: 'status.payment_EXPIRED', icon: '⌛' },
};

/** Статус тикета поддержки. labelKey уже существует как support.status_* */
export const SUPPORT_STATUS: Record<string, StatusMeta> = {
  OPEN: { color: '#EF4444', labelKey: 'support.status_OPEN', icon: '🆕' },
  IN_PROGRESS: { color: '#F59E0B', labelKey: 'support.status_IN_PROGRESS', icon: '⏳' },
  CLOSED: { color: '#10B981', labelKey: 'support.status_CLOSED', icon: '✅' },
};

/** Уровень CEFR → цвет (единый) */
export const LEVEL_COLOR: Record<string, string> = {
  A1: '#10B981',
  A2: '#3B82F6',
  B1: '#F59E0B',
  B2: '#EF4444',
  C1: '#818cf8',
  C2: '#EC4899',
};

/** Безопасный доступ — неизвестный статус не роняет UI */
export function classStatusMeta(status: string): StatusMeta {
  return CLASS_STATUS[status] ?? { color: '#6366f1', labelKey: status, icon: '•' };
}
