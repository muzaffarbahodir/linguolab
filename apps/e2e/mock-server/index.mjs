/**
 * Lightweight mock backend for E2E tests.
 * Runs on port 9999 and handles all /api/v1/* routes.
 * No external dependencies — pure Node.js http module.
 */

import http from 'node:http';

// ─── Mock data ────────────────────────────────────────────────────────────────

const CLASSES = [
  {
    id: 'class-1',
    title: 'Английский A2',
    level: 'A2',
    language: { name: 'Английский', flag_emoji: '🇬🇧', name_ru: 'Английский' },
    description: 'Курс для начинающих',
    _count: { enrollments: 5 },
  },
  {
    id: 'class-2',
    title: 'Немецкий B1',
    level: 'B1',
    language: { name: 'Немецкий', flag_emoji: '🇩🇪', name_ru: 'Немецкий' },
    description: null,
    _count: { enrollments: 3 },
  },
];

const STUDENTS = [
  {
    id: 'student-1',
    first_name: 'Иван',
    last_name: 'Петров',
    email: 'ivan@test.com',
    enrollment: { status: 'ACTIVE', enrolled_at: '2025-01-01T00:00:00Z' },
  },
  {
    id: 'student-2',
    first_name: 'Мария',
    last_name: 'Сидорова',
    email: 'maria@test.com',
    enrollment: { status: 'ACTIVE', enrolled_at: '2025-01-15T00:00:00Z' },
  },
];

const LESSONS = [
  {
    id: 'lesson-1',
    title: 'Урок 1 — Введение',
    description: 'Знакомство с программой',
    starts_at: '2026-05-20T10:00:00Z',
    ends_at: '2026-05-20T11:30:00Z',
    is_completed: false,
    class: { id: 'class-1', title: 'Английский A2' },
    class_id: 'class-1',
  },
  {
    id: 'lesson-2',
    title: 'Урок 2 — Алфавит',
    description: null,
    starts_at: '2026-05-22T10:00:00Z',
    ends_at: '2026-05-22T11:30:00Z',
    is_completed: false,
    class: { id: 'class-1', title: 'Английский A2' },
    class_id: 'class-1',
  },
];

const HOMEWORK = [
  {
    id: 'hw-1',
    title: 'Выучить 20 слов',
    description: 'Повторить слова из урока 1',
    due_date: '2026-05-25T23:59:00Z',
    status: 'PENDING',
    feedback: null,
    class_id: 'class-1',
    class: { title: 'Английский A2' },
    // портал ждёт lesson.class.title
    lesson: { title: 'Урок 1 — Введение', class: { title: 'Английский A2' } },
    submissions: [],
    my_submission: null,
  },
];

const SUBMISSIONS = [
  {
    id: 'sub-1',
    homework_id: 'hw-1',
    student_id: 'student-1',
    status: 'SUBMITTED',
    submitted_at: '2026-05-24T15:00:00Z',
    file_url: null,
    grade: null,
    feedback: null,
    student: { id: 'student-1', first_name: 'Иван', last_name: 'Петров' },
  },
];

const ENROLLMENTS = [
  {
    id: 'enroll-1',
    class_id: 'class-1',
    status: 'ACTIVE',
    enrolled_at: '2025-01-01T00:00:00Z',
    class: CLASSES[0],
  },
];

const PAYMENTS = [
  {
    id: 'pay-1',
    amount: 500000,
    currency: 'UZS',
    status: 'PAID',
    created_at: '2025-01-01T00:00:00Z',
    description: 'Оплата курса Английский A2',
  },
];

const PROFILE = {
  id: 'student-1',
  first_name: 'Тест',
  last_name: 'Студент',
  email: 'student@test.com',
  role: 'STUDENT',
  locale: 'ru',
};

// Портал ждёт от /start: { test_id, questions: [{id, text, options[], level}] }
const PLACEMENT_QUESTIONS = Array.from({ length: 15 }, (_, i) =>
  i === 0
    ? {
        id: 1,
        text: 'Which sentence is correct?',
        options: ['I is happy', 'I am happy', 'I be happy', 'I are happy'],
        level: 'A1',
      }
    : {
        id: i + 1,
        text: `Question ${i + 1}: choose the correct option`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        level: 'A2',
      },
);

