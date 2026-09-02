import { ArrowRight } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { videos, concreteLine, money } from '@/data/catalog'
import { BlandMark } from '@/components/BlandMark'

/**
 * Clip choice is per-hero on purpose: v0 is a gritty night rail, v1 a macro of a
 * bearing, v2 a wide skatepark, v3 a dark rail. A close-up dies in a tall crop
 * and a wide shot dies in a letterbox, so each layout gets footage that holds up.
 */
function Video({ i = 0, className = '' }: { i?: number; className?: string }) {
  const v = videos[i % videos.length]
  return (
    <video
      className={className}
      src={v.src}
      poster={v.poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
  )
}

function Cta({ label, alt, onDark = false }: { label: string; alt: string; onDark?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href="#catalog"
        className="brand-btn brand-nav inline-flex items-center gap-2 px-7 py-3.5 text-[0.8rem]"
        style={{ background: 'var(--brand-accent)', color: 'var(--brand-accent-fg)' }}
      >
        {label} <ArrowRight className="size-4" />
      </a>
      <a
        href="#story"
        className="brand-btn brand-nav inline-flex items-center gap-2 border px-7 py-3.5 text-[0.8rem]"
        style={
          onDark
            ? { borderColor: 'rgb(255 255 255 / 0.75)', color: '#fff' }
            : { borderColor: 'var(--foreground)' }
        }
      >
        {alt}
      </a>
    </div>
  )
}

export function Hero() {
  const { identity } = useIdentity()
  const c = identity.copy
  const headline = c.headline.split('\n')

  /* --- SPLIT: video beside a spec block. Reads like a materials supplier. -- */
  if (identity.hero === 'split') {
    const specs = concreteLine.slice(0, 3)
    return (
      <section className="brand-texture relative border-b">
        <div className="mx-auto grid max-w-[1400px] items-stretch gap-0 lg:grid-cols-2">
          <div className="relative order-2 min-h-[380px] lg:order-1 lg:min-h-[620px]">
            <Video i={2} className="absolute inset-0 size-full object-cover object-center" />
          </div>
          <div className="order-1 flex flex-col justify-center gap-7 px-6 py-16 lg:order-2 lg:px-14 lg:py-24">
            <span className="brand-kicker opacity-60">{c.kicker}</span>
            <h1 className="brand-display text-[clamp(2.6rem,6vw,4.6rem)]">
              {headline.map((l, i) => (
                <span key={i} className="block">{l}</span>
              ))}
            </h1>
            <p className="max-w-md text-[1.02rem] leading-relaxed opacity-70">{c.sub}</p>
            <Cta label={c.cta} alt={c.ctaAlt} />
            <div className="mt-4 grid grid-cols-3 gap-px border-t pt-6">
              {specs.map((p) => (
                <div key={p.id}>
                  <div className="brand-kicker mb-1 opacity-50">{p.title.split(' - ')[1] ?? 'Cast'}</div>
                  <div className="brand-price text-lg">{money(p.price)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* --- EDITORIAL: type carries it. Video is a small, quiet inset. --------- */
  if (identity.hero === 'editorial') {
    return (
      <section className="relative border-b">
        <div className="mx-auto max-w-[1400px] px-6 pb-20 pt-24 lg:px-14 lg:pb-28 lg:pt-36">
          <span className="brand-kicker opacity-45">{c.kicker}</span>
          <h1 className="brand-display mt-10 text-[clamp(3.4rem,11vw,9.5rem)]">
            {headline.map((l, i) => (
              <span key={i} className="block">{l}</span>
            ))}
          </h1>
          <div className="mt-16 grid gap-12 border-t pt-10 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div className="flex flex-col gap-8">
              <p className="max-w-sm text-[1.05rem] leading-relaxed opacity-65">{c.sub}</p>
              <Cta label={c.cta} alt={c.ctaAlt} />
            </div>
            <Video className="aspect-[16/10] w-full object-cover" i={1} />
          </div>
        </div>
      </section>
    )
  }

  /* --- COLLAGE: flyer energy. Overlapping slabs, rotated stickers. -------- */
  if (identity.hero === 'collage') {
    return (
      <section className="relative overflow-hidden border-b-2" style={{ borderColor: 'var(--foreground)' }}>
        <div className="relative min-h-[620px]">
          <Video className="absolute inset-0 size-full object-cover grayscale contrast-125" i={0} />
          <div className="absolute inset-0" style={{ background: 'var(--brand-hero-overlay)' }} />
          <div className="brand-texture absolute inset-0" />
          <div className="relative mx-auto flex min-h-[620px] max-w-[1400px] flex-col justify-center px-6 py-20 lg:px-14">
            <span
              className="brand-kicker mb-5 w-fit px-3 py-1.5"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
            >
              {c.kicker}
            </span>
            <h1
              className="brand-display text-[clamp(3.6rem,13vw,10rem)]"
              style={{ color: 'var(--secondary)' }}
            >
              {headline.map((l, i) => (
                <span key={i} className="block">{l}</span>
              ))}
            </h1>
            <p className="mt-6 max-w-lg text-[1.02rem] leading-relaxed text-white/85">{c.sub}</p>
            <div className="mt-9">
              <Cta label={c.cta} alt={c.ctaAlt} onDark />
            </div>
          </div>
          <div
            className="absolute right-5 top-16 hidden rotate-12 border-2 px-6 py-3 lg:block"
            style={{ background: 'var(--secondary)', borderColor: 'var(--foreground)' }}
          >
            <span className="brand-display text-xl">SMALL BATCH</span>
          </div>
          <div
            className="absolute bottom-12 right-10 hidden -rotate-6 items-center gap-2 border-2 px-5 py-2.5 lg:flex"
            style={{ background: 'var(--accent)', borderColor: 'var(--foreground)', color: '#fff' }}
          >
            <BlandMark size={20} />
            <span className="brand-display text-lg">LINCOLN CA</span>
          </div>
        </div>
      </section>
    )
  }

  /* --- CINEMATIC: dark room, one light, product-led. ---------------------- */
  if (identity.hero === 'cinematic') {
    return (
      <section className="brand-texture relative">
        <div className="relative min-h-[680px]">
          <Video className="absolute inset-0 size-full object-cover opacity-55" i={3} />
          <div className="absolute inset-0" style={{ background: 'var(--brand-hero-overlay)' }} />
          <div className="relative mx-auto flex min-h-[680px] max-w-[1400px] flex-col items-center justify-center px-6 py-24 text-center">
            <span className="brand-kicker" style={{ color: 'var(--brand-accent)' }}>
              {c.kicker}
            </span>
            <h1 className="brand-display mt-8 text-[clamp(3rem,8vw,6.5rem)]">
              {headline.map((l, i) => (
                <span key={i} className="block">{l}</span>
              ))}
            </h1>
            <p className="mt-7 max-w-xl text-[1.05rem] leading-relaxed opacity-65">{c.sub}</p>
            <div className="mt-10">
              <Cta label={c.cta} alt={c.ctaAlt} onDark />
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* --- STACKED: shop-counter warmth, badges, framed video. ---------------- */
  return (
    <section className="brand-texture relative border-b">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-14 lg:py-24">
        <div className="flex flex-col items-center text-center">
          <span
            className="brand-kicker brand-badge mb-6 px-4 py-2"
            style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
          >
            {c.kicker}
          </span>
          <h1 className="brand-display max-w-4xl text-[clamp(3rem,8vw,6rem)]">
            {headline.map((l, i) => (
              <span key={i} className="block">{l}</span>
            ))}
          </h1>
          <p className="mt-7 max-w-lg text-[1.05rem] leading-relaxed opacity-70">{c.sub}</p>
          <div className="mt-9">
            <Cta label={c.cta} alt={c.ctaAlt} />
          </div>
        </div>
        <div
          className="brand-card mt-16 overflow-hidden"
          style={{ borderRadius: 'var(--brand-card-radius)' }}
        >
          <Video className="aspect-[21/8] w-full object-cover" i={2} />
        </div>
      </div>
    </section>
  )
}
