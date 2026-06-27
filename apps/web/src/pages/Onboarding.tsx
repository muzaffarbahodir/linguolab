/**
 * Onboarding — Welcome-флоу для новых пользователей.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

interface OnboardingProps {
  onClose: () => void;
}

const SLIDES = [
  {
    emoji: '🎓',
    titleKey: 'onboarding.slide1_title',
    textKey: 'onboarding.slide1_text',
    color: '#C8623F',
    glow: 'rgba(200,98,63,0.35)',
  },
  {
    emoji: '📅',
    titleKey: 'onboarding.slide2_title',
    textKey: 'onboarding.slide2_text',
    color: '#E0875A',
    glow: 'rgba(224,135,90,0.35)',
  },
  {
    emoji: '🏆',
    titleKey: 'onboarding.slide3_title',
    textKey: 'onboarding.slide3_text',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.35)',
  },
];

export function Onboarding({ onClose }: OnboardingProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const isLast = current === SLIDES.length - 1;
  const slide = SLIDES[current] ?? SLIDES[0]!;

  const handleNext = () => {
    if (isLast) {
      WebApp.CloudStorage.setItem('onboarding_done', 'done', () => {});
      WebApp.HapticFeedback.notificationOccurred('success');
      onClose();
    } else {
      WebApp.HapticFeedback.selectionChanged();
      setCurrent((p) => p + 1);
    }
  };

  const handleSkip = () => {
    WebApp.CloudStorage.setItem('onboarding_done', 'done', () => {});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#1b1815' }}>
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button onClick={handleSkip} className="text-tg-hint press text-sm">
          {t('app.skip', { defaultValue: 'Пропустить' })}
        </button>
      </div>

      {/* Slide content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-8">
        {/* Emoji icon in glass circle with glow */}
        <div
          className="floral-bloom-pulse mb-8 flex h-28 w-28 items-center justify-center rounded-full text-5xl"
          style={{
            background: `radial-gradient(circle, ${slide.glow} 0%, rgba(255,255,255,0.04) 100%)`,
            border: `1.5px solid ${slide.color}44`,
            boxShadow: `0 0 40px ${slide.glow}`,
          }}
        >
          {slide.emoji}
        </div>

        <h2 className="mb-3 text-center text-2xl font-bold" style={{ color: slide.color }}>
          {t(slide.titleKey)}
        </h2>
        <p className="text-tg-hint text-center text-base leading-relaxed">{t(slide.textKey)}</p>
      </div>

      {/* Dots + button */}
      <div className="px-6 pb-10">
        {/* Dots */}
        <div className="mb-5 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setCurrent(i)}
              className="h-2 cursor-pointer transition-all duration-300"
              style={{
                width: i === current ? 24 : 8,
                borderRadius: 999,
                background: i === current ? slide.color : 'var(--surface-2)',
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="glass-btn press w-full rounded-2xl py-4 text-base font-bold"
          style={{ background: slide.color, boxShadow: `0 8px 32px ${slide.glow}` }}
        >
          {isLast ? t('onboarding.btn_start') : t('onboarding.btn_next')}
        </button>
      </div>
    </div>
  );
}