// ─── Router ───────────────────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const method = req.method;
  // Strip query string
  const url = req.url.split('?')[0];
  // Strip /api/v1 prefix
  const path = url.replace(/^\/api\/v1/, '');

  // CORS for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  // TWA auth — accepts any non-empty initData
  if (method === 'POST' && path === '/auth/telegram/init') {
    return json(res, 200, {
      access_token: 'mock-student-token',
      refresh_token: 'mock-refresh-token',
      user: {
        ...PROFILE,
        is_active: true,
        locale: 'ru',
        timezone: 'Asia/Tashkent',
        username: null,
        avatar_url: null,
      },
    });
  }

  if (method === 'POST' && path === '/auth/login') {
    const body = await readBody(req);
    if (body.email && body.password) {
      return json(res, 200, {
        access_token: 'mock-student-token',
        user: { ...PROFILE, role: 'STUDENT' },
      });
    }
    return json(res, 401, { message: 'Invalid credentials' });
  }

  if (method === 'POST' && path === '/auth/admin/login') {
    return json(res, 200, {
      access_token: 'mock-admin-token',
      user: {
        id: 'admin-1',
        first_name: 'Admin',
        last_name: null,
        email: 'admin@test.com',
        role: 'ADMIN',
      },
    });
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  if (path === '/users/me') {
    if (method === 'GET') return json(res, 200, PROFILE);
    if (method === 'PATCH') {
      const body = await readBody(req);
      return json(res, 200, { ...PROFILE, ...body });
    }
  }

  // ── Classes ───────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/classes') return json(res, 200, CLASSES);
  if (method === 'GET' && path === '/classes/my') return json(res, 200, CLASSES);

  const classMatch = path.match(/^\/classes\/([^/]+)$/);
  if (classMatch) {
    const cls = CLASSES.find((c) => c.id === classMatch[1]) ?? CLASSES[0];
    if (method === 'GET') return json(res, 200, cls);
  }

  const classStudentsMatch = path.match(/^\/classes\/([^/]+)\/students$/);
  if (method === 'GET' && classStudentsMatch) return json(res, 200, STUDENTS);

  const classEnrollMatch = path.match(/^\/classes\/([^/]+)\/enroll$/);
  if (method === 'POST' && classEnrollMatch) {
    return json(res, 201, { message: 'Enrolled successfully', status: 'ACTIVE' });
  }

  // ── Lessons ───────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/lessons/my') return json(res, 200, LESSONS);
  if (method === 'GET' && path === '/lessons/upcoming') return json(res, 200, LESSONS);
  if (method === 'GET' && path === '/lessons/history') return json(res, 200, []);

  const lessonsByClassMatch = path.match(/^\/lessons\/class\/([^/]+)$/);
  if (method === 'GET' && lessonsByClassMatch) return json(res, 200, LESSONS);

  if (method === 'POST' && path === '/lessons') {
    const body = await readBody(req);
    return json(res, 201, {
      id: 'lesson-new',
      title: body.title ?? 'Новый урок',
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: body.ends_at ?? new Date().toISOString(),
      is_completed: false,
      class_id: body.class_id ?? 'class-1',
    });
  }

  const lessonAttendMatch = path.match(/^\/lessons\/([^/]+)\/attendance\/bulk$/);
  if (method === 'POST' && lessonAttendMatch) return json(res, 200, { ok: true });

  // ── Homework ──────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/homework/my') return json(res, 200, HOMEWORK);

  const hwByClassMatch = path.match(/^\/homework\/class\/([^/]+)$/);
  if (method === 'GET' && hwByClassMatch) return json(res, 200, HOMEWORK);

  if (method === 'POST' && path === '/homework') {
    const body = await readBody(req);
    return json(res, 201, {
      id: 'hw-new',
      title: body.title ?? 'Новое ДЗ',
      description: body.description ?? null,
      due_date: body.due_date ?? null,
      class_id: body.class_id ?? 'class-1',
      submissions: [],
    });
  }

  const hwSubmissionsMatch = path.match(/^\/homework\/([^/]+)\/submissions$/);
  if (method === 'GET' && hwSubmissionsMatch) {
    const hwId = hwSubmissionsMatch[1];
    return json(res, 200, hwId === 'hw-1' ? SUBMISSIONS : []);
  }

  const hwSubmitMatch = path.match(/^\/homework\/([^/]+)\/submit$/);
  if (method === 'POST' && hwSubmitMatch) {
    return json(res, 200, { id: 'sub-new', status: 'SUBMITTED' });
  }

  const hwGradeMatch = path.match(/^\/homework\/submissions\/([^/]+)\/grade$/);
  if (method === 'PATCH' && hwGradeMatch) {
    const body = await readBody(req);
    return json(res, 200, {
      id: hwGradeMatch[1],
      status: 'GRADED',
      grade: body.grade ?? 100,
      feedback: body.feedback ?? null,
    });
  }

  // ── Enrollments ───────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/enrollments/my') return json(res, 200, ENROLLMENTS);

  // ── Payments ──────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/payments/my') return json(res, 200, PAYMENTS);

  // ── Placement tests ───────────────────────────────────────────────────────
  if (method === 'GET' && path === '/placement-tests/languages') {
    return json(res, 200, [
      { code: 'english', name: 'Английский', flag: '🇬🇧' },
      { code: 'german', name: 'Немецкий', flag: '🇩🇪' },
    ]);
  }

  // Портал: start → все вопросы сразу; answer/complete — плоские пути.
  const ptStartMatch = path.match(/^\/placement-tests\/start\/([^/]+)$/);
  if (method === 'POST' && ptStartMatch) {
    return json(res, 200, { test_id: 'pt-1', questions: PLACEMENT_QUESTIONS });
  }

  if (method === 'POST' && path === '/placement-tests/answer') {
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && path === '/placement-tests/complete') {
    return json(res, 200, { score: 72, level: 'B1', correct: 11, total: 15 });
  }

  // ── Notifications / misc ──────────────────────────────────────────────────
  if (method === 'GET' && path === '/notifications') return json(res, 200, []);
  if (method === 'GET' && path === '/achievements/my') return json(res, 200, []);

  // ── Fallback ──────────────────────────────────────────────────────────────
  console.log(`[mock] unhandled ${method} ${path}`);
  return json(res, 200, {});
});

server.listen(9999, () => {
  console.log('[mock-api] running on http://localhost:9999');
});
