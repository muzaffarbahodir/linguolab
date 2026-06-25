import { useEffect, useRef } from 'react';
import WebApp from '@twa-dev/sdk';

/**
 * Telegram BackButton — корректная регистрация с очисткой.
 *
 * Баг до этого: страницы звали `WebApp.BackButton.onClick(fn)` прямо в теле
 * рендера без `offClick`. Обработчики копились между навигациями → одно нажатие
 * "назад" вызывало N обработчиков → перескок на главный экран.
 *
 * Хук регистрирует ОДИН стабильный обработчик в useEffect и снимает его при
 * размонтировании. Через ref всегда зовётся свежий onBack (можно зависеть от
 * state без переподписки).
 */
export function useBackButton(onBack: () => void) {
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    const cb = () => handler.current();
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(cb);
    return () => {
      WebApp.BackButton.offClick(cb);
      WebApp.BackButton.hide();
    };
  }, []);
}
