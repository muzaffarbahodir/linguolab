import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../hooks/useBackButton';

import { LANGUAGES, applyLocale, useLanguage } from '../hooks/useLanguage';

export function LanguageSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useLanguage();

  useBackButton(() => navigate(-1));

  const handleSelect = (code: string) => {
    applyLocale(code);
    WebApp.HapticFeedback.selectionChanged();
    navigate(-1);
  };

  return (
    <div className="glass-fade-in flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-xl font-bold">{t('language_select.title')}</h1>

      <div className="glass-section overflow-hidden rounded-2xl">
        {LANGUAGES.map((lang, idx) => (
          <div key={lang.code}>
            <button
              onClick={() => handleSelect(lang.code)}
              className="press flex w-full items-center gap-3 px-4 py-4 text-left"
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="flex-1 font-medium">{lang.label}</span>
              {locale === lang.code && (
                <span className="text-lg font-bold" style={{ color: '#C8623F' }}>
                  ✓
                </span>
              )}
            </button>
            {idx < LANGUAGES.length - 1 && (
              <div className="mx-4 h-px" style={{ background: 'var(--surface-2)' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
