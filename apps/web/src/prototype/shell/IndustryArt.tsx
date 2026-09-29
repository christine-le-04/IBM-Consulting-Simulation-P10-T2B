/**
 * One illustration per industry, drawn in the same flat style as Dana's avatar
 * — no stock imagery. Covers every industry in the scenario catalogue (26 in
 * the seeded database), with a neutral fallback for anything new an admin adds.
 */
import type { ReactNode } from 'react'

const NAVY = '#1c3a6e'
const BLUE = '#0f62fe'
const SKY = '#a6c8ff'
const WHITE = '#ffffff'
const INK = '#161616'

interface Art {
  bg: string
  draw: ReactNode
}

const ART: Record<string, Art> = {
  Healthcare: {
    bg: '#d9fbfb',
    draw: (
      <>
        <rect x="16" y="22" width="32" height="26" fill={WHITE} />
        <rect x="16" y="22" width="32" height="5" fill={NAVY} />
        <rect x="19" y="41" width="6" height="7" fill={SKY} />
        <rect x="39" y="41" width="6" height="7" fill={SKY} />
        <path d="M29.5 28h5v3.5h3.5v5h-3.5v3.5h-5v-3.5H26v-5h3.5z" fill="#da1e28" />
      </>
    ),
  },
  'Health & Wellness': {
    bg: '#ffd6e8',
    draw: (
      <>
        <path d="M32 47C18 38 15 31 18 25c3-5 10-5 14 1 4-6 11-6 14-1 3 6 0 13-14 22z" fill="#ee5396" />
        <path d="M17 34h8l3-5 4 9 3-6h12" stroke={WHITE} strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </>
    ),
  },
  'Life Sciences': {
    bg: '#e8daff',
    draw: (
      <>
        <path d="M27 16h10v11l9 16c1 3-1 5-4 5H22c-3 0-5-2-4-5l9-16z" fill={WHITE} />
        <path d="M22.5 40l5-9h8.5l5 9c1 2 0 3-2 3H24.5c-2 0-3-1-2-3z" fill="#8a3ffc" />
        <rect x="25" y="14" width="14" height="3" rx="1" fill={NAVY} />
        <circle cx="30" cy="37" r="1.6" fill={WHITE} />
        <circle cx="34" cy="34" r="1.1" fill={WHITE} />
      </>
    ),
  },
  'Energy & Utilities': {
    bg: '#fcf4d6',
    draw: (
      <>
        <path d="M32 12l-9 36h4l5-20 5 20h4z" fill={NAVY} />
        <path d="M22 22h20M24 30h16" stroke={NAVY} strokeWidth="2.4" />
        <path d="M36 22l-6 11h5l-3 10 8-14h-5l3-7z" fill="#f1c21b" stroke={INK} strokeWidth="0.6" />
      </>
    ),
  },
  'Water & Environment': {
    bg: '#d0e2ff',
    draw: (
      <>
        <path d="M30 14c6 9 12 16 12 23a12 12 0 0 1-24 0c0-7 6-14 12-23z" fill={BLUE} />
        <path d="M25 37a6 6 0 0 0 5 6" stroke={WHITE} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M40 46c2-8 7-12 12-12-1 7-5 12-12 12z" fill="#24a148" />
      </>
    ),
  },
  'Mining & Resources': {
    bg: '#f2f4f8',
    draw: (
      <>
        <path d="M10 48l14-22 8 10 6-8 16 20z" fill="#8d8d8d" />
        <path d="M24 26l4 6-6 3z" fill={WHITE} />
        <path d="M35 17l14 14" stroke="#8a5a2b" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 22c4-6 12-8 18-6-5 1-9 4-11 9z" fill={NAVY} />
      </>
    ),
  },
  'Aerospace & Aviation': {
    bg: '#d0e2ff',
    draw: (
      <>
        <path d="M13 36l38-14c3-1 5 1 3 3L28 42z" fill={WHITE} />
        <path d="M31 30l-6-12h-4l4 15zM33 38l4 10h4l-2-13z" fill={NAVY} />
        <path d="M13 36l-3-8h4l6 5z" fill={BLUE} />
      </>
    ),
  },
  'Transport & Logistics': {
    bg: '#ffe0cc',
    draw: (
      <>
        <rect x="12" y="22" width="26" height="18" fill={WHITE} />
        <path d="M38 27h8l6 7v6H38z" fill="#ff832b" />
        <rect x="41" y="29" width="5" height="5" fill={WHITE} />
        <circle cx="20" cy="42" r="4" fill={INK} />
        <circle cx="44" cy="42" r="4" fill={INK} />
        <path d="M17 29h16" stroke={NAVY} strokeWidth="2" />
      </>
    ),
  },
  'Retail & Logistics': {
    bg: '#ffd6e8',
    draw: (
      <>
        <path d="M18 24h28l-2 24H20z" fill="#ee5396" />
        <path d="M26 26v-4a6 6 0 0 1 12 0v4" stroke={NAVY} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <rect x="27" y="33" width="10" height="8" fill={WHITE} />
      </>
    ),
  },
  'Consumer Products': {
    bg: '#fcf4d6',
    draw: (
      <>
        <path d="M13 18h6l5 20h20l4-14H22" stroke={NAVY} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="25" y="22" width="8" height="10" fill="#ff832b" />
        <rect x="34" y="25" width="8" height="7" fill={BLUE} />
        <circle cx="27" cy="44" r="3" fill={INK} />
        <circle cx="41" cy="44" r="3" fill={INK} />
      </>
    ),
  },
  'Food & Agriculture': {
    bg: '#defbe6',
    draw: (
      <>
        <path d="M32 50V18" stroke="#8a5a2b" strokeWidth="2.4" />
        {[20, 27, 34].map((y) => (
          <g key={y}>
            <ellipse cx="27" cy={y} rx="3.4" ry="5.5" transform={`rotate(-30 27 ${y})`} fill="#f1c21b" />
            <ellipse cx="37" cy={y} rx="3.4" ry="5.5" transform={`rotate(30 37 ${y})`} fill="#f1c21b" />
          </g>
        ))}
        <path d="M22 50c3-6 7-8 10-8s7 2 10 8z" fill="#24a148" />
      </>
    ),
  },
  'Industrial Manufacturing': {
    bg: '#e5e5e5',
    draw: (
      <>
        <path d="M12 48V30l10 6v-6l10 6v-6l10 6V16h8v32z" fill={NAVY} />
        <rect x="17" y="40" width="5" height="4" fill="#f1c21b" />
        <rect x="27" y="40" width="5" height="4" fill="#f1c21b" />
        <rect x="37" y="40" width="5" height="4" fill="#f1c21b" />
        <circle cx="46" cy="12" r="3" fill="#c6c6c6" />
      </>
    ),
  },
  Automotive: {
    bg: '#fff1f1',
    draw: (
      <>
        <path d="M12 40v-6l6-2 5-8h16l7 8 6 2v6z" fill="#da1e28" />
        <path d="M25 26h6v6h-10zM33 26h5l5 6h-10z" fill={SKY} />
        <circle cx="21" cy="41" r="4.5" fill={INK} />
        <circle cx="44" cy="41" r="4.5" fill={INK} />
        <circle cx="21" cy="41" r="1.6" fill={WHITE} />
        <circle cx="44" cy="41" r="1.6" fill={WHITE} />
      </>
    ),
  },
  'Financial Services': {
    bg: '#d0e2ff',
    draw: (
      <>
        <path d="M32 12l18 9H14z" fill={NAVY} />
        {[19, 26, 33, 40].map((x) => <rect key={x} x={x} y="23" width="5" height="18" fill={WHITE} />)}
        <rect x="14" y="42" width="36" height="5" fill={NAVY} />
        <circle cx="32" cy="17.5" r="2" fill="#f1c21b" />
      </>
    ),
  },
  Insurance: {
    bg: '#defbe6',
    draw: (
      <>
        <path d="M32 12l16 6v11c0 11-7 17-16 21-9-4-16-10-16-21V18z" fill={NAVY} />
        <path d="M24 31l6 6 11-12" stroke="#42be65" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'Public Sector': {
    bg: '#e8daff',
    draw: (
      <>
        <rect x="16" y="24" width="32" height="22" fill={WHITE} />
        <path d="M14 24h36l-18-9z" fill={NAVY} />
        {[20, 29, 38].map((x) => <rect key={x} x={x} y="29" width="6" height="8" fill={SKY} />)}
        <rect x="29" y="38" width="6" height="8" fill={NAVY} />
        <path d="M32 15V8" stroke={INK} strokeWidth="1.4" />
        <path d="M32 8h6l-2 2 2 2h-6z" fill={BLUE} />
      </>
    ),
  },
  Government: {
    bg: '#d0e2ff',
    draw: (
      <>
        <path d="M22 26a10 10 0 0 1 20 0z" fill={NAVY} />
        <rect x="31" y="11" width="2" height="6" fill={NAVY} />
        <rect x="18" y="26" width="28" height="4" fill={NAVY} />
        {[20, 26, 32, 38].map((x) => <rect key={x} x={x} y="31" width="4" height="12" fill={WHITE} />)}
        <rect x="14" y="43" width="36" height="5" fill={NAVY} />
      </>
    ),
  },
  'Housing & Community': {
    bg: '#ffe0cc',
    draw: (
      <>
        <path d="M10 34l10-9 10 9v14H10z" fill={WHITE} />
        <path d="M8 35l12-11 12 11" stroke="#ff832b" strokeWidth="3" fill="none" strokeLinejoin="round" />
        <path d="M32 30l12-11 12 11v18H32z" fill={WHITE} />
        <path d="M30 31l14-13 14 13" stroke={NAVY} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <rect x="17" y="40" width="6" height="8" fill={NAVY} />
        <rect x="41" y="38" width="6" height="10" fill="#ff832b" />
      </>
    ),
  },
  'Real Estate & Construction': {
    bg: '#fcf4d6',
    draw: (
      <>
        <path d="M18 48V14M14 14h34" stroke={NAVY} strokeWidth="2.6" />
        <path d="M18 18l6-4" stroke={NAVY} strokeWidth="2" />
        <path d="M44 14v10" stroke={INK} strokeWidth="1.2" />
        <rect x="41" y="24" width="6" height="4" fill="#f1c21b" />
        <rect x="26" y="30" width="20" height="18" fill={WHITE} />
        {[29, 36].map((x) => <rect key={x} x={x} y="34" width="4" height="4" fill={SKY} />)}
        <rect x="26" y="30" width="20" height="3" fill="#f1c21b" />
      </>
    ),
  },
  Education: {
    bg: '#d9fbfb',
    draw: (
      <>
        <path d="M14 42c6-3 12-3 18 0 6-3 12-3 18 0V26c-6-3-12-3-18 0-6-3-12-3-18 0z" fill={WHITE} />
        <path d="M32 26v16" stroke={SKY} strokeWidth="1.6" />
        <path d="M32 11l18 7-18 7-18-7z" fill={NAVY} />
        <path d="M46 20v8" stroke="#f1c21b" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  'Media & Entertainment': {
    bg: '#fff1f1',
    draw: (
      <>
        <rect x="14" y="26" width="36" height="22" fill={INK} />
        <path d="M14 18l34-6 1 6-34 6z" fill={WHITE} />
        <path d="M20 17l4 5M29 15l4 5M38 14l4 5" stroke={INK} strokeWidth="2.4" />
        <path d="M28 31l10 6-10 6z" fill="#da1e28" />
      </>
    ),
  },
  'Hospitality & Travel': {
    bg: '#e8daff',
    draw: (
      <>
        <rect x="16" y="24" width="32" height="24" rx="3" fill="#8a3ffc" />
        <path d="M26 24v-5h12v5" stroke={NAVY} strokeWidth="2.6" fill="none" />
        <path d="M24 24v24M40 24v24" stroke={WHITE} strokeWidth="2" opacity="0.7" />
        <circle cx="45" cy="18" r="5" fill="#f1c21b" />
      </>
    ),
  },
  Telecommunications: {
    bg: '#d0e2ff',
    draw: (
      <>
        <path d="M32 26l-7 22h14z" fill={NAVY} />
        <circle cx="32" cy="23" r="3.4" fill={BLUE} />
        <path d="M24 16a11 11 0 0 0 0 14M40 16a11 11 0 0 1 0 14" stroke={BLUE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M19 11a18 18 0 0 0 0 24M45 11a18 18 0 0 1 0 24" stroke={SKY} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  Technology: {
    bg: '#e5f6ff',
    draw: (
      <>
        <rect x="22" y="22" width="20" height="20" rx="2" fill={NAVY} />
        <rect x="27" y="27" width="10" height="10" fill={BLUE} />
        {[25, 30, 35, 39].map((p) => (
          <g key={p} stroke={NAVY} strokeWidth="2">
            <path d={`M${p} 22v-5M${p} 42v5M22 ${p}h-5M42 ${p}h5`} />
          </g>
        ))}
      </>
    ),
  },
  'Professional Services': {
    bg: '#f2f4f8',
    draw: (
      <>
        <rect x="14" y="24" width="36" height="22" rx="2" fill={NAVY} />
        <path d="M26 24v-4h12v4" stroke={NAVY} strokeWidth="2.6" fill="none" />
        <rect x="14" y="31" width="36" height="3" fill="#264d8f" />
        <rect x="29" y="30" width="6" height="5" fill="#f1c21b" />
      </>
    ),
  },
  'Nonprofit & Social Impact': {
    bg: '#defbe6',
    draw: (
      <>
        <path d="M32 33c-8-5-10-9-8-12s6-3 8 0c2-3 6-3 8 0s0 7-8 12z" fill="#ee5396" />
        <path d="M12 42c6-1 10-4 15-4h9c2 0 2 3 0 3h-7m-17 5c8 0 14 2 20 2 5 0 13-6 17-9 2-2 0-4-2-3l-9 5" stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
}

const ALIASES: Record<string, string> = {
  Retail: 'Retail & Logistics',
  Logistics: 'Transport & Logistics',
}

const FALLBACK: Art = {
  bg: '#e5e5e5',
  draw: (
    <>
      <rect x="20" y="16" width="24" height="32" fill={NAVY} />
      {[21, 29, 37].map((y) => [24, 32].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="6" height="5" fill={SKY} />))}
    </>
  ),
}

export default function IndustryArt({ industry, size = 48, className }: { industry: string | null | undefined; size?: number; className?: string }) {
  const key = industry ? ALIASES[industry] ?? industry : ''
  const art = ART[key] ?? FALLBACK
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={industry ?? 'Industry'} className={className} style={{ flex: 'none', display: 'block' }}>
      <circle cx="32" cy="32" r="32" fill={art.bg} />
      {art.draw}
    </svg>
  )
}
