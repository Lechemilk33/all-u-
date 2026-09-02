import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { byCategory, categories, concreteLine, products, shop } from '@/data/catalog'
import { ProductCard } from './ProductCard'
import { DoubleFace, Wordmark } from '@/components/BlandMark'

/** A section title is a noun. No sub-headline, no explanation. */
function Head({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mb-8 flex items-baseline justify-between gap-4 border-b pb-4">
      <h2 className="brand-display">{title}</h2>
      {right && <span className="brand-kicker opacity-40">{right}</span>}
    </div>
  )
}

/** Grids inherit their gutters from the identity, so density is a token. */
const gridStyle = {
  columnGap: 'var(--brand-grid-gap-x)',
  rowGap: 'var(--brand-grid-gap-y)',
}

export function ConcreteFeature() {
  const { identity } = useIdentity()
  const ruled = identity.hero === 'index' || identity.hero === 'grid'
  return (
    <section
      className="mx-auto max-w-[1400px] px-5 sm:px-8"
      style={{ paddingBlock: 'var(--brand-section-gap)' }}
    >
      <Head title={identity.copy.concrete} right={`${concreteLine.length} shapes`} />
      <div
        className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${ruled ? 'border-l border-t' : ''}`}
        style={gridStyle}
      >
        {concreteLine.map((p) => (
          <ProductCard key={p.id} p={p} ruled={ruled} priority />
        ))}
      </div>
    </section>
  )
}

export function Catalog() {
  const { identity } = useIdentity()
  const [active, setActive] = useState<string>('All')
  const list = active === 'All' ? products : byCategory(active)
  const ruled = identity.hero === 'index' || identity.hero === 'grid'
  const cols =
    identity.hero === 'gallery'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : identity.hero === 'index'
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
        : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'

  return (
    <section
      id="catalog"
      className="mx-auto max-w-[1400px] px-5 sm:px-8"
      style={{ paddingBlock: 'var(--brand-section-gap)' }}
    >
      <Head title={identity.copy.catalog} right={`${list.length}`} />
      <div className="mb-8 flex flex-wrap gap-x-5 gap-y-2">
        {['All', ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className="brand-nav pb-1 transition-opacity"
            style={
              active === c
                ? { opacity: 1, borderBottom: '1px solid currentColor' }
                : { opacity: 0.4 }
            }
          >
            {c}
          </button>
        ))}
      </div>
      <div className={`grid ${cols} ${ruled ? 'border-l border-t' : ''}`} style={gridStyle}>
        {list.map((p, i) => (
          <ProductCard key={p.id} p={p} ruled={ruled} priority={i < 5} />
        ))}
      </div>
    </section>
  )
}

/** Facts, not a manifesto: where it is, when it is open, what it is. */
export function Details() {
  const { identity } = useIdentity()
  return (
    <section className="border-y" style={{ background: 'var(--muted)' }}>
      <div
        className="mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-20"
        style={{ paddingBlock: 'clamp(3.5rem, 6vw, 6rem)' }}
      >
        {identity.hero === 'inverse' || identity.hero === 'bleed' ? (
          <DoubleFace size={150} />
        ) : (
          <DoubleFace size={120} />
        )}
        <dl className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
          {[
            ['Address', shop.address],
            ['Hours', shop.hours],
            ['Phone', shop.phone],
            ['Email', shop.email],
            ['Made in', 'Lincoln, California'],
            ['Since', '2021'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="brand-kicker mb-1.5 opacity-40">{k}</dt>
              <dd style={{ fontSize: 'var(--brand-label-size)' }} className="opacity-80">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export function Builds() {
  const { identity } = useIdentity()
  const builds = byCategory('Custom Builds').slice(0, 8)
  const ruled = identity.hero === 'index' || identity.hero === 'grid'
  return (
    <section
      className="mx-auto max-w-[1400px] px-5 sm:px-8"
      style={{ paddingBlock: 'var(--brand-section-gap)' }}
    >
      <Head title={identity.copy.builds} right="One off" />
      <div
        className={`grid grid-cols-2 md:grid-cols-4 ${ruled ? 'border-l border-t' : ''}`}
        style={gridStyle}
      >
        {builds.map((p) => (
          <ProductCard key={p.id} p={p} ruled={ruled} />
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Wordmark />
        {[
          { h: 'Shop', items: categories.slice(0, 5) },
          { h: 'Support', items: ['Shipping', 'Warranty', 'Contact', 'FAQ'] },
          { h: 'Visit', items: [shop.hours, shop.phone, shop.email] },
        ].map((col) => (
          <div key={col.h}>
            <div className="brand-kicker mb-4 opacity-40">{col.h}</div>
            <ul className="space-y-2.5">
              {col.items.map((i) => (
                <li key={i} style={{ fontSize: 'var(--brand-label-size)' }} className="opacity-70">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <span className="brand-kicker opacity-40">Bland Pro Shop · Lincoln, CA</span>
          <a
            href={shop.retail}
            target="_blank"
            rel="noreferrer"
            className="brand-kicker inline-flex items-center gap-1.5 opacity-40 hover:opacity-100"
          >
            blandpro.shop <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </footer>
  )
}
