import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '../hooks/useBackButton';
import { Globe, Target, CreditCard, UserPlus } from 'lucide-react';

import { useAuthStore } from '../store/auth';
import { useLanguage } from '../hooks/useLanguage';
import { GenderRow, BirthDateRow, ThemeRow, CurrencyRow, MenuRow, type MenuItem } from './Profile';

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

  const items: MenuItem[] = isStudent
    ? [
        {
          Icon: Target,
          label: t('profile.placement_test'),
          onClick: () => navigate('/placement-test'),
        },
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
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <h1 className="text-lg font-bold">{t('profile.settings')}</h1>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-5">
        {/* Личные данные (студент) */}
        {isStudent && (
          <div className="glass-section overflow-hidden rounded-2xl">
            <GenderRow />
            <div className="bg-hairline mx-4 h-px" />
            <BirthDateRow />
          </div>
        )}

        {/* Тема, валюта, меню */}
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
