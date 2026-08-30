import { useState } from 'react'
import FeaturedHarvests from '../components/FeaturedHarvests'
import Hero from '../components/Hero'

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
      <FeaturedHarvests
        crop={crop}
        location={location}
        category={category}
        onCategoryChange={setCategory}
      />
    </>
  )
}
