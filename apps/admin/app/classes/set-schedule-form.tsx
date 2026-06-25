'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DAYS = [
  { key: 'MON', label: 'Пн' },
  { key: 'TUE', label: 'Вт' },
  { key: 'WED', label: 'Ср' },
  { key: 'THU', label: 'Чт' },
  { key: 'FRI', label: 'Пт' },
  { key: 'SAT', label: 'Сб' },
  { key: 'SUN', label: 'Вс' },
];

interface Props {
  classId: string;
  currentDays: string[];
  currentTime: string | null;
  currentDuration: number | null;
}

export function SetScheduleForm({ classId, currentDays, currentTime, currentDuration }: Props) {
  const router = useRouter();
  const [days, setDays] = useState<string[]>(currentDays);
  const [time, setTime] = useState(currentTime ?? '');
  const [duration, setDuration] = useState(currentDuration?.toString() ?? '90');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleDay = (key: string) => {
    setDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!days.length || !time) return;
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/proxy/classes/${classId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_days: days,
          schedule_time: time,
          schedule_duration: duration ? parseInt(duration, 10) : null,
        }),
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
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="mb-2 text-xs font-medium text-gray-500">Расписание</p>
      {/* Day picker */}
      <div className="mb-2 flex flex-wrap gap-1">
        {DAYS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleDay(key)}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
              days.includes(key)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Time + duration + save */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setSaved(false);
          }}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
        <input
          type="number"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            setSaved(false);
          }}
          placeholder="мин"
          min={30}
          max={240}
          className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
        <span className="text-xs text-gray-400">мин</span>
        <button
          onClick={() => void handleSave()}
          disabled={loading || !days.length || !time}
          className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '...' : saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
