import { useState } from 'react'
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import { identities } from '@/data/identities'
import { useIdentity } from '@/lib/identity'

/**
 * The switcher deliberately opts out of the active identity's tokens — it is a
 * review tool sitting on top of the work, not part of the design being judged.
 * Fixed neutral dark chrome, so it reads the same against all five.
 */
export function IdentitySwitcher() {
  const { identity, index, setIndex, next, prev } = useIdentity()
  const [openNotes, setOpenNotes] = useState(false)

  return (
    <>
      {openNotes && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpenNotes(false)}
            aria-label="Close"
          />
          <div
            className="relative w-full max-w-lg rounded-2xl bg-[#16181d] p-7 text-neutral-200 shadow-2xl"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            <button
              className="absolute right-5 top-5 text-neutral-500 hover:text-neutral-200"
              onClick={() => setOpenNotes(false)}
            >
              <X className="size-4" />
            </button>
            <div className="text-[0.65rem] uppercase tracking-[0.24em] text-neutral-500">
              Direction {index + 1} of {identities.length}
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-white">{identity.name}</h3>
            <p className="mt-1.5 text-[0.95rem] text-neutral-400">{identity.pitch}</p>
            <div className="mt-6 space-y-4 text-[0.9rem] leading-relaxed">
              <div>
                <div className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-emerald-400">
                  Why it could work
                </div>
                <p className="text-neutral-300">{identity.thesis}</p>
              </div>
              <div>
                <div className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-amber-400">
                  What it costs you
                </div>
                <p className="text-neutral-300">{identity.risk}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-1.5">
              {identity.swatch.map((s) => (
                <div key={s} className="h-9 flex-1 rounded-md" style={{ background: s }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-5">
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#0d0f12]/95 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          <button
            onClick={prev}
            className="grid size-9 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Previous direction"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="hidden items-center gap-0.5 sm:flex">
            {identities.map((id, i) => (
              <button
                key={id.id}
                onClick={() => setIndex(i)}
                className="rounded-full px-3.5 py-2 text-[0.78rem] font-medium transition-colors"
                style={
                  i === index
                    ? { background: '#fff', color: '#0d0f12' }
                    : { color: '#8a9099' }
                }
              >
                {id.name}
              </button>
            ))}
          </div>

          <div className="px-4 text-center sm:hidden">
            <div className="text-[0.8rem] font-semibold text-white">{identity.name}</div>
            <div className="text-[0.6rem] text-neutral-500">
              {index + 1}/{identities.length}
            </div>
          </div>

          <button
            onClick={next}
            className="grid size-9 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Next direction"
          >
            <ChevronRight className="size-4" />
          </button>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <button
            onClick={() => setOpenNotes(true)}
            className="mr-0.5 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.78rem] font-medium text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Info className="size-3.5" />
            <span className="hidden sm:inline">Notes</span>
          </button>
        </div>
      </div>
    </>
  )
}
