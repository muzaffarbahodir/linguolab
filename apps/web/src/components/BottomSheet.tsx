import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useUIStore } from '../store/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  const touchStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const setBottomSheetOpen = useUIStore((s) => s.setBottomSheetOpen);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setBottomSheetOpen(true);
    } else {
      document.body.style.overflow = '';
      setBottomSheetOpen(false);
    }
    return () => {
      document.body.style.overflow = '';
      setBottomSheetOpen(false);
    };
  }, [open, setBottomSheetOpen]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchStartY.current = t.clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t || touchStartY.current === null) return;
    const delta = t.clientY - touchStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t || touchStartY.current === null) return;
    const delta = t.clientY - touchStartY.current;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (delta > 80) onClose();
    touchStartY.current = null;
  };

  // Portal — рендерим прямо в document.body,
  // чтобы анимации/transform на родителях не ломали fixed позиционирование
  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
        }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          background: '#1e2a3a',
          borderTop: '1px solid var(--hairline)',
          borderRadius: '24px 24px 0 0',
          transition: 'transform 0.2s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 9999,
              background: 'var(--surface-2)',
            }}
          />
        </div>

        {title && (
          <div style={{ padding: '10px 20px 10px', borderBottom: '1px solid var(--hairline)' }}>
            <h2 style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{title}</h2>
          </div>
        )}

        <div style={{ padding: '12px' }}>{children}</div>
      </div>
    </>,
    document.body,
  );
}
