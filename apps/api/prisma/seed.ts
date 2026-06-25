/**
 * Prisma seed script — заполняет базу начальными данными.
 *
 * Запуск:
 *   pnpm --filter @linguolab/api prisma db seed
 *
 * Этап 1: Languages (5 штук)
 * Этап 4: Teachers (2) + Classes (6)
 */
import { PrismaClient, CEFR } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding LinguoLab database...');

  // ── Languages ────────────────────────────────────────────────────────────
  const languagesData = [
    { code: 'en', name_ru: 'Английский', flag_emoji: '🇬🇧', color: '#6C5CE7' },
    { code: 'es', name_ru: 'Испанский', flag_emoji: '🇪🇸', color: '#FFB800' },
    { code: 'fr', name_ru: 'Французский', flag_emoji: '🇫🇷', color: '#3B82F6' },
    { code: 'zh', name_ru: 'Китайский', flag_emoji: '🇨🇳', color: '#EF4444' },
    { code: 'uz', name_ru: 'Узбекский', flag_emoji: '🇺🇿', color: '#10B981' },
  ];

  const languages: Record<string, { id: string }> = {};
  for (const lang of languagesData) {
    const l = await prisma.language.upsert({
      where: { code: lang.code },
      update: {},
      create: lang,
    });
    languages[lang.code] = l;
  }
  console.log(`✅ Seeded ${languagesData.length} languages`);

  // ── Teacher users ─────────────────────────────────────────────────────────
  const teacherUsersData = [
    {
      telegram_user_id: BigInt('100000000001'),
      first_name: 'Анна',
      last_name: 'Петрова',
      role: 'TEACHER' as const,
      bio: 'Сертифицированный преподаватель английского и французского. Опыт 7 лет.',
    },
    {
      telegram_user_id: BigInt('100000000002'),
      first_name: 'Давид',
      last_name: 'Ли',
      role: 'TEACHER' as const,
      bio: 'Носитель китайского языка. Преподаю по методике HSK. Опыт 5 лет.',
    },
  ];

  const teacherProfiles: Array<{ id: string }> = [];

  for (const tu of teacherUsersData) {
    const user = await prisma.user.upsert({
      where: { telegram_user_id: tu.telegram_user_id },
      update: { role: tu.role },
      create: {
        telegram_user_id: tu.telegram_user_id,
        first_name: tu.first_name,
        last_name: tu.last_name,
        role: tu.role,
      },
    });

    const teacher = await prisma.teacher.upsert({
      where: { user_id: user.id },
      update: { bio: tu.bio },
      create: { user_id: user.id, bio: tu.bio },
    });

    teacherProfiles.push(teacher);
  }
  console.log(`✅ Seeded ${teacherUsersData.length} teachers`);

  // ── Classes ───────────────────────────────────────────────────────────────
  const anna = teacherProfiles[0]!;
  const david = teacherProfiles[1]!;

  const classesData: Array<{
    languageCode: string;
    teacherId: string;
    title: string;
    level: CEFR;
    price_uzs: number;
    max_students: number;
    description: string;
  }> = [
    {
      languageCode: 'en',
      teacherId: anna.id,
      title: 'Английский A1 — Утренняя группа',
      level: 'A1',
      price_uzs: 350_000,
      max_students: 8,
      description: 'Курс для абсолютных новичков. Алфавит, базовая грамматика, разговорные клише.',
    },
    {
      languageCode: 'en',
      teacherId: anna.id,
      title: 'Английский B1 — Средний уровень',
      level: 'B1',
      price_uzs: 450_000,
      max_students: 8,
      description: 'Расширяем словарный запас, работаем с текстами и аудированием.',
    },
    {
      languageCode: 'fr',
      teacherId: anna.id,
      title: 'Французский A2 — Начинающие',
      level: 'A2',
      price_uzs: 400_000,
      max_students: 6,
      description:
        'Базовые фразы, произношение, простые диалоги. Приветствуются те, кто знает алфавит.',
    },
    {
      languageCode: 'zh',
      teacherId: david.id,
      title: 'Китайский HSK 1 — Старт',
      level: 'A1',
      price_uzs: 500_000,
      max_students: 6,
      description: 'Пиньинь, тоны, 150 базовых иероглифов по программе HSK 1.',
    },
    {
      languageCode: 'zh',
      teacherId: david.id,
      title: 'Китайский HSK 3 — Средний',
      level: 'B1',
      price_uzs: 600_000,
      max_students: 6,
      description: 'HSK 3: 600 слов, грамматика, чтение и письмо. Подготовка к экзамену.',
    },
    {
      languageCode: 'es',
      teacherId: anna.id,
      title: 'Испанский A1 — Вечерняя группа',
      level: 'A1',
      price_uzs: 380_000,
      max_students: 8,
      description: 'Основы испанского: произношение, базовые глаголы, счёт, приветствия.',
    },
  ];

  let classCount = 0;
  for (const c of classesData) {
    const lang = languages[c.languageCode];
    if (!lang) continue;

    // upsert по title (уникальности нет в схеме — просто deleteMany + create для seed)
    const existing = await prisma.class.findFirst({ where: { title: c.title } });
    if (!existing) {
      await prisma.class.create({
        data: {
          language_id: lang.id,
          teacher_id: c.teacherId,
          title: c.title,
          level: c.level,
          price_uzs: c.price_uzs,
          max_students: c.max_students,
          description: c.description,
        },
      });
      classCount++;
    }
  }
  console.log(`✅ Seeded ${classCount} classes`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
