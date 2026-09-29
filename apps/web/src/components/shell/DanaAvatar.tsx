/**
 * Dana, the learner's mentor, drawn in-house: a friendly woman in a navy suit.
 * An illustration rather than a stock photo, so there is no likeness or
 * licence question, and it stays sharp from 22px to 64px.
 */
export default function DanaAvatar({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Dana, your mentor"
      className={className}
      style={{ borderRadius: '50%', flex: 'none', display: 'block' }}
    >
      <circle cx="32" cy="32" r="32" fill="#d0e2ff" />
      {/* hair, back */}
      <path d="M14 34c0-13 8-22 18-22s18 9 18 22v12H14z" fill="#3b2a24" />
      {/* suit and shirt */}
      <path d="M8 64c2-11 11-17 24-17s22 6 24 17z" fill="#1c3a6e" />
      <path d="M26 47l6 9 6-9z" fill="#ffffff" />
      <path d="M26 47l-5 3 7 9 4-3zM38 47l5 3-7 9-4-3z" fill="#264d8f" />
      {/* neck */}
      <path d="M27 41h10v7c-3 2-7 2-10 0z" fill="#e0a782" />
      {/* face */}
      <ellipse cx="32" cy="31" rx="11" ry="13" fill="#f1bf98" />
      {/* hair, front: a side-swept fringe */}
      <path d="M21 29c1-9 6-14 13-14 6 0 10 4 11 10-6-1-12-4-15-8-2 5-5 9-9 12z" fill="#3b2a24" />
      {/* eyes, smiling */}
      <path d="M26 31.5q2-2 4 0M34 31.5q2-2 4 0" stroke="#2a1d18" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="25.5" cy="36" r="2" fill="#f19c86" opacity="0.45" />
      <circle cx="38.5" cy="36" r="2" fill="#f19c86" opacity="0.45" />
      {/* smile */}
      <path d="M27.5 37.5q4.5 4.5 9 0" stroke="#a3413a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}
