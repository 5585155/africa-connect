import { useState } from 'react'
import FeaturedHarvests from '../components/FeaturedHarvests'
import Hero from '../components/Hero'
import SourceOrSell from '../components/SourceOrSell'
import TrustRow from '../components/TrustRow'

export default function Home() {
  const [crop, setCrop] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('All')

  function scrollToResults() {
    document.getElementById('featured-harvests')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Hero
        crop={crop}
        location={location}
        onCropChange={setCrop}
        onLocationChange={setLocation}
        onSubmit={scrollToResults}
      />
      <SourceOrSell />
      <TrustRow />
      <FeaturedHarvests
        crop={crop}
        location={location}
        category={category}
        onCategoryChange={setCategory}
      />
    </>
  )
}
