import { IdentityProvider } from '@/lib/identity'
import { IdentitySwitcher } from '@/components/IdentitySwitcher'
import { Announcement, Header } from '@/components/sections/Header'
import { Hero } from '@/components/sections/Hero'
import { Builds, Catalog, ConcreteFeature, Footer, Statement } from '@/components/sections/Sections'

export default function App() {
  return (
    <IdentityProvider>
      <div className="min-h-screen pb-24">
        <Announcement />
        <Header />
        <main>
          <Hero />
          <ConcreteFeature />
          <Statement />
          <Catalog />
          <Builds />
        </main>
        <Footer />
      </div>
      <IdentitySwitcher />
    </IdentityProvider>
  )
}
