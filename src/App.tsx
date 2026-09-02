import { IdentityProvider } from '@/lib/identity'
import { IdentitySwitcher } from '@/components/IdentitySwitcher'
import { Announcement, Header } from '@/components/sections/Header'
import { Hero } from '@/components/sections/Hero'
import {
  Apparel,
  Details,
  Everything,
  Fingerboards,
  Footer,
  Ramps,
} from '@/components/sections/Sections'

export default function App() {
  return (
    <IdentityProvider>
      <div className="min-h-screen pb-24">
        <Announcement />
        <Header />
        <main>
          <Hero />
          {/* Fingerboards first on every direction — it is what the brand is. */}
          <Fingerboards />
          <Ramps />
          <Details />
          <Apparel />
          <Everything />
        </main>
        <Footer />
      </div>
      <IdentitySwitcher />
    </IdentityProvider>
  )
}
