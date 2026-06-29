/**
 * Встроенные колоды слов для мини-игр.
 *
 * Пока слова зашиты прямо здесь (без участия преподавателей) — игры работают
 * сразу. Позже можно подмешивать слова из материалов курса (CourseLesson):
 * формат WordCard совместим, источник прозрачен для игр.
 *
 * Перевод хранится на трёх языках интерфейса — игра берёт нужный по i18n,
 * с запасным вариантом на русский.
 */

export type DeckId = 'en_basics' | 'en_travel' | 'en_verbs';

export interface WordCard {
  /** Стабильный id внутри колоды — ключ для SRS-прогресса. */
  id: string;
  /** Изучаемое слово (иностранное). */
  w: string;
  /** Переводы по языкам интерфейса. */
  ru: string;
  uz: string;
  en: string;
  /** 1 — лёгкое, 2 — среднее, 3 — сложное. */
  lvl: 1 | 2 | 3;
}

export interface Deck {
  id: DeckId;
  /** Код изучаемого языка (для будущей привязки к курсам). */
  lang: string;
  flag: string;
  title: string;
  cards: WordCard[];
}

const EN_BASICS: WordCard[] = [
  { id: 'b1', w: 'hello', ru: 'привет', uz: 'salom', en: 'hello', lvl: 1 },
  { id: 'b2', w: 'thanks', ru: 'спасибо', uz: 'rahmat', en: 'thanks', lvl: 1 },
  { id: 'b3', w: 'please', ru: 'пожалуйста', uz: 'iltimos', en: 'please', lvl: 1 },
  { id: 'b4', w: 'sorry', ru: 'извини', uz: 'kechirasiz', en: 'sorry', lvl: 1 },
  { id: 'b5', w: 'water', ru: 'вода', uz: 'suv', en: 'water', lvl: 1 },
  { id: 'b6', w: 'food', ru: 'еда', uz: 'ovqat', en: 'food', lvl: 1 },
  { id: 'b7', w: 'friend', ru: 'друг', uz: "do'st", en: 'friend', lvl: 1 },
  { id: 'b8', w: 'house', ru: 'дом', uz: 'uy', en: 'house', lvl: 1 },
  { id: 'b9', w: 'morning', ru: 'утро', uz: 'ertalab', en: 'morning', lvl: 1 },
  { id: 'b10', w: 'night', ru: 'ночь', uz: 'tun', en: 'night', lvl: 1 },
  { id: 'b11', w: 'money', ru: 'деньги', uz: 'pul', en: 'money', lvl: 1 },
  { id: 'b12', w: 'school', ru: 'школа', uz: 'maktab', en: 'school', lvl: 1 },
  { id: 'b13', w: 'book', ru: 'книга', uz: 'kitob', en: 'book', lvl: 1 },
  { id: 'b14', w: 'today', ru: 'сегодня', uz: 'bugun', en: 'today', lvl: 1 },
  { id: 'b15', w: 'tomorrow', ru: 'завтра', uz: 'ertaga', en: 'tomorrow', lvl: 2 },
  { id: 'b16', w: 'weather', ru: 'погода', uz: 'ob-havo', en: 'weather', lvl: 2 },
  { id: 'b17', w: 'family', ru: 'семья', uz: 'oila', en: 'family', lvl: 1 },
  { id: 'b18', w: 'work', ru: 'работа', uz: 'ish', en: 'work', lvl: 1 },
  { id: 'b19', w: 'city', ru: 'город', uz: 'shahar', en: 'city', lvl: 1 },
  { id: 'b20', w: 'happy', ru: 'счастливый', uz: 'baxtli', en: 'happy', lvl: 2 },
];

