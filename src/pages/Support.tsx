import { useMemo, useState, type FormEvent } from 'react'
import LiveChatWidget from '../components/LiveChatWidget'
import { FAQS } from '../data/faqs'

export default function Support() {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FAQS
    return FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q),
    )
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof FAQS>()
    for (const faq of filteredFaqs) {
      const list = map.get(faq.category) ?? []
      list.push(faq)
      map.set(faq.category, list)
    }
    return map
  }, [filteredFaqs])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-earth-950 sm:text-4xl">Support</h1>
        <p className="mt-3 text-earth-700">
          Find answers on logistics, escrow, certification, and settlements — or reach our team directly.
        </p>
      </div>

      <section className="mt-10">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-earth-700/60"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQs — try “escrow” or “currency”"
            className="w-full rounded-xl border border-sand-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-earth-600"
          />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {[...grouped.entries()].map(([category, faqs]) => (
            <div key={category}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-earth-700">{category}</h2>
              <div className="flex flex-col gap-2">
                {faqs.map((faq) => {
                  const isOpen = openId === faq.id
                  return (
                    <div key={faq.id} className="rounded-xl border border-sand-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : faq.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                      >
                        <span className="font-medium text-earth-950">{faq.question}</span>
                        <svg
                          viewBox="0 0 24 24"
                          className={`h-5 w-5 shrink-0 text-earth-700 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {isOpen && <p className="border-t border-sand-200 px-4 py-3.5 text-sm text-earth-700">{faq.answer}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {filteredFaqs.length === 0 && (
            <div className="rounded-xl border border-dashed border-sand-200 bg-white py-10 text-center text-earth-700">
              No FAQs match “{query}”.
            </div>
          )}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold text-earth-950">Contact Support</h2>
        <p className="mt-1 text-earth-700">Can't find your answer? Send us a message directly.</p>

        {submitted ? (
          <div className="mt-5 rounded-xl border border-earth-600/30 bg-earth-600/10 p-5 text-earth-800">
            <p className="font-semibold">Message sent</p>
            <p className="mt-1 text-sm">
              Thanks, {form.name || 'there'} — our team will reply to {form.email || 'your email'} within one business
              day.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 rounded-2xl border border-sand-200 bg-white p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-earth-800">
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-earth-800">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-earth-800">
                Message
              </label>
              <textarea
                id="contact-message"
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>
            <button
              type="submit"
              className="self-start rounded-xl bg-earth-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-earth-700"
            >
              Send Message
            </button>
          </form>
        )}
      </section>

      <LiveChatWidget />
    </div>
  )
}
