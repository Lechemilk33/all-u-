import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { identities, type Identity } from '@/data/identities'

type Ctx = {
  identity: Identity
  index: number
  setIndex: (i: number) => void
  next: () => void
  prev: () => void
}

const IdentityContext = createContext<Ctx | null>(null)

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState(0)
  const identity = identities[index]

  useEffect(() => {
    document.documentElement.dataset.identity = identity.id
  }, [identity.id])

  // Arrow keys and 1–5 flip directions without reaching for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % identities.length)
      else if (e.key === 'ArrowLeft')
        setIndex((i) => (i - 1 + identities.length) % identities.length)
      else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1
        if (n < identities.length) setIndex(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      identity,
      index,
      setIndex,
      next: () => setIndex((i) => (i + 1) % identities.length),
      prev: () => setIndex((i) => (i - 1 + identities.length) % identities.length),
    }),
    [identity, index],
  )

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

export function useIdentity() {
  const ctx = useContext(IdentityContext)
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider')
  return ctx
}
