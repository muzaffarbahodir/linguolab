import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CEFR } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Вопросы теста (встроенные, без отдельной таблицы) ───────────────────────

export interface Question {
  id: number;
  language_code: string; // en | es | fr | zh | uz
  text: string;
  options: string[];
  correct: number; // индекс правильного ответа (0-based)
  level: CEFR; // сложность вопроса
}

/**
 * Банк вопросов для placement test.
 * В production заменить на таблицу quiz_questions.
 * Пока — встроенный минимальный набор (3 вопроса на уровень × 2 уровня для EN).
 */
const QUESTIONS: Question[] = [
  // English A1
  {
    id: 1,
    language_code: 'en',
    text: 'What is your name?',
    options: ['My name is...', 'I am name...', 'Name me...', 'I have name...'],
    correct: 0,
    level: CEFR.A1,
  },
  {
    id: 2,
    language_code: 'en',
    text: 'She ___ a student.',
    options: ['am', 'is', 'are', 'be'],
    correct: 1,
    level: CEFR.A1,
  },
  {
    id: 3,
    language_code: 'en',
    text: 'I ___ to school every day.',
    options: ['go', 'goes', 'going', 'went'],
    correct: 0,
    level: CEFR.A1,
  },
  // English A2
  {
    id: 4,
    language_code: 'en',
    text: 'They ___ dinner when I arrived.',
    options: ['have', 'had', 'were having', 'are having'],
    correct: 2,
    level: CEFR.A2,
  },
  {
    id: 5,
    language_code: 'en',
    text: 'I have lived here ___ 2010.',
    options: ['for', 'since', 'from', 'during'],
    correct: 1,
    level: CEFR.A2,
  },
  {
    id: 6,
    language_code: 'en',
    text: 'She asked me where ___ from.',
    options: ['I come', 'do I come', 'I came', 'came I'],
    correct: 2,
    level: CEFR.A2,
  },
  // English B1
  {
    id: 7,
    language_code: 'en',
    text: 'If I ___ more time, I would travel.',
    options: ['have', 'had', 'will have', 'having'],
    correct: 1,
    level: CEFR.B1,
  },
  {
    id: 8,
    language_code: 'en',
    text: 'The report must ___ by Friday.',
    options: ['submit', 'submits', 'be submitted', 'submitted'],
    correct: 2,
    level: CEFR.B1,
  },
  {
    id: 9,
    language_code: 'en',
    text: 'She wishes she ___ harder at school.',
    options: ['studied', 'had studied', 'has studied', 'study'],
    correct: 1,
    level: CEFR.B1,
  },
  // English B2
  {
    id: 10,
    language_code: 'en',
    text: 'Hardly ___ the door when the phone rang.',
    options: ['I opened', 'had I opened', 'I had opened', 'did I open'],
    correct: 1,
    level: CEFR.B2,
  },
  {
    id: 11,
    language_code: 'en',
    text: 'The manager is ___ about the budget.',
    options: ['concerning', 'concerned', 'concern', 'concerns'],
    correct: 1,
    level: CEFR.B2,
  },
  // English C1
  {
    id: 12,
    language_code: 'en',
    text: 'It is high time we ___ a decision.',
    options: ['make', 'made', 'will make', 'have made'],
    correct: 1,
    level: CEFR.C1,
  },
  {
    id: 13,
    language_code: 'en',
    text: 'The policy was met with ___ opposition.',
    options: ['considerable', 'considerably', 'considerate', 'considering'],
    correct: 0,
    level: CEFR.C1,
  },
  {
    id: 14,
    language_code: 'en',
    text: 'Had they arrived earlier, they ___ the presentation.',
    options: ['see', 'saw', 'would see', 'would have seen'],
    correct: 3,
    level: CEFR.C1,
  },
  // English C2
  {
    id: 15,
    language_code: 'en',
    text: '___ his experience, he still made errors.',
    options: ['However', 'Despite', 'Although', 'Even'],
    correct: 1,
    level: CEFR.C2,
  },
];

