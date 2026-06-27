/**
 * Стабильный человекочитаемый номер из id (как номер чека/заказа).
 * Префикс по типу: P — платёж, T — пробный, G — группа, S — поддержка.
 * Детерминирован: один и тот же id всегда даёт один и тот же номер.
 */
export function orderNo(prefix: string, id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `${prefix}-${String(h % 1_000_000).padStart(6, '0')}`;
}
