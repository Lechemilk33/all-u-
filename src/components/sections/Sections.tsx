import { useState } from 'react'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { byCategory, categories, concreteLine, money, products, shop } from '@/data/catalog'
import { ProductCard } from './ProductCard'
import { BlandMark, Wordmark } from '@/components/BlandMark'

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="brand-display text-[clamp(1.8rem,4vw,3rem)]">{title}</h2>
        {sub && <p className="mt-3 max-w-lg text-[0.98rem] opacity-60">{sub}</p>}
      </div>
    </div>
  )
}

/** The concrete line gets its own treatment — it is the actual moat. */
export function ConcreteFeature() {
  const { identity } = useIdentity()
  const c = identity.copy
  const [hero, ...rest] = concreteLine
  if (!hero) return null
  return (
    <section className="mx-auto max-w-[1400px] px-5 sm:px-8" style={{ paddingBlock: 'var(--brand-section-gap)' }}>
      <SectionHead title={c.concreteTitle} sub={c.concreteSub} />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <a href={hero.url} target="_blank" rel="noreferrer" className="group brand-card relative overflow-hidden">
          <div className="aspect-[4/3] lg:aspect-auto lg:h-full" style={{ background: 'var(--brand-img-bg)' }}>
            <img
              src={hero.image}
              alt={hero.title}
              className="size-full object-contain p-10 transition-transform duration-700 group-hover:scale-[1.04]"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-7"
               style={{ background: 'linear-gradient(0deg, color-mix(in oklab, var(--background) 92%, transparent), transparent)' }}>
            <div>
              <div className="brand-kicker mb-2 opacity-55">Flagship</div>
              <h3 className="brand-display text-2xl">{hero.title}</h3>
            </div>
            <div className="brand-price text-xl">{money(hero.price)}</div>
          </div>
        </a>
        <div className="grid grid-cols-2 gap-6">
          {rest.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function Catalog() {
  const { identity } = useIdentity()
  const [active, setActive] = useState<string>('All')
  const list = active === 'All' ? products : byCategory(active)
  return (
    <section id="catalog" className="mx-auto max-w-[1400px] px-5 sm:px-8" style={{ paddingBlock: 'var(--brand-section-gap)' }}>
      <SectionHead title={identity.copy.gridTitle} />
      <div className="mb-9 flex flex-wrap gap-2.5 border-b pb-6">
        {['All', ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className="brand-btn brand-nav border px-4 py-2 text-[0.72rem] transition-colors"
            style={
              active === c
                ? { background: 'var(--foreground)', color: 'var(--background)', borderColor: 'var(--foreground)' }
                : { borderColor: 'var(--border)', opacity: 0.72 }
            }
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-11 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p, i) => (
          <ProductCard key={p.id} p={p} priority={i < 4} />
        ))}
      </div>
      <p className="brand-kicker mt-10 opacity-45">
        {list.length} products · live data from blandpro.shop
      </p>
    </section>
  )
}

export function Statement() {
  const { identity } = useIdentity()
  const c = identity.copy
  return (
    <section
      id="story"
      className="brand-texture relative border-y"
      style={{ background: 'var(--muted)' }}
    >
      <div
        className="mx-auto grid max-w-[1400px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[auto_1fr] lg:gap-20"
        style={{ paddingBlock: 'var(--brand-section-gap)' }}
      >
        <BlandMark size={112} className="opacity-90" />
        <div>
          <h2 className="brand-display text-[clamp(1.9rem,4.5vw,3.4rem)]">{c.statementTitle}</h2>
          <p className="mt-6 max-w-2xl text-[1.08rem] leading-relaxed opacity-70">{c.statementBody}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-9 gap-y-3">
            <span className="brand-kicker flex items-center gap-2 opacity-60">
              <MapPin className="size-3.5" /> {shop.address}
            </span>
            <span className="brand-kicker opacity-60">{shop.hours}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Builds() {
  const { identity } = useIdentity()
  const c = identity.copy
  const builds = byCategory('Custom Builds').slice(0, 8)
  return (
    <section className="mx-auto max-w-[1400px] px-5 sm:px-8" style={{ paddingBlock: 'var(--brand-section-gap)' }}>
      <SectionHead title={c.buildsTitle} sub={c.buildsSub} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-11 md:grid-cols-4">
        {builds.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t" style={{ background: 'var(--muted)' }}>
      <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-5 max-w-xs text-[0.9rem] leading-relaxed opacity-60">
            The house brand of Bland Pro Shop — a real storefront in Lincoln, California.
          </p>
          <a
            href={shop.retail}
            target="_blank"
            rel="noreferrer"
            className="brand-kicker mt-6 inline-flex items-center gap-1.5 opacity-70 hover:opacity-100"
          >
            Visit the retail shop <ArrowUpRight className="size-3.5" />
          </a>
        </div>
        {[
          { h: 'Shop', items: categories.slice(0, 5) },
          { h: 'Support', items: ['Shipping', 'Warranty', 'Contact', 'FAQ'] },
          { h: 'Visit', items: [shop.hours, shop.phone, shop.email] },
        ].map((col) => (
          <div key={col.h}>
            <div className="brand-kicker mb-4 opacity-45">{col.h}</div>
            <ul className="space-y-2.5">
              {col.items.map((i) => (
                <li key={i} className="text-[0.88rem] opacity-70">{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
          <span className="brand-kicker opacity-45">© 2026 Bland Pro Shop · Lincoln, CA</span>
          <span className="brand-kicker opacity-45">Concept — not a live store</span>
        </div>
      </div>
    </footer>
  )
}
