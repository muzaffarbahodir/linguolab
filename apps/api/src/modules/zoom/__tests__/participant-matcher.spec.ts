/**
 * Сопоставление участников Zoom со студентами.
 *
 * Ошибка здесь бьёт по людям: неверно узнанный студент получает чужую
 * посещаемость, а неузнанный — прогул и уведомление родителям о том, чего не
 * было. Поэтому проверяем не только «узнаёт», но и «отказывается гадать».
 */
import {
  MIN_PRESENT_MINUTES,
  matchParticipants,
  type MatchableStudent,
} from '../participant-matcher';

const ali: MatchableStudent = {
  id: 's1',
  first_name: 'Ali',
  last_name: 'Valiyev',
  telegram_username: 'ali_v',
};
const dilnoza: MatchableStudent = {
  id: 's2',
  first_name: 'Дилноза',
  last_name: 'Каримова',
  telegram_username: null,
};
const students = [ali, dilnoza];

const LONG = MIN_PRESENT_MINUTES + 50;

describe('matchParticipants', () => {
  it('узнаёт точное имя и фамилию', () => {
    const r = matchParticipants([{ name: 'Ali Valiyev', minutes: LONG }], students);
    expect(r.matched.get('s1')).toBe(LONG);
    expect(r.unmatched).toHaveLength(0);
  });

  it('не зависит от регистра и лишних пробелов', () => {
    const r = matchParticipants([{ name: '  aLI   vALIYEV ', minutes: LONG }], students);
    expect(r.matched.has('s1')).toBe(true);
  });

  it('узнаёт при перестановке имени и фамилии', () => {
    const r = matchParticipants([{ name: 'Valiyev Ali', minutes: LONG }], students);
    expect(r.matched.has('s1')).toBe(true);
  });

  it('узнаёт, когда телефон дописал своё название', () => {
    const r = matchParticipants([{ name: "Ali Valiyev (Ali's iPhone)", minutes: LONG }], students);
    expect(r.matched.has('s1')).toBe(true);
  });

  it('узнаёт по telegram-нику', () => {
    const r = matchParticipants([{ name: 'ali_v', minutes: LONG }], students);
    expect(r.matched.has('s1')).toBe(true);
  });

  it('работает с кириллицей', () => {
    const r = matchParticipants([{ name: 'Дилноза Каримова', minutes: LONG }], students);
    expect(r.matched.has('s2')).toBe(true);
  });

  it('суммирует минуты, если человек переподключался', () => {
    const r = matchParticipants(
      [
        { name: 'Ali Valiyev', minutes: 30 },
        { name: 'ali valiyev', minutes: 25 },
      ],
      students,
    );
    expect(r.matched.get('s1')).toBe(55);
  });

  it('не подтверждает присутствие, если заглянул на минуту', () => {
    const r = matchParticipants(
      [{ name: 'Ali Valiyev', minutes: MIN_PRESENT_MINUTES - 1 }],
      students,
    );
    expect(r.matched.size).toBe(0);
    expect(r.unmatched).toContain('Ali Valiyev');
  });

  it('не гадает при неоднозначности — двух Али отдаёт преподавателю', () => {
    const ali2: MatchableStudent = {
      id: 's3',
      first_name: 'Ali',
      last_name: null,
      telegram_username: null,
    };
    const r = matchParticipants([{ name: 'Ali', minutes: LONG }], [ali, ali2]);
    expect(r.matched.size).toBe(0);
    expect(r.unmatched).toContain('Ali');
  });

  it('чужого в конференции не приписывает никому', () => {
    const r = matchParticipants([{ name: 'Random Guest', minutes: LONG }], students);
    expect(r.matched.size).toBe(0);
    expect(r.unmatched).toEqual(['Random Guest']);
  });

  it('возвращает тех, кого не было среди участников', () => {
    const r = matchParticipants([{ name: 'Ali Valiyev', minutes: LONG }], students);
    expect(r.missing.map((s) => s.id)).toEqual(['s2']);
  });

  it('пустой отчёт не ломает и никого не подтверждает', () => {
    const r = matchParticipants([], students);
    expect(r.matched.size).toBe(0);
    expect(r.missing).toHaveLength(2);
  });
});
