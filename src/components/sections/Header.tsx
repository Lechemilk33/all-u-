import { Menu, Search, ShoppingBag } from 'lucide-react'
import { Wordmark } from '@/components/BlandMark'
import { useIdentity } from '@/lib/identity'
import { categories } from '@/data/catalog'

export function Announcement() {
  const { identity } = useIdentity()
  if (!identity.copy.announcement) return null
  return (
    <div className="border-b py-2 text-center">
      <span className="brand-kicker opacity-50">{identity.copy.announcement}</span>
    </div>
  )
}

export function Header() {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{ background: 'color-mix(in oklab, var(--background) 90%, transparent)' }}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <button className="lg:hidden" aria-label="Menu">
          <Menu className="size-5" />
        </button>
        <Wordmark />
        <nav className="ml-6 hidden items-center gap-6 lg:flex">
          {categories.slice(0, 6).map((c) => (
            <a key={c} href="#catalog" className="brand-nav opacity-55 hover:opacity-100">
              {c}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <Search className="size-[1.05rem] opacity-60" />
          <ShoppingBag className="size-[1.05rem] opacity-60" />
        </div>
      </div>
    </header>
  )
}
