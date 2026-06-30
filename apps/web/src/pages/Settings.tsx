import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { Globe, CreditCard, UserPlus, UserRound, Cake } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useAuthStore } from '../store/auth';
import { useLanguage } from '../hooks/useLanguage';
import { useMe, usePatchMe } from '../api/users';
import { toast } from '../store/toast';
import { ThemeRow, CurrencyRow, MenuRow, type MenuItem } from './Profile';

/** Личные данные с явной кнопкой «Сохранить» (раньше авто-сейв терял дату). */
function PersonalData() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const patch = usePatchMe();

  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(me?.gender ?? null);
  const [birth, setBirth] = useState(me?.birth_date ? me.birth_date.slice(0, 10) : '');

  // Синхронизируемся, когда профиль подгрузился/обновился.
  useEffect(() => {
    setGender(me?.gender ?? null);
    setBirth(me?.birth_date ? me.birth_date.slice(0, 10) : '');
  }, [me]);

  const savedBirth = me?.birth_date ? me.birth_date.slice(0, 10) : '';
  const dirty = gender !== (me?.gender ?? null) || birth !== savedBirth;

  const save = () => {
    if (!dirty || patch.isPending) return;
    patch.mutate(
      { gender, birth_date: birth || null },
      {
        onSuccess: () => {
          try {
            WebApp.HapticFeedback.notificationOccurred('success');
          } catch {
            /* вне TWA */
          }
          toast.success(t('profile.saved'));
        },
        onError: () => toast.error(t('app.server_error')),
      },
    );
  };

  return (
    <div className="glass-section overflow-hidden rounded-2xl">
      <div className="flex w-full items-center gap-3 px-4 py-3.5">
        <UserRound size={20} strokeWidth={2} className="text-muted" />
        <span className="flex-1 text-sm font-medium">{t('profile.gender')}</span>
        <div className="bg-surface-2 flex overflow-hidden rounded-xl">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(gender === g ? null : g)}
              className={`press px-3 py-1 text-xs font-semibold transition-colors ${
                gender === g ? 'bg-brand text-white' : 'text-faint'
              }`}
            >
              {t(g === 'MALE' ? 'profile.gender_male' : 'profile.gender_female')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-hairline mx-4 h-px" />

      <div className="flex w-full items-center gap-3 px-4 py-3.5">
        <Cake size={20} strokeWidth={2} className="text-muted" />
        <span className="flex-1 text-sm font-medium">{t('profile.birth_date')}</span>
        <input
          type="date"
          value={birth}
          aria-label={t('profile.birth_date')}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirth(e.target.value)}
          className="bg-surface-2 text-faint rounded-xl px-2 py-1 text-xs outline-none"
        />
      </div>

      <div className="bg-hairline mx-4 h-px" />

      <button
        onClick={save}
        disabled={!dirty || patch.isPending}
        className="press text-brand w-full px-4 py-3 text-sm font-semibold disabled:opacity-40"
      >
        {patch.isPending ? t('profile.saving') : t('profile.save')}
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const realRole = useAuthStore((s) => s.user?.role);
  const previewRole = useAuthStore((s) => s.previewRole);
  const role = previewRole ?? realRole;
  const { current: currentLang } = useLanguage();

  useBackButton(() => navigate(-1));

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER';
  const isTeacher = role === 'TEACHER';
  const isParent = role === 'PARENT';
  const isStudent = !isAdmin && !isTeacher && !isParent;

  const langItem: MenuItem = {
    Icon: Globe,
    label: t('profile.language'),
    hint: `${currentLang.flag} ${currentLang.label}`,
    onClick: () => navigate('/language'),
  };

  // Тест уровня переехал в «Мой кабинет» — здесь его больше нет.
  const items: MenuItem[] = isStudent
    ? [
        { Icon: CreditCard, label: t('profile.payment'), onClick: () => navigate('/payment') },
        {
          Icon: UserPlus,
          label: t('profile.invite_parent'),
          hint: t('profile.invite_parent_hint'),
          onClick: () => navigate('/parent/link'),
        },
        langItem,
      ]
    : [langItem];

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass px-4 pb-4 pt-6">
        <h1 className="text-lg font-bold">{t('profile.settings')}</h1>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-5">
        {isStudent && <PersonalData />}

        <div className="glass-section overflow-hidden rounded-2xl">
          <ThemeRow />
          <div className="bg-hairline mx-4 h-px" />
          <CurrencyRow />
          <div className="bg-hairline mx-4 h-px" />
          {items.map((item, idx) => (
            <div key={item.label}>
              <MenuRow {...item} />
              {idx < items.length - 1 && <div className="bg-hairline mx-4 h-px" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
