import { money, type Product } from '@/data/catalog'

export function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const onSale = p.compareAt != null && p.compareAt > p.price
  const off = onSale ? Math.round(((p.compareAt! - p.price) / p.compareAt!) * 100) : 0
  return (
    <a href={p.url} target="_blank" rel="noreferrer" className="group block">
      <div
        className="brand-card relative overflow-hidden"
        style={{ background: 'var(--brand-img-bg)' }}
      >
        <div className="aspect-square">
          <img
            src={p.image}
            alt={p.title}
            loading={priority ? 'eager' : 'lazy'}
            className="size-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.045]"
          />
        </div>
        {!p.available && (
          <span
            className="brand-badge brand-kicker absolute left-3 top-3 px-2.5 py-1"
            style={{ background: 'var(--foreground)', color: 'var(--background)' }}
          >
            Sold out
          </span>
        )}
        {onSale && p.available && (
          <span
            className="brand-badge brand-kicker absolute left-3 top-3 px-2.5 py-1"
            style={{ background: 'var(--brand-accent)', color: 'var(--brand-accent-fg)' }}
          >
            −{off}%
          </span>
        )}
      </div>
      <div className="mt-3.5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="brand-kicker mb-1 opacity-45">{p.category}</div>
          <h3 className="brand-nav truncate text-[0.9rem] normal-case tracking-normal">{p.title}</h3>
        </div>
        <div className="brand-price shrink-0 text-right text-[0.9rem]">
          <div>{money(p.price)}</div>
          {onSale && (
            <div className="text-[0.75rem] line-through opacity-40">{money(p.compareAt!)}</div>
          )}
        </div>
      </div>
    </a>
  )
}
