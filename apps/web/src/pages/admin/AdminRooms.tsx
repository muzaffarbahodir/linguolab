/**
 * AdminRooms — кабинеты (аудитории) центра.
 * ADMIN+ only. Route: /admin/rooms
 * Кабинет назначается классу при апруве заявки; две группы не могут
 * занимать один кабинет в пересекающееся время (блокируется на бэке).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useRooms, useCreateRoom, useUpdateRoom } from '../../api/admin';
import { toast } from '../../store/toast';

export function AdminRoomsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useRooms();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();

  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');

  useBackButton(() => navigate('/admin'));

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cap = parseInt(capacity, 10);
    createRoom.mutate(
      { name: trimmed, ...(cap > 0 ? { capacity: cap } : {}) },
      {
        onSuccess: () => {
          setName('');
          setCapacity('');
          WebApp.HapticFeedback.notificationOccurred('success');
        },
        onError: () => toast.error(t('admin.rooms.create_error')),
      },
    );
  };

  const toggle = (id: string, current: boolean) => {
    updateRoom.mutate(
      { id, is_active: !current },
      {
        onSuccess: () => WebApp.HapticFeedback.selectionChanged(),
        onError: () => toast.error(t('admin.rooms.update_error')),
      },
    );
  };

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <h1 className="text-lg font-bold">{t('admin.rooms.title')}</h1>
        <p className="text-muted text-xs">{t('admin.rooms.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Создание */}
        <div
          className="bg-surface rounded-2xl border p-4"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <p className="mb-2 text-sm font-semibold">{t('admin.rooms.add_title')}</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.rooms.name_ph')}
              className="bg-surface-2 border-hairline w-full rounded-xl border px-3 py-2 text-sm outline-none"
            />
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
              placeholder={t('admin.rooms.capacity_ph')}
              inputMode="numeric"
              className="bg-surface-2 border-hairline w-24 shrink-0 rounded-xl border px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createRoom.isPending}
            className="glass-btn press mt-3 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            {createRoom.isPending ? '…' : t('admin.rooms.add_btn')}
          </button>
        </div>

        {/* Список */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {(data ?? []).map((room) => (
          <div
            key={room.id}
            className="flex items-center gap-4 rounded-2xl p-4"
            style={{
              background: room.is_active ? 'var(--surface)' : 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              opacity: room.is_active ? 1 : 0.6,
            }}
          >
            <span className="text-2xl">🚪</span>
            <div className="flex-1">
              <p className="font-semibold">{room.name}</p>
              <p className="text-muted text-xs">
                {room.capacity
                  ? t('admin.rooms.capacity_n', { n: room.capacity })
                  : t('admin.rooms.capacity_na')}
                {' · '}
                {t('admin.rooms.classes_n', { n: room._count?.classes ?? 0 })}
              </p>
            </div>
            <button
              onClick={() => toggle(room.id, room.is_active)}
              disabled={updateRoom.isPending}
              className="relative h-7 w-12 rounded-full transition-all disabled:opacity-40"
              style={{ background: room.is_active ? '#8B5CF6' : 'var(--surface-2)' }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                style={{ left: room.is_active ? '26px' : '4px' }}
              />
            </button>
          </div>
        ))}

        {!isLoading && !data?.length && (
          <p className="text-muted py-10 text-center text-sm">{t('admin.rooms.no_data')}</p>
        )}
      </div>
    </div>
  );
}
