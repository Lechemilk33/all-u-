import { Menu, Search, ShoppingBag, User } from 'lucide-react'
import { Wordmark } from '@/components/BlandMark'
import { useIdentity } from '@/lib/identity'
import { categories } from '@/data/catalog'

export function Announcement() {
  const { identity } = useIdentity()
  return (
    <div
      className="w-full py-2.5 text-center"
      style={{ background: 'var(--brand-accent)', color: 'var(--brand-accent-fg)' }}
    >
      <span className="brand-kicker">{identity.copy.announcement}</span>
    </div>
  )
}

export function Header() {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{ background: 'color-mix(in oklab, var(--background) 88%, transparent)' }}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <button className="lg:hidden" aria-label="Menu">
          <Menu className="size-5" />
        </button>
        <Wordmark />
        <nav className="ml-4 hidden items-center gap-6 lg:flex">
          {categories.slice(0, 6).map((c) => (
            <a key={c} href="#catalog" className="brand-nav text-[0.8rem] opacity-75 hover:opacity-100">
              {c}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <Search className="size-[1.15rem] opacity-70" />
          <User className="hidden size-[1.15rem] opacity-70 sm:block" />
          <span className="relative">
            <ShoppingBag className="size-[1.15rem] opacity-70" />
            <span
              className="brand-badge absolute -right-2 -top-1.5 flex size-4 items-center justify-center text-[0.55rem] font-bold"
              style={{ background: 'var(--brand-accent)', color: 'var(--brand-accent-fg)' }}
            >
              3
            </span>
          </span>
        </div>
      </div>
    </header>
  )
}
