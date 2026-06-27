import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import axios from 'axios';

import { useLanguages, type Language } from '../api/languages';
import { useClasses, useEnrollClass, type ClassItem } from '../api/classes';
import { useCurrency } from '../hooks/useCurrency';
import { toast } from '../store/toast';
import { EmptyState } from '../components/EmptyState';

// ─── types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const LEVEL_COLORS: Record<string, string> = {
  A1: '#10B981',
  A2: '#3B82F6',
  B1: '#F59E0B',
  B2: '#EF4444',
  C1: '#818cf8',
  C2: '#EC4899',
};

// ─── Step 1: выбор языка ─────────────────────────────────────────────────────

function StepLanguage({ onSelect }: { onSelect: (lang: Language) => void }) {
  const { t } = useTranslation();
  const { data: languages, isLoading } = useLanguages();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">{t('booking.step1_title')}</h2>
        <p className="text-tg-hint text-sm">{t('booking.step1_sub')}</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      )}

      <div className="stagger grid grid-cols-2 gap-3">
        {languages?.map((lang) => (
          <button
            key={lang.id}
            onClick={() => onSelect(lang)}
            className="press shadow-e1 flex flex-col items-center justify-center gap-2 rounded-2xl p-5 font-semibold text-white"
            style={{ backgroundColor: lang.color ?? '#6366f1' }}
          >
            <span className="text-4xl">{lang.flag_emoji}</span>
            <span className="text-sm">{lang.name_ru}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: выбор класса ─────────────────────────────────────────────────────

function StepClass({
  language,
  onSelect,
}: {
  language: Language;
  onSelect: (cls: ClassItem) => void;
}) {
  const { t } = useTranslation();
  const { data: classes, isLoading, isError } = useClasses(language.id);
  const { fmt, currency } = useCurrency();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-2xl">{language.flag_emoji}</span>
          <h2 className="text-lg font-bold">{language.name_ru}</h2>
        </div>
        <p className="text-tg-hint text-sm">{t('booking.step2_sub')}</p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState emoji="⚠️" title={t('booking.step2_load_error')} />}

      {!isLoading && classes?.length === 0 && (
        <EmptyState emoji="📚" title={t('booking.step2_empty')} />
      )}

      <div className="stagger flex flex-col gap-3">
        {classes?.map((cls) => {
          const levelColor = LEVEL_COLORS[cls.level] ?? '#6366f1';
          const isFull = cls.spots_left <= 0;
          const teacherName = `${cls.teacher.user.first_name}${cls.teacher.user.last_name ? ' ' + cls.teacher.user.last_name : ''}`;

          return (
            <button
              key={cls.id}
              onClick={() => !isFull && onSelect(cls)}
              disabled={isFull}
              className="bg-tg-secondary-bg press shadow-e1 overflow-hidden rounded-2xl text-left disabled:opacity-50"
            >
              <div className="h-1" style={{ backgroundColor: language.color ?? '#6366f1' }} />
              <div className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold leading-tight">{cls.title}</span>
                  <span
                    className="ml-2 flex-none rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: levelColor }}
                  >
                    {cls.level}
                  </span>
                </div>
                {/* Преподаватель — выбор свободного учителя по курсу */}
                <div className="bg-surface mb-2 flex items-center gap-2 rounded-xl px-2.5 py-1.5">
                  {cls.teacher.user.avatar_url ? (
                    <img
                      src={cls.teacher.user.avatar_url}
                      alt={teacherName}
                      className="h-7 w-7 flex-none rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: language.color ?? '#6366f1' }}
                    >
                      {cls.teacher.user.first_name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-faint text-[10px] uppercase tracking-wide">
                      {t('booking.teacher_label')}
                    </p>
                    <p className="truncate text-xs font-semibold">{teacherName}</p>
                  </div>
                  {!isFull && (
                    <span className="bg-ok/15 text-ok flex-none rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {t('booking.teacher_free')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {currency === 'USD' && cls.price_usd > 0
                      ? `$${cls.price_usd}`
                      : fmt(cls.price_uzs)}
                    {t('booking.per_month')}
                  </span>
                  <span className="text-tg-hint text-xs">
                    {isFull ? (
                      <span className="text-red-500">{t('booking.no_spots')}</span>
                    ) : (
                      t('booking.spots', { n: cls.spots_left })
                    )}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: подтверждение ────────────────────────────────────────────────────

function StepConfirm({
  language,
  cls,
  onSuccess,
}: {
  language: Language;
  cls: ClassItem;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: enroll, isPending } = useEnrollClass();
  const { fmt, currency } = useCurrency();
  const levelColor = LEVEL_COLORS[cls.level] ?? '#6366f1';
  const teacherName = `${cls.teacher.user.first_name}${cls.teacher.user.last_name ? ' ' + cls.teacher.user.last_name : ''}`;
  const priceDisplay =
    currency === 'USD' && cls.price_usd > 0 ? `$${cls.price_usd}` : fmt(cls.price_uzs);

  function handleConfirm() {
    enroll(cls.id, {
      onSuccess: () => {
        toast.success(t('booking.alert_success'));
        onSuccess();
      },
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 409) {
            toast.info(t('booking.alert_duplicate'));
            onSuccess();
          } else if (status === 400) {
            toast.error(t('booking.alert_no_spots'));
          } else {
            toast.error(t('booking.alert_error'));
          }
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">{t('booking.step3_title')}</h2>
        <p className="text-tg-hint text-sm">{t('booking.step3_sub')}</p>
      </div>

      {/* Class card */}
      <div className="bg-tg-secondary-bg overflow-hidden rounded-2xl">
        <div className="h-1.5" style={{ backgroundColor: language.color ?? '#6366f1' }} />
        <div className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-4xl">{language.flag_emoji}</span>
            <div>
              <p className="font-bold">{language.name_ru}</p>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: levelColor }}
              >
                {cls.level}
              </span>
            </div>
          </div>

          <h3 className="mb-4 text-base font-semibold">{cls.title}</h3>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tg-hint">{t('booking.teacher')}</span>
              <span className="font-medium">{teacherName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">{t('booking.cost')}</span>
              <span className="font-bold">
                {priceDisplay}
                {t('booking.per_month')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">{t('booking.free_spots')}</span>
              <span className="font-medium">{cls.spots_left}</span>
            </div>
          </div>

          {cls.description && (
            <p className="text-tg-hint mt-4 text-xs leading-relaxed">{cls.description}</p>
          )}
        </div>
      </div>

      {/* Notice */}
      <div className="bg-brand/10 rounded-xl p-3">
        <p className="text-brand text-xs leading-relaxed">{t('booking.notice')}</p>
      </div>

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={isPending}
        className="bg-brand press w-full rounded-2xl py-4 font-bold text-white disabled:opacity-50"
      >
        {isPending ? t('booking.sending') : t('booking.submit')}
      </button>

      {/* Pay now button — записаться и сразу оплатить */}
      <button
        onClick={() =>
          navigate('/payment', {
            state: { classId: cls.id, classTitle: cls.title, priceUzs: cls.price_uzs },
          })
        }
        className="press w-full rounded-2xl border-2 border-blue-500 py-4 font-bold text-blue-600 dark:text-blue-400"
      >
        {t('payment.pay_btn')}
      </button>
    </div>
  );
}

// ─── main: BookingPage ────────────────────────────────────────────────────────

export function BookingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Telegram BackButton — управляет шагами
  const handleBack = useCallback(() => {
    if (step === 1) {
      navigate('/');
    } else if (step === 2) {
      setSelectedLanguage(null);
      setStep(1);
    } else {
      setSelectedClass(null);
      setStep(2);
    }
  }, [step, navigate]);

  useEffect(() => {
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(handleBack);
    return () => {
      WebApp.BackButton.offClick(handleBack);
      WebApp.BackButton.hide();
    };
  }, [handleBack]);

  function goStep2(lang: Language) {
    setSelectedLanguage(lang);
    setStep(2);
  }

  function goStep3(cls: ClassItem) {
    setSelectedClass(cls);
    setStep(3);
  }

  function onSuccess() {
    navigate('/schedule');
  }

  return (
    <div className="px-4 pb-8 pt-6">
      {step === 1 && <StepLanguage onSelect={goStep2} />}
      {step === 2 && selectedLanguage && (
        <StepClass language={selectedLanguage} onSelect={goStep3} />
      )}
      {step === 3 && selectedLanguage && selectedClass && (
        <StepConfirm language={selectedLanguage} cls={selectedClass} onSuccess={onSuccess} />
      )}
    </div>
  );
}
