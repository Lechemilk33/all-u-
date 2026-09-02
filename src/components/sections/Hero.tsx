import { useIdentity } from '@/lib/identity'
import { videos, concreteLine, byCategory, money } from '@/data/catalog'
import { DoubleFace, Wordmark } from '@/components/BlandMark'

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
 * No headlines anywhere. Bland's own decks, tees and grip tape carry a wordmark
 * and a face and nothing else, so the heroes below carry a wordmark, a piece of
 * footage and — at most — a factual line. Everything that could be mistaken for
 * a slogan has been removed on purpose.
 */
export function Hero() {
  const { identity } = useIdentity()

  /* --- INDEX: no hero. A rule, the wordmark, straight into product. ------- */
  if (identity.hero === 'index') {
    const first = [...concreteLine.slice(0, 3), ...byCategory('Decks').slice(0, 3)]
    return (
      <section className="border-b">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <div className="flex items-baseline justify-between gap-6 border-b py-5">
            <span className="brand-kicker opacity-45">Fingerboards · Concrete · Apparel</span>
            <span className="brand-kicker opacity-45">Lincoln, CA</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {first.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group border-b border-r p-4 last:border-r-0"
              >
                <div className="aspect-square" style={{ background: 'var(--brand-img-bg)' }}>
                  <img
                    src={p.image}
                    alt={p.title}
                    className="size-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.72rem] opacity-70">{p.title}</span>
                  <span className="brand-price shrink-0 text-[0.72rem]">{money(p.price)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    )
  }

  /* --- GALLERY: one clip, enormous margins, a caption. -------------------- */
  if (identity.hero === 'gallery') {
    return (
      <section>
        <div className="mx-auto max-w-[1400px] px-6 pb-24 pt-24 lg:px-20 lg:pb-32 lg:pt-32">
          <Video className="aspect-[3/2] w-full object-cover" i={2} />
          <div className="mt-6 flex items-baseline justify-between">
            <span className="brand-kicker opacity-40">Bland Fingerboards</span>
            <span className="brand-kicker opacity-40">Lincoln, California</span>
          </div>
        </div>
      </section>
    )
  }

  /* --- INVERSE: the garment. Faces large, white on black. ----------------- */
  if (identity.hero === 'inverse') {
    return (
      <section className="border-b">
        <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-6 py-24 lg:grid-cols-2 lg:px-14 lg:py-28">
          <div className="flex justify-center lg:justify-start">
            <DoubleFace size={300} />
          </div>
          <Video className="aspect-[4/3] w-full object-cover" i={0} />
        </div>
      </section>
    )
  }

  /* --- BLEED: footage edge to edge, the wordmark, nothing more. ----------- */
  if (identity.hero === 'bleed') {
    return (
      <section className="relative">
        <div className="relative h-[86vh] min-h-[560px]">
          <Video className="absolute inset-0 size-full object-cover" i={3} />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,rgb(0 0 0/.25),rgb(0 0 0/.15) 55%,#000)' }}
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 lg:p-12">
            <Wordmark className="text-white" scale={2.4} />
            <span className="brand-kicker hidden text-white/55 sm:block">Lincoln, California</span>
          </div>
        </div>
      </section>
    )
  }

  /* --- GRID: visible structure. Ruled cells, one holds footage. ----------- */
  const cells = concreteLine.slice(0, 2)
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
              <span className="brand-kicker opacity-40">Concrete</span>
              <div className="my-6 aspect-square" style={{ background: 'var(--brand-img-bg)' }}>
                <img
                  src={p.image}
                  alt={p.title}
                  className="size-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[0.78rem] opacity-75">
                  {p.title.split(' - ').pop()}
                </span>
                <span className="brand-price text-[0.78rem]">{money(p.price)}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
