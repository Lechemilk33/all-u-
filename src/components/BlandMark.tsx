/**
 * Bland's existing mark — the flat-faced smiley that already appears on his
 * decks, tees and shop header. Kept identical across all five identities on
 * purpose: the point of the exercise is that one mark can carry every
 * direction, so the mark itself is never what changes.
 */
export function BlandMark({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Bland"
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="8" />
      <circle cx="34" cy="41" r="7" fill="currentColor" />
      <circle cx="66" cy="41" r="7" fill="currentColor" />
      <path
        d="M30 66 H70"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BlandMark size={26} />
      <span className="brand-display text-[1.35rem] leading-none">BLAND</span>
    </span>
  )
}
