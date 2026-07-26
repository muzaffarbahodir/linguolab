/**
 * Сопоставление участников Zoom со студентами группы.
 *
 * Студенты здесь опознаются через Telegram, почты у них нет — значит
 * единственное, что приходит из отчёта Zoom, это отображаемое имя. Оно
 * ненадёжно: человек входит как «Ali», «ali valiyev», «Али» или с телефона,
 * который подставляет своё название.
 *
 * Отсюда главное правило: сопоставление вправе только ПОДТВЕРДИТЬ присутствие.
 * Ставить ABSENT по его результатам нельзя — иначе студент, вошедший под
 * непонятным именем, получит прогул, а его родители — уведомление о том, чего
 * не было. Тех, кого не удалось узнать, показываем преподавателю.
 */

export interface MatchableStudent {
  id: string;
  first_name: string;
  last_name: string | null;
  telegram_username: string | null;
}

export interface MatchInput {
  name: string;
  minutes: number;
}

export interface MatchResult {
  /** student_id → сколько минут был на связи */
  matched: Map<string, number>;
  /** Имена из Zoom, которые не удалось связать ни с кем. */
  unmatched: string[];
  /** Студенты группы, которых не нашли среди участников. */
  missing: MatchableStudent[];
}

/** Убирает регистр, диакритику, знаки и лишние пробелы. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Набор вариантов написания, под которыми студент мог войти. */
function candidateKeys(s: MatchableStudent): string[] {
  const first = normalize(s.first_name);
  const last = normalize(s.last_name ?? '');
  const keys = [first];
  if (last) {
    keys.push(`${first} ${last}`, `${last} ${first}`);
  }
  if (s.telegram_username) keys.push(normalize(s.telegram_username));
  return keys.filter(Boolean);
}

/**
 * Минут меньше этого порога — считаем, что человек заглянул и вышел, а не был
 * на занятии. Присутствие в таком случае не подтверждаем.
 */
export const MIN_PRESENT_MINUTES = 10;

export function matchParticipants(
  participants: MatchInput[],
  students: MatchableStudent[],
): MatchResult {
  const matched = new Map<string, number>();
  const unmatched: string[] = [];

  // Индекс «вариант написания → студенты». Список, а не один студент: два
  // Али в группе — обычное дело, и такой случай надо не угадывать, а отдать
  // преподавателю.
  const index = new Map<string, string[]>();
  for (const s of students) {
    for (const key of candidateKeys(s)) {
      index.set(key, [...(index.get(key) ?? []), s.id]);
    }
  }

  for (const p of participants) {
    const key = normalize(p.name);
    if (!key) continue;

    let ids = index.get(key);

    // Точного совпадения нет — пробуем вхождение: «Ali Valiyev (iPhone)»
    // содержит «ali valiyev». Берём самый длинный подошедший вариант, чтобы
    // «ali» не перебивал «ali valiyev».
    if (!ids) {
      const hits = [...index.entries()]
        .filter(([k]) => k.length >= 4 && (key.includes(k) || k.includes(key)))
        .sort((a, b) => b[0].length - a[0].length);
      if (hits.length > 0) ids = hits[0]![1];
    }

    // Не узнали или узнали неоднозначно — не гадаем.
    if (!ids || ids.length !== 1) {
      unmatched.push(p.name);
      continue;
    }

    if (p.minutes < MIN_PRESENT_MINUTES) {
      unmatched.push(p.name);
      continue;
    }

    const id = ids[0]!;
    matched.set(id, (matched.get(id) ?? 0) + p.minutes);
  }

  return {
    matched,
    unmatched,
    missing: students.filter((s) => !matched.has(s.id)),
  };
}
