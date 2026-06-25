'use client';

// ── FloralDecor — ambient decoration components ───────────────────────────
// Adapted from FlowerShop FloralDecor.tsx for LinguoLab portal.
// Uses CSS animations from glass.css: floral-petal-wind, floral-float, etc.

import React from 'react';

// ── Floating petals (ambient drift across screen) ─────────────────────────
const PETAL_CONFIGS = [
  { delay: '0s', duration: '9s', left: '3%', size: 9, opacity: 0.55 },
  { delay: '1.4s', duration: '11s', left: '18%', size: 7, opacity: 0.45 },
  { delay: '3.1s', duration: '8s', left: '33%', size: 11, opacity: 0.5 },
  { delay: '0.7s', duration: '13s', left: '48%', size: 8, opacity: 0.4 },
  { delay: '2.5s', duration: '10s', left: '62%', size: 10, opacity: 0.48 },
  { delay: '4.2s', duration: '9s', left: '76%', size: 7, opacity: 0.42 },
  { delay: '1.8s', duration: '12s', left: '88%', size: 9, opacity: 0.38 },
  { delay: '5.0s', duration: '11s', left: '10%', size: 6, opacity: 0.35 },
];

export function HorizontalPetals({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 overflow-hidden ${className}`}
      style={{ height: 32 }}
      aria-hidden
    >
      {PETAL_CONFIGS.map((p, i) => (
        <span
          key={i}
          className="floral-petal-wind"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
            opacity: p.opacity,
            borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
            background:
              i % 3 === 0
                ? 'rgba(16,185,129,0.7)'
                : i % 3 === 1
                  ? 'rgba(52,211,153,0.6)'
                  : 'rgba(110,231,183,0.55)',
          }}
        />
      ))}
    </div>
  );
}

// ── Book icon with float animation ────────────────────────────────────────
export function BookIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={`floral-float ${className}`}
      aria-hidden
    >
      <path d="M24 40V16" stroke="rgba(16,185,129,0.8)" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10 16 Q10 12 14 12 L24 16 L24 40 L14 38 Q10 38 10 34 Z"
        fill="rgba(16,185,129,0.25)"
        stroke="rgba(16,185,129,0.6)"
        strokeWidth="1.2"
      />
      <path
        d="M38 16 Q38 12 34 12 L24 16 L24 40 L34 38 Q38 38 38 34 Z"
        fill="rgba(52,211,153,0.18)"
        stroke="rgba(52,211,153,0.5)"
        strokeWidth="1.2"
      />
      <circle cx="24" cy="10" r="3" fill="rgba(16,185,129,0.5)" />
    </svg>
  );
}

// ── Star burst (achievement / level up decoration) ────────────────────────
export function StarBurst({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={`floral-bloom-pulse ${className}`}
      aria-hidden
    >
      <polygon
        points="20,4 23.5,15 35,15 25.5,22 29,33 20,26 11,33 14.5,22 5,15 16.5,15"
        fill="rgba(245,158,11,0.30)"
        stroke="rgba(245,158,11,0.70)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Section title with decorative accent ─────────────────────────────────
export function DecorSectionTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="floral-bloom-pulse inline-block text-lg leading-none" aria-hidden>
        ✦
      </span>
      <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--glass-hint)' }}>
        {children}
      </span>
      <span
        className="floral-bloom-pulse inline-block text-lg leading-none"
        style={{ animationDelay: '2s' }}
        aria-hidden
      >
        ✦
      </span>
    </div>
  );
}

// ── Corner ornament ───────────────────────────────────────────────────────
type CornerPos = 'tl' | 'tr' | 'bl' | 'br';

export function CornerDecor({
  position = 'tr',
  className = '',
}: {
  position?: CornerPos;
  className?: string;
}) {
  const posStyle: React.CSSProperties = {
    tl: { top: 0, left: 0 },
    tr: { top: 0, right: 0, transform: 'scaleX(-1)' },
    bl: { bottom: 0, left: 0, transform: 'scaleY(-1)' },
    br: { bottom: 0, right: 0, transform: 'scale(-1,-1)' },
  }[position];

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className={`pointer-events-none absolute ${className}`}
      style={{ ...posStyle, opacity: 0.25 }}
      aria-hidden
    >
      <path
        d="M4 4 Q4 24 24 24"
        stroke="rgba(16,185,129,0.8)"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="6" cy="6" r="2" fill="rgba(16,185,129,0.6)" />
      <circle cx="14" cy="10" r="1.5" fill="rgba(52,211,153,0.5)" />
      <circle cx="22" cy="20" r="1.2" fill="rgba(110,231,183,0.4)" />
    </svg>
  );
}

// ── Divider with center ornament ──────────────────────────────────────────
export function GlassDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <div
        className="h-px flex-1"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(16,185,129,0.3), transparent)',
        }}
      />
      <span className="floral-bloom-pulse text-xs" style={{ color: 'rgba(16,185,129,0.6)' }}>
        ✦
      </span>
      <div
        className="h-px flex-1"
        style={{
          background: 'linear-gradient(to left, transparent, rgba(16,185,129,0.3), transparent)',
        }}
      />
    </div>
  );
}

// ── Empty state illustration ──────────────────────────────────────────────
export function EmptyIllustration({ size = 100 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className="floral-float"
      aria-hidden
    >
      {/* Book stack */}
      <rect
        x="20"
        y="55"
        width="60"
        height="10"
        rx="3"
        fill="rgba(16,185,129,0.25)"
        stroke="rgba(16,185,129,0.5)"
        strokeWidth="1"
      />
      <rect
        x="25"
        y="42"
        width="50"
        height="14"
        rx="3"
        fill="rgba(52,211,153,0.20)"
        stroke="rgba(52,211,153,0.45)"
        strokeWidth="1"
      />
      <rect
        x="30"
        y="30"
        width="40"
        height="13"
        rx="3"
        fill="rgba(110,231,183,0.18)"
        stroke="rgba(110,231,183,0.4)"
        strokeWidth="1"
      />
      {/* Star */}
      <polygon
        points="50,10 52.5,17 60,17 54,22 56.5,29 50,24.5 43.5,29 46,22 40,17 47.5,17"
        fill="rgba(245,158,11,0.35)"
        stroke="rgba(245,158,11,0.6)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
