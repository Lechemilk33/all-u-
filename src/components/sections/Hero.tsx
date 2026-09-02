import { useIdentity } from '@/lib/identity'
import { videos, flagship, byCategory, money } from '@/data/catalog'
import { BlandMark, Wordmark } from '@/components/BlandMark'

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

/**
 * No headlines. Every hero leads with fingerboards — completes and decks — and
 * every clip is fingerboard footage, because that is what the brand is. Ramps
 * and apparel come after, in that order, on every direction.
 */
export function Hero() {
  const { identity } = useIdentity()

  /* --- GALLERY: one clip, enormous margins, three completes beneath. ------ */
  if (identity.hero === 'gallery') {
    return (
      <section>
        <div className="mx-auto max-w-[1400px] px-6 pb-20 pt-24 lg:px-20 lg:pt-32">
          <Video className="aspect-[3/2] w-full object-cover" i={1} />
          <div className="mt-6 flex items-baseline justify-between">
            <span className="brand-kicker opacity-40">Bland Fingerboards</span>
            <span className="brand-kicker opacity-40">Lincoln, California</span>
          </div>
        </div>
      </section>
    )
  }

  /* --- INVERSE: the mark large, a complete beside it. --------------------- */
  if (identity.hero === 'inverse') {
    const lead = byCategory('Completes')[0]
    return (
      <section className="border-b">
        <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:px-14 lg:py-24">
          <div className="flex flex-col items-center gap-10 lg:items-start">
            <BlandMark size={210} />
            <Video className="aspect-[4/3] w-full object-cover" i={0} />
          </div>
          {lead && (
            <a href={lead.url} target="_blank" rel="noreferrer" className="group block">
              <div className="aspect-square" style={{ background: 'var(--brand-img-bg)' }}>
                <img
                  src={lead.image}
                  alt={lead.title}
                  className="size-full object-contain p-12 transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="brand-kicker opacity-45">Complete · {lead.short}</span>
                <span className="brand-price">{money(lead.price)}</span>
              </div>
            </a>
          )}
        </div>
      </section>
    )
  }

  /* --- BLEED: fingerboard footage edge to edge, the wordmark, nothing more. */
  if (identity.hero === 'bleed') {
    return (
      <section className="relative">
        <div className="relative h-[86vh] min-h-[560px]">
          <Video className="absolute inset-0 size-full object-cover" i={3} />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,rgb(0 0 0/.3),rgb(0 0 0/.12) 50%,#000)' }}
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 lg:p-12">
            <Wordmark className="text-white" scale={2.2} />
            <span className="brand-kicker hidden text-white/55 sm:block">Fingerboards · Lincoln, CA</span>
          </div>
        </div>
      </section>
    )
  }

  /* --- GRID: ruled cells — footage, then the completes. ------------------- */
  const cells = byCategory('Completes').slice(0, 2)
  return (
    <section className="border-b">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid border-x lg:grid-cols-4">
          <div className="border-b lg:col-span-2 lg:border-b-0 lg:border-r">
            <Video className="aspect-[3/2] size-full object-cover" i={2} />
          </div>
          {cells.map((p, i) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className={`group flex flex-col justify-between p-6 ${
                i < cells.length - 1 ? 'border-b lg:border-b-0 lg:border-r' : ''
              }`}
            >
              <span className="brand-kicker opacity-40">Complete</span>
              <div className="my-6 aspect-square" style={{ background: 'var(--brand-img-bg)' }}>
                <img
                  src={p.image}
                  alt={p.title}
                  className="size-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[0.78rem] opacity-75">{p.short}</span>
                <span className="brand-price text-[0.78rem]">{money(p.price)}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export { flagship }
