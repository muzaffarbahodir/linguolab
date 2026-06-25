'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  classId: string;
  currentChatId: string | null;
}

/**
 * SetGroupForm — форма привязки Telegram-группы к классу.
 * Вводим chat_id группы (отрицательное число: -1001234567890).
 * Вызывает прокси /api/proxy/classes/:id/group.
 */
export function SetGroupForm({ classId, currentChatId }: Props) {
  const router = useRouter();
  const [chatId, setChatId] = useState(currentChatId ?? '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!chatId.trim()) return;
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/proxy/classes/${classId}/group`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_chat_id: chatId.trim() }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <input
        type="text"
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
        placeholder="-1001234567890"
        className="w-40 rounded-lg border border-gray-200 px-3 py-1.5 font-mono text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
      />
      <button
        onClick={() => void handleSave()}
        disabled={loading || !chatId.trim()}
        className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? '...' : saved ? '✓' : 'Сохранить'}
      </button>
    </div>
  );
}
