import { IdentityProvider } from '@/lib/identity'
import { IdentitySwitcher } from '@/components/IdentitySwitcher'
import { Announcement, Header } from '@/components/sections/Header'
import { Hero } from '@/components/sections/Hero'
import { Builds, Catalog, ConcreteFeature, Details, Footer } from '@/components/sections/Sections'

export default function App() {
  return (
    <IdentityProvider>
      <div className="min-h-screen pb-24">
        <Announcement />
        <Header />
        <main>
          <Hero />
          <ConcreteFeature />
          <Catalog />
          <Details />
          <Builds />
        </main>
        <Footer />
      </div>
      <IdentitySwitcher />
    </IdentityProvider>
  )
}
