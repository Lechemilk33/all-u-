import { useIdentity } from '@/lib/identity'

/**
 * His actual artwork, pulled from blandpro.shop: `bland_filled_logo_200px.png`
 * (the filled disc with BLAND set inside it) and `BLAND_HORI_LOGO_WHITE_2.png`
 * (the current horizontal lockup). Both ship white-on-transparent; the `-inv`
 * files are the same files with RGB flipped and alpha untouched, so nothing is
 * redrawn — a light and a dark cut of the same asset.
 */

/** True when the active direction sits on a dark ground. */
function useOnDark() {
  const { identity } = useIdentity()
  return identity.hero === 'inverse' || identity.hero === 'bleed'
}

export function BlandMark({ className = '', size = 28 }: { className?: string; size?: number }) {
  const onDark = useOnDark()
  return (
    <img
      src={onDark ? '/brand/mark-inv.png' : '/brand/mark.png'}
      width={size}
      height={size}
      alt="Bland"
      className={className}
      style={{ width: size, height: size }}
    />
  )
}

/** The horizontal BLAND PRO SHOP lockup, used where the parent shop is credited. */
export function Lockup({ className = '', height = 26 }: { className?: string; height?: number }) {
  const onDark = useOnDark()
  return (
    <img
      src={onDark ? '/brand/lockup-inv.png' : '/brand/lockup.png'}
      alt="Bland Pro Shop"
      className={className}
      style={{ height, width: 'auto' }}
    />
  )
}

/** Site wordmark: his mark, then BLAND. The brand here is Bland, not the shop. */
export function Wordmark({ className = '', scale = 1 }: { className?: string; scale?: number }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BlandMark size={26 * scale} />
      <span className="brand-wordmark leading-none" style={{ fontSize: `${1.25 * scale}rem` }}>
        BLAND
      </span>
    </span>
  )
}
