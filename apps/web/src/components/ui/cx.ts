/**
 * Склейка классов без зависимости.
 *
 * Отбрасывает false/null/undefined, чтобы условные классы писались как
 * `cx('base', active && 'on')` и не оставляли в разметке слово "false".
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