/** Вычислить CEFR уровень по баллу (0–100) */
function scoreToLevel(score: number): CEFR {
  if (score >= 90) return CEFR.C2;
  if (score >= 75) return CEFR.C1;
  if (score >= 60) return CEFR.B2;
  if (score >= 45) return CEFR.B1;
  if (score >= 25) return CEFR.A2;
  return CEFR.A1;
}

@Injectable()
export class PlacementTestsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Начать placement test для языка */
  async start(userId: string, languageId: string) {
    // Не больше 1 активного теста на язык
    const existing = await this.prisma.placementTest.findFirst({
      where: { user_id: userId, language_id: languageId, status: 'IN_PROGRESS' },
    });
    if (existing) {
      // Если истёк — помечаем и создаём новый
      if (new Date() > existing.expires_at) {
        await this.prisma.placementTest.update({
          where: { id: existing.id },
          data: { status: 'EXPIRED' },
        });
      } else {
        return { test_id: existing.id, questions: this.getQuestions(languageId) };
      }
    }

    const language = await this.prisma.language.findUnique({ where: { id: languageId } });
    if (!language) throw new NotFoundException('Language not found');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const test = await this.prisma.placementTest.create({
      data: {
        user_id: userId,
        language_id: languageId,
        expires_at: expiresAt,
      },
    });

    return { test_id: test.id, questions: this.getQuestions(language.code) };
  }

  /** Получить вопросы для языка (без правильных ответов!) */
  private getQuestions(languageCode: string) {
    return QUESTIONS.filter((q) => q.language_code === languageCode).map(
      ({ id, text, options, level }) => ({ id, text, options, level }),
    );
  }

  /** Ответить на вопрос */
  async answer(testId: string, userId: string, questionId: number, answerIndex: number) {
    const test = await this.prisma.placementTest.findFirst({
      where: { id: testId, user_id: userId, status: 'IN_PROGRESS' },
    });
    if (!test) throw new NotFoundException('Test not found or already completed');
    if (new Date() > test.expires_at) {
      await this.prisma.placementTest.update({
        where: { id: testId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Test expired');
    }

    const question = QUESTIONS.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException('Question not found');

    const isCorrect = question.correct === answerIndex;
    const answers = test.answers as Array<{
      question_id: number;
      answer: number;
      is_correct: boolean;
    }>;

    // Не перезаписываем уже отвеченные
    if (answers.some((a) => a.question_id === questionId)) {
      return { ok: true, already_answered: true };
    }

    answers.push({ question_id: questionId, answer: answerIndex, is_correct: isCorrect });
    await this.prisma.placementTest.update({ where: { id: testId }, data: { answers } });

    return { ok: true, is_correct: isCorrect };
  }

  /** Завершить тест и получить результат */
  async complete(testId: string, userId: string) {
    const test = await this.prisma.placementTest.findFirst({
      where: { id: testId, user_id: userId },
    });
    if (!test) throw new NotFoundException('Test not found');
    if (test.status === 'COMPLETED') {
      return { score: test.score, level: test.level_assigned };
    }

    const answers = test.answers as Array<{ is_correct: boolean }>;
    const correct = answers.filter((a) => a.is_correct).length;
    const total = QUESTIONS.length;
    const score = Math.round((correct / total) * 100);
    const level = scoreToLevel(score);

    await this.prisma.placementTest.update({
      where: { id: testId },
      data: { status: 'COMPLETED', score, level_assigned: level, completed_at: new Date() },
    });

    // Сохраняем уровень в профиль пользователя (поле placement_level если добавим)
    // TODO: users.placement_level — добавить в Этапе 12.9

    return { score, level, correct, total };
  }

  /** Мои тесты */
  async myTests(userId: string) {
    return this.prisma.placementTest.findMany({
      where: { user_id: userId },
      include: { language: { select: { name_ru: true, flag_emoji: true } } },
      orderBy: { started_at: 'desc' },
    });
  }
}
