import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { byCategory, byFamily, families, products, shop, type Family } from '@/data/catalog'
import { ProductCard } from './ProductCard'
import { Lockup, Wordmark } from '@/components/BlandMark'

function Head({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mb-8 flex items-baseline justify-between gap-4 border-b pb-4">
      <h2 className="brand-display">{title}</h2>
      {right && <span className="brand-kicker opacity-40">{right}</span>}
    </div>
  )
}

const gridStyle = { columnGap: 'var(--brand-grid-gap-x)', rowGap: 'var(--brand-grid-gap-y)' }

function useRuled() {
  const { identity } = useIdentity()
  return identity.hero === 'grid'
}

function useCols() {
  const { identity } = useIdentity()
  return identity.hero === 'gallery'
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
}

/**
 * One family per block, subdivided by category with a rule between each, so the
 * range reads as an organised line instead of one long undifferentiated grid.
 * Fingerboards always come first.
 */
function FamilyBlock({ family, title }: { family: Family; title: string }) {
  const ruled = useRuled()
  const cols = useCols()
  const subs = families.find((f) => f.name === family)!.subs
  const count = byFamily(family).length
  return (
    <section
      id={family.toLowerCase()}
      className="mx-auto max-w-[1400px] px-5 sm:px-8"
      style={{ paddingBlock: 'var(--brand-section-gap)' }}
    >
      <Head title={title} right={`${count} products`} />
      <div className="space-y-12">
        {subs.map((sub) => {
          const items = byCategory(sub).filter((p) => p.family === family)
          if (!items.length) return null
          return (
            <div key={sub}>
              <div className="mb-4 flex items-baseline gap-3">
                <span className="brand-kicker opacity-45">{sub}</span>
                <span className="h-px flex-1" style={{ background: 'var(--border)', opacity: 0.5 }} />
                <span className="brand-kicker opacity-30">{items.length}</span>
              </div>
              <div className={`grid ${cols} ${ruled ? 'border-l border-t' : ''}`} style={gridStyle}>
                {items.map((p, i) => (
                  <ProductCard key={p.id} p={p} ruled={ruled} priority={i < 4} useShort />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function Fingerboards() {
  const { identity } = useIdentity()
  return <FamilyBlock family="Fingerboards" title={identity.copy.fingerboards} />
}
export function Ramps() {
  const { identity } = useIdentity()
  return <FamilyBlock family="Ramps" title={identity.copy.ramps} />
}
export function Apparel() {
  const { identity } = useIdentity()
  return <FamilyBlock family="Apparel" title={identity.copy.apparel} />
}

/** Everything, filterable — for the visitor who wants one screen of the line. */
export function Everything() {
  const [active, setActive] = useState<string>('All')
  const ruled = useRuled()
  const cols = useCols()
  const list =
    active === 'All' ? products : products.filter((p) => p.family === active || p.category === active)
  return (
    <section
      id="all"
      className="mx-auto max-w-[1400px] px-5 sm:px-8"
      style={{ paddingBlock: 'var(--brand-section-gap)' }}
    >
      <Head title="Everything" right={`${list.length}`} />
      <div className="mb-8 flex flex-wrap gap-x-5 gap-y-2">
        {['All', ...families.map((f) => f.name)].map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className="brand-nav pb-1"
            style={active === c ? { opacity: 1, borderBottom: '1px solid currentColor' } : { opacity: 0.4 }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className={`grid ${cols} ${ruled ? 'border-l border-t' : ''}`} style={gridStyle}>
        {list.map((p) => (
          <ProductCard key={p.id} p={p} ruled={ruled} />
        ))}
      </div>
    </section>
  )
}

/** Facts, not a manifesto. */
export function Details() {
  return (
    <section className="border-y" style={{ background: 'var(--muted)' }}>
      <div
        className="mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-20"
        style={{ paddingBlock: 'clamp(3.5rem, 6vw, 5.5rem)' }}
      >
        <Lockup height={44} />
        <dl className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
          {[
            ['Address', shop.address],
            ['Hours', shop.hours],
            ['Phone', shop.phone],
            ['Email', shop.email],
            ['Made in', 'Lincoln, California'],
            ['Deck size', '34mm'],
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

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Wordmark />
        {families.map((f) => (
          <div key={f.name}>
            <div className="brand-kicker mb-4 opacity-40">{f.name}</div>
            <ul className="space-y-2.5">
              {f.subs.map((s) => (
                <li key={s} style={{ fontSize: 'var(--brand-label-size)' }} className="opacity-70">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <span className="brand-kicker opacity-40">{shop.hours} · Lincoln, CA</span>
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
