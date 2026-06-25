import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { authOptions } from '../lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const userName = session.user?.name ?? 'Менеджер';

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LinguoLab Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Добро пожаловать, {userName}</p>
        </div>
        <Link href="/api/auth/signout" className="text-sm text-gray-400 hover:text-gray-600">
          Выйти
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/users/pending"
          className="group rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">👤</div>
          <h2 className="font-semibold text-amber-900">Новые пользователи</h2>
          <p className="mt-1 text-sm text-amber-700">
            Активация и назначение ролей новым пользователям из Telegram.
          </p>
          <p className="mt-3 text-sm font-medium text-amber-600 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/users"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">👥</div>
          <h2 className="font-semibold text-gray-900">Все пользователи</h2>
          <p className="mt-1 text-sm text-gray-500">
            Список всех пользователей, смена ролей, управление доступом.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/enrollments"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">📋</div>
          <h2 className="font-semibold text-gray-900">Заявки на запись</h2>
          <p className="mt-1 text-sm text-gray-500">
            Одобряйте и отклоняйте заявки студентов. При одобрении бот отправит invite в группу.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/classes"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">🏫</div>
          <h2 className="font-semibold text-gray-900">Классы</h2>
          <p className="mt-1 text-sm text-gray-500">
            Привяжите Telegram-группу к классу. Студенты получат ссылку при зачислении.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/broadcast"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">📢</div>
          <h2 className="font-semibold text-gray-900">Рассылка</h2>
          <p className="mt-1 text-sm text-gray-500">
            Отправить Telegram-сообщение всем студентам или конкретному классу.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/export"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">📥</div>
          <h2 className="font-semibold text-gray-900">Экспорт данных</h2>
          <p className="mt-1 text-sm text-gray-500">
            CSV-файлы: студенты и платежи. Открываются в Excel без лишних настроек.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/audit"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">🔍</div>
          <h2 className="font-semibold text-gray-900">Журнал аудита</h2>
          <p className="mt-1 text-sm text-gray-500">
            История действий администраторов: смена ролей, удаления, рассылки.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/settings"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">⚙️</div>
          <h2 className="font-semibold text-gray-900">Настройки</h2>
          <p className="mt-1 text-sm text-gray-500">
            Включение / отключение платёжных провайдеров (Payme, Click, Uzum).
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>

        <Link
          href="/analytics"
          className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="mb-3 text-3xl">📊</div>
          <h2 className="font-semibold text-gray-900">Аналитика</h2>
          <p className="mt-1 text-sm text-gray-500">
            Выручка по месяцам, новые студенты, воронка записей, распределение статусов.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-500 group-hover:underline">Перейти →</p>
        </Link>
      </div>
    </main>
  );
}
