import { useMemo, useState } from 'react'
import { FARMER_SPOTLIGHTS, FORUM_POSTS, FORUM_TAGS } from '../data/community'

export default function Community() {
  const [activeTag, setActiveTag] = useState<string>('All')

  const filteredPosts = useMemo(
    () => (activeTag === 'All' ? FORUM_POSTS : FORUM_POSTS.filter((p) => p.tag === activeTag)),
    [activeTag],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-earth-950 sm:text-4xl">Community</h1>
        <p className="mt-3 text-earth-700">
          Hear from top African exporters and join the conversation with farmers across the continent.
        </p>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-earth-950">Farmer Spotlight</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FARMER_SPOTLIGHTS.map((farmer) => (
            <div key={farmer.id} className="rounded-2xl border border-sand-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-2xl">
                  {farmer.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-earth-950">{farmer.name}</p>
                    {farmer.verified && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-earth-700" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-earth-700">
                    {farmer.crop} · {farmer.country}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm italic text-earth-800">“{farmer.quote}”</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-earth-950">Discussion Forum</h2>
          <div className="flex flex-wrap gap-2">
            {['All', ...FORUM_TAGS].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeTag === tag
                    ? 'border-earth-800 bg-earth-800 text-white'
                    : 'border-sand-200 bg-white text-earth-800 hover:border-earth-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl border border-sand-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-earth-950">{post.title}</h3>
                <span className="shrink-0 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-earth-700">
                  {post.tag}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-earth-700">{post.excerpt}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-earth-700/70">
                <span>By {post.author}</span>
                <span>{post.replies} replies</span>
              </div>
            </div>
          ))}

          {filteredPosts.length === 0 && (
            <div className="rounded-xl border border-dashed border-sand-200 bg-white py-10 text-center text-earth-700">
              No discussions tagged “{activeTag}” yet.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