const EN_TRAVEL: WordCard[] = [
  { id: 't1', w: 'airport', ru: 'аэропорт', uz: 'aeroport', en: 'airport', lvl: 2 },
  { id: 't2', w: 'ticket', ru: 'билет', uz: 'chipta', en: 'ticket', lvl: 1 },
  { id: 't3', w: 'luggage', ru: 'багаж', uz: 'yuk', en: 'luggage', lvl: 2 },
  { id: 't4', w: 'hotel', ru: 'отель', uz: 'mehmonxona', en: 'hotel', lvl: 1 },
  { id: 't5', w: 'map', ru: 'карта', uz: 'xarita', en: 'map', lvl: 1 },
  { id: 't6', w: 'street', ru: 'улица', uz: "ko'cha", en: 'street', lvl: 1 },
  { id: 't7', w: 'left', ru: 'налево', uz: 'chapga', en: 'left', lvl: 1 },
  { id: 't8', w: 'right', ru: 'направо', uz: "o'ngga", en: 'right', lvl: 1 },
  { id: 't9', w: 'station', ru: 'станция', uz: 'bekat', en: 'station', lvl: 2 },
  { id: 't10', w: 'border', ru: 'граница', uz: 'chegara', en: 'border', lvl: 2 },
  { id: 't11', w: 'passport', ru: 'паспорт', uz: 'pasport', en: 'passport', lvl: 2 },
  { id: 't12', w: 'beach', ru: 'пляж', uz: 'plyaj', en: 'beach', lvl: 1 },
  { id: 't13', w: 'mountain', ru: 'гора', uz: "tog'", en: 'mountain', lvl: 2 },
  { id: 't14', w: 'price', ru: 'цена', uz: 'narx', en: 'price', lvl: 1 },
  { id: 't15', w: 'open', ru: 'открыто', uz: 'ochiq', en: 'open', lvl: 1 },
  { id: 't16', w: 'closed', ru: 'закрыто', uz: 'yopiq', en: 'closed', lvl: 1 },
];

const EN_VERBS: WordCard[] = [
  { id: 'v1', w: 'go', ru: 'идти', uz: 'bormoq', en: 'go', lvl: 1 },
  { id: 'v2', w: 'eat', ru: 'есть', uz: 'yemoq', en: 'eat', lvl: 1 },
  { id: 'v3', w: 'drink', ru: 'пить', uz: 'ichmoq', en: 'drink', lvl: 1 },
  { id: 'v4', w: 'read', ru: 'читать', uz: "o'qimoq", en: 'read', lvl: 1 },
  { id: 'v5', w: 'write', ru: 'писать', uz: 'yozmoq', en: 'write', lvl: 1 },
  { id: 'v6', w: 'speak', ru: 'говорить', uz: 'gapirmoq', en: 'speak', lvl: 2 },
  { id: 'v7', w: 'learn', ru: 'учить', uz: "o'rganmoq", en: 'learn', lvl: 2 },
  { id: 'v8', w: 'buy', ru: 'покупать', uz: 'sotib olmoq', en: 'buy', lvl: 1 },
  { id: 'v9', w: 'sleep', ru: 'спать', uz: 'uxlamoq', en: 'sleep', lvl: 1 },
  { id: 'v10', w: 'work', ru: 'работать', uz: 'ishlamoq', en: 'work', lvl: 1 },
  { id: 'v11', w: 'help', ru: 'помогать', uz: 'yordam bermoq', en: 'help', lvl: 2 },
  { id: 'v12', w: 'wait', ru: 'ждать', uz: 'kutmoq', en: 'wait', lvl: 1 },
  { id: 'v13', w: 'understand', ru: 'понимать', uz: 'tushunmoq', en: 'understand', lvl: 3 },
  { id: 'v14', w: 'remember', ru: 'помнить', uz: 'eslamoq', en: 'remember', lvl: 2 },
  { id: 'v15', w: 'forget', ru: 'забывать', uz: 'unutmoq', en: 'forget', lvl: 2 },
  { id: 'v16', w: 'win', ru: 'побеждать', uz: 'yutmoq', en: 'win', lvl: 2 },
];

export const DECKS: Deck[] = [
  { id: 'en_basics', lang: 'en', flag: '🇬🇧', title: 'English · Basics', cards: EN_BASICS },
  { id: 'en_travel', lang: 'en', flag: '✈️', title: 'English · Travel', cards: EN_TRAVEL },
  { id: 'en_verbs', lang: 'en', flag: '⚡', title: 'English · Verbs', cards: EN_VERBS },
];

export function getDeck(id: DeckId): Deck {
  return DECKS.find((d) => d.id === id) ?? DECKS[0]!;
}

/** Перевод карточки на язык интерфейса (fallback → ru). */
export function cardPrompt(card: WordCard, lng: string): string {
  if (lng.startsWith('uz')) return card.uz;
  if (lng.startsWith('en')) return card.ru; // для ru-говорящих, учащих англ.; en-меню → показываем ru-смысл
  return card.ru;
}
