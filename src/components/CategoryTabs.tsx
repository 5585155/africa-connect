export default function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[]
  active: string
  onChange: (category: string) => void
}) {
  const options = ['All', ...categories]

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={active === option}
          onClick={() => onChange(option)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            active === option
              ? 'border-earth-800 bg-earth-800 text-white'
              : 'border-sand-200 bg-white text-earth-800 hover:border-earth-600'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
