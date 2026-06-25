'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import { ThemeToggle } from '../../components/ThemeProvider';

interface Profile {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
  locale: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [locale, setLocale] = useState('ru');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/proxy/profile')
      .then((r) => r.json())
      .then((d) => {
        const p = d as Profile;
        setProfile(p);
        setFirstName(p.first_name);
        setLastName(p.last_name ?? '');
        setLocale(p.locale);
      })
      .catch(() => null);
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/proxy/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName || null, locale }),
    });
    setSaving(false);
    setMsg(res.ok ? '✅ Профиль обновлён' : '❌ Ошибка сохранения');
  }

  if (!profile)
    return (
      <>
        <Nav />
        <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
          <div className="glass-card rounded-3xl px-5 py-12 text-center">
            <p className="text-2xl">⏳</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Загрузка...
            </p>
          </div>
        </main>
      </>
    );

  return (
    <>
      <Nav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Avatar card */}
        <div className="glass-card rounded-3xl px-5 py-5">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
              style={{ background: 'var(--glass-green-bg)', color: 'var(--glass-accent)' }}
            >
              {firstName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold" style={{ color: 'var(--glass-text)' }}>
                {firstName} {lastName}
              </p>
              {profile.email && (
                <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                  {profile.email}
                </p>
              )}
              {profile.telegram_username && (
                <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                  @{profile.telegram_username}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="glass-card flex items-center justify-between rounded-2xl px-5 py-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>
              Тема оформления
            </p>
            <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
              Pearl — светлая / Nuar — тёмная
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Edit form */}
        <section>
          <p
            className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--glass-hint)' }}
          >
            Редактировать профиль
          </p>
          <form onSubmit={handleSave} className="glass-section overflow-hidden rounded-2xl">
            {/* First name */}
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--glass-divider)' }}>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Имя
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            {/* Last name */}
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--glass-divider)' }}>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Фамилия
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            {/* Language */}
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--glass-divider)' }}>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Язык интерфейса
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="ru">🇷🇺 Русский</option>
                <option value="uz">🇺🇿 O&apos;zbek</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <button
                type="submit"
                disabled={saving}
                className="glass-btn rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              {msg && (
                <span className="text-sm" style={{ color: 'var(--glass-hint)' }}>
                  {msg}
                </span>
              )}
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
