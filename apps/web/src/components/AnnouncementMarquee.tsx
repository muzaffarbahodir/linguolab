/**
 * AnnouncementMarquee — бегущая строка (вверху + внизу как новостная лента).
 * Активные баннеры группируются по позиции и стилю; тексты крутятся бесконечно
 * (контент дублируется для бесшовного цикла).
 */
import {
  useActiveAnnouncements,
  type ActiveAnnouncement,
  type AnnouncementStyle,
} from '../api/announcements';

const STYLE_CLASS: Record<AnnouncementStyle, string> = {
  CAUTION: 'll-ann-caution',
  INFO: 'll-ann-info',
  PROMO: 'll-ann-promo',
};

const ORDER: AnnouncementStyle[] = ['CAUTION', 'INFO', 'PROMO'];

function Bars({ items }: { items: ActiveAnnouncement[] }) {
  const groups = ORDER.map((style) => ({
    style,
    texts: items.filter((a) => a.style === style).map((a) => a.text),
  })).filter((g) => g.texts.length > 0);

  return (
    <>
      {groups.map(({ style, texts }) => {
        const joined = texts.join('  •  ');
        // Скорость постоянная: проход = ширина экрана (~380px) + ширина текста.
        const durationSec = Math.max(6, Math.round((joined.length * 7 + 380) / 90));
        return (
          <div key={style} className={`ll-marquee-bar ${STYLE_CLASS[style]}`}>
            <div className="ll-marquee-track" style={{ animationDuration: `${durationSec}s` }}>
              <span>{joined}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AnnouncementMarquee() {
  const { data } = useActiveAnnouncements();
  if (!data?.length) return null;

  const top = data.filter((a) => a.position !== 'BOTTOM');
  const bottom = data.filter((a) => a.position === 'BOTTOM');

  return (
    <>
      {top.length > 0 && (
        <div className="flex flex-col">
          <Bars items={top} />
        </div>
      )}
      {bottom.length > 0 && (
        // Фиксируем над плавающим нижним меню (как новостная лента снизу).
        <div
          className="fixed left-0 right-0 z-40 flex flex-col shadow-[0_-4px_16px_rgba(0,0,0,0.18)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 74px)' }}
        >
          <Bars items={bottom} />
        </div>
      )}
    </>
  );
}
