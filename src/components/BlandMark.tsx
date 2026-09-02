/**
 * Bland's marks, taken from what is actually printed on his product.
 *
 * `BlandMark`  — the single round face on the grip tape and deck bottoms.
 * `DoubleFace` — the two-face lockup on the "Dissociate" tee and hoodie: one
 *                face upright, a second rotated a quarter turn beneath it.
 * `Wordmark`   — BLAND set wide and bold, as it appears across the chest.
 *
 * All three are single-colour line art and inherit `currentColor`, because the
 * brand is black on white or white on black and never anything else.
 */

export function BlandMark({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Bland">
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="9" />
      <circle cx="35" cy="41" r="7.5" fill="currentColor" />
      <circle cx="65" cy="41" r="7.5" fill="currentColor" />
      <path d="M31 67 H69" stroke="currentColor" strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** One face upright, one rotated — the Dissociate lockup. */
export function DoubleFace({ className = '', size = 200 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Bland"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="9" strokeLinecap="round">
        <circle cx="72" cy="70" r="58" />
        <path d="M50 58 v14" />
        <path d="M94 58 v14" />
        <path d="M48 95 q24 16 48 0" />
      </g>
      {/* the second face, quarter-turned, overlapping low and right */}
      <g stroke="currentColor" strokeWidth="9" strokeLinecap="round" transform="rotate(90 140 138)">
        <circle cx="140" cy="138" r="42" fill="currentColor" fillOpacity="0" />
        <path d="M124 128 v10" />
        <path d="M156 128 v10" />
        <path d="M123 156 q17 11 34 0" />
      </g>
    </svg>
  )
}

export function Wordmark({ className = '', scale = 1 }: { className?: string; scale?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} style={{ fontSize: `${scale}rem` }}>
      <BlandMark size={26 * scale} />
      <span className="brand-wordmark leading-none" style={{ fontSize: `${1.3 * scale}rem` }}>
        BLAND
      </span>
    </span>
  )
}
