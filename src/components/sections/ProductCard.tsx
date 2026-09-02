import { money, type Product } from '@/data/catalog'

/**
 * `ruled` swaps the card from a floating tile to a cell in a ruled grid — the
 * difference between the Gallery and Index/Grid directions. Everything else
 * (padding, image ground, type size) comes from identity tokens.
 */
export function ProductCard({
  p,
  ruled = false,
  priority = false,
}: {
  p: Product
  ruled?: boolean
  priority?: boolean
}) {
  const onSale = p.compareAt != null && p.compareAt > p.price
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      className={`group block ${ruled ? 'border-b border-r p-4' : ''}`}
    >
      <div className="relative overflow-hidden" style={{ background: 'var(--brand-img-bg)' }}>
        <div className="aspect-square">
          <img
            src={p.image}
            alt={p.title}
            loading={priority ? 'eager' : 'lazy'}
            className="size-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ padding: 'var(--brand-img-pad)' }}
          />
        </div>
        {!p.available && (
          <span className="brand-kicker absolute left-2.5 top-2.5 bg-black px-2 py-1 text-white">
            Sold out
          </span>
        )}
      </div>
      <div className={`flex items-baseline justify-between gap-3 ${ruled ? 'mt-3' : 'mt-3.5'}`}>
        <span
          className="truncate opacity-80"
          style={{ fontSize: 'var(--brand-label-size)' }}
          title={p.title}
        >
          {p.title}
        </span>
        <span
          className="brand-price shrink-0 opacity-80"
          style={{ fontSize: 'var(--brand-label-size)' }}
        >
          {money(p.price)}
          {onSale && <span className="ml-1.5 line-through opacity-35">{money(p.compareAt!)}</span>}
        </span>
      </div>
    </a>
  )
}
