import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { apiClient } from '../api/client';
import { useAuthStore } from '../store/auth';

/** Как часто отправляем накопленное. */
const FLUSH_INTERVAL_MS = 10_000;

/** Больше этого за раз сервер всё равно не примет. */
const MAX_BATCH = 20;

/**
 * Отправляет статистику посещённых экранов.
 *
 * Копим и шлём пакетом, а не по событию на переход: экраны в мини-аппе
 * переключаются часто, и запрос на каждый превратился бы в постоянный фон
 * нагрузки — ради данных, которые прекрасно доезжают с задержкой в несколько
 * секунд.
 *
 * Ошибки глотаем молча. Аналитика не тот повод, чтобы показывать студенту
 * сообщение об ошибке или чем-то мешать ему пользоваться приложением.
 */
export function usePageViewTracking(): void {
  const { pathname } = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);

  const queue = useRef<string[]>([]);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // До авторизации отправлять некуда: событие пишется на пользователя.
    if (!accessToken) return;
    // Один и тот же экран подряд не считаем: ре-рендер это не новый просмотр.
    if (lastPath.current === pathname) return;

    lastPath.current = pathname;
    queue.current.push(pathname);
    if (queue.current.length > MAX_BATCH) queue.current.shift();
  }, [pathname, accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const flush = () => {
      if (queue.current.length === 0) return;
      const paths = queue.current;
      queue.current = [];
      apiClient.post('/analytics/page-views', { paths }).catch(() => {
        // Не возвращаем в очередь: при постоянной ошибке она росла бы
        // бесконечно, а потерянные просмотры того не стоят.
      });
    };

    const timer = setInterval(flush, FLUSH_INTERVAL_MS);

    // Мини-апп закрывают, не дожидаясь таймера, — досылаем при уходе со
    // страницы. visibilitychange надёжнее unload в мобильных браузерах.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, [accessToken]);
}
