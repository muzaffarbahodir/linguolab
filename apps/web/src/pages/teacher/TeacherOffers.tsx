/**
 * TeacherOffers — учитель управляет офферами «готов учить предмет».
 * Виден студентам на странице курса до открытия группы. Route: /teacher/offers
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { Trash2, Plus } from 'lucide-react';

import { useBackButton } from '../../hooks/useBackButton';
import { useLanguages } from '../../api/languages';
import { useMyOffers, useUpsertOffer, useDeleteOffer } from '../../api/teacher-offers';

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const FORMATS: { v: '' | 'ONLINE' | 'OFFLINE'; label: string }[] = [
  { v: '', label: 'Любой' },
  { v: 'ONLINE', label: 'Онлайн' },
  { v: 'OFFLINE', label: 'Очно' },
];

export function TeacherOffersPage() {
  const navigate = useNavigate();
  const { data: languages } = useLanguages();
  const { data: offers, isLoading } = useMyOffers();
  const upsert = useUpsertOffer();
  const del = useDeleteOffer();

  useBackButton(() => navigate('/teacher'));

  const [languageId, setLanguageId] = useState('');
  const [level, setLevel] = useState('');
  const [format, setFormat] = useState<'' | 'ONLINE' | 'OFFLINE'>('');
  const [priceUzs, setPriceUzs] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    if (!languageId) {
      WebApp.showAlert('Выберите предмет');
      return;
    }
    upsert.mutate(
      {
        language_id: languageId,
        level: level || null,
        format: format || null,
        price_uzs: Number(priceUzs) || 0,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setLevel('');
          setFormat('');
          setPriceUzs('');
          setNote('');
          WebApp.HapticFeedback.notificationOccurred('success');
        },
      },
    );
  };

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <h1 className="mb-1 text-xl font-bold">Готов учить</h1>
      <p className="text-muted mb-4 text-sm">
        Офферы видны студентам до открытия группы — они оставляют заявку.
      </p>

      {/* Форма создания */}
      <div className="glass-card mb-5 flex flex-col gap-3 rounded-2xl p-4">
        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Предмет</label>
          <select
            value={languageId}
            onChange={(e) => setLanguageId(e.target.value)}
            className="input"
          >
            <option value="">— выбрать —</option>
            {languages?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name_ru}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-muted mb-1 block text-xs font-medium">Уровень</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="input">
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv || 'Любой'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-muted mb-1 block text-xs font-medium">Формат</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as '' | 'ONLINE' | 'OFFLINE')}
              className="input"
            >
              {FORMATS.map((f) => (
                <option key={f.v} value={f.v}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Цена за месяц, UZS</label>
          <input
            value={priceUzs}
            onChange={(e) => setPriceUzs(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="0"
            className="input"
          />
        </div>

        <div>
          <label className="text-muted mb-1 block text-xs font-medium">Описание</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Чему и как учите, опыт…"
            className="input resize-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={upsert.isPending}
          className="glass-btn press flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <Plus size={16} />
          {upsert.isPending ? 'Сохраняем…' : 'Сохранить оффер'}
        </button>
      </div>

      {/* Список офферов */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
        </div>
      ) : !offers?.length ? (
        <p className="text-muted py-6 text-center text-sm">Пока нет офферов</p>
      ) : (
        <div className="flex flex-col gap-2">
          {offers.map((o) => (
            <div key={o.id} className="glass-card flex items-center gap-3 rounded-2xl p-3">
              <span className="text-xl">{o.language.flag_emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{o.language.name_ru}</p>
                <p className="text-muted text-xs">
                  {o.level || 'любой уровень'}
                  {o.format ? ` · ${o.format === 'ONLINE' ? 'онлайн' : 'очно'}` : ''}
                  {o.price_uzs > 0 ? ` · ${o.price_uzs.toLocaleString()} UZS` : ''}
                </p>
              </div>
              <button
                onClick={() => del.mutate(o.id)}
                disabled={del.isPending}
                className="text-danger press shrink-0 p-1.5"
                aria-label="Удалить"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
