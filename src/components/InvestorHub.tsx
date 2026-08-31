import { useMemo, useState, type FormEvent } from 'react'
import { useCrops } from '../context/CropContext'
import { useOrders } from '../context/OrdersContext'

const REGULATORY_MATRIX = [
  {
    country: 'Ghana',
    crop: 'Cocoa',
    board: 'COCOBOD',
    mechanism: 'Export routed through a COCOBOD-Licensed Buying Company (LBC) — listings on the platform are attributed to the LBC, not an individual farmer, matching the real-world statutory chain of custody.',
  },
  {
    country: 'Ethiopia',
    crop: 'Coffee',
    board: 'ECTA / ECX',
    mechanism: 'Listings are attributed to an ECTA-licensed export washing station, with ECX auction clearance called out as a required compliance step before trade.',
  },
  {
    country: 'Kenya',
    crop: 'Maize & cereals',
    board: 'NCPB',
    mechanism: 'A visible compliance badge flags the NCPB export permit requirement on the listing and again at escrow checkout, before any funds move.',
  },
]

export default function InvestorHub() {
  const { listings } = useCrops()
  const { orders } = useOrders()

  const metrics = useMemo(() => {
    const verifiedListings = listings.filter((l) => l.verifiedStatus).length
    const tradeVolumeUSD = orders.reduce((sum, o) => sum + o.totalUSD, 0)
    const shippingLanes = new Set(listings.map((l) => l.originCountry)).size
    return { verifiedListings, tradeVolumeUSD, shippingLanes }
  }, [listings, orders])

  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ organization: '', name: '', email: '', type: 'DFI', message: '' })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="rounded-full bg-earth-600/10 px-4 py-1 text-sm font-medium text-earth-700">
          For DFIs, Impact Investors &amp; Trade Partners
        </span>
        <h1 className="mt-4 text-3xl font-bold text-earth-950 sm:text-4xl">
          Investing in Structured African Agri-Trade
        </h1>
        <p className="mt-3 text-earth-700">
          Africa Connect turns fragmented, informal produce trade into a transparent, compliant, and financeable
          pipeline — from listing to escrow to delivery.
        </p>
      </div>

      {/* The Decision Intelligence Gap */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-earth-950">The Decision Intelligence Gap</h2>
        <p className="mt-2 max-w-3xl text-earth-700">
          International buyers and capital providers routinely pass on African agricultural supply not because the
          produce isn't there, but because the data isn't: who actually grew it, whether it's export-legal, what it's
          really worth, and whether payment is safe to release. Africa Connect exists to close that gap.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-clay-600/30 bg-clay-600/5 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-clay-700">Without structured data</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-earth-800">
              <li>• Farmer identity and certifications are unverifiable from abroad</li>
              <li>• Export-monopoly crops (cocoa, coffee) carry undisclosed regulatory risk</li>
              <li>• Pricing is negotiated blind, with no trend or seasonal context</li>
              <li>• Payment has to be trusted, or delayed, or wired before verification</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-earth-600/30 bg-earth-600/5 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-earth-700">With Africa Connect</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-earth-800">
              <li>• Verified badges and certifications attached to every listing</li>
              <li>• Regulatory compliance notes surfaced before contact, and again at checkout</li>
              <li>• AI-assisted price trend and demand context ahead of any offer</li>
              <li>• Escrow holds funds until delivery is confirmed by the buyer</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Regulatory Safety Matrix */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-earth-950">Regulatory Safety Matrix</h2>
        <p className="mt-2 max-w-3xl text-earth-700">
          Several of the continent's highest-value export crops are state-monopoly commodities. Africa Connect
          doesn't route around that — it surfaces it, so trades stay inside the legal channel.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-sand-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-xs uppercase tracking-wide text-earth-700/70">
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Crop</th>
                <th className="px-4 py-3">Regulator</th>
                <th className="px-4 py-3">How the platform handles it</th>
              </tr>
            </thead>
            <tbody>
              {REGULATORY_MATRIX.map((row) => (
                <tr key={row.country} className="border-b border-sand-100 last:border-0 align-top">
                  <td className="px-4 py-3 font-medium text-earth-950">{row.country}</td>
                  <td className="px-4 py-3 text-earth-700">{row.crop}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-clay-600/10 px-2.5 py-1 text-xs font-semibold text-clay-700">
                      {row.board}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-earth-700">{row.mechanism}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Platform Economics & Growth */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-earth-950">Platform Economics &amp; Growth</h2>
        <p className="mt-2 text-earth-700">Live figures from the current marketplace catalog and trade activity.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Verified cooperative listings" value={metrics.verifiedListings} />
          <MetricCard label="Trade volume facilitated" value={`$${metrics.tradeVolumeUSD.toLocaleString()}`} />
          <MetricCard label="Regional shipping lanes covered" value={metrics.shippingLanes} />
        </div>
        <p className="mt-3 text-xs text-earth-700/60">
          Reflects this deployment's current data — a demo catalog and its trade activity, not audited financials.
        </p>
      </section>

      {/* Institutional Contact Form */}
      <section className="mt-14">
        <h2 className="text-xl font-bold text-earth-950">Institutional Inquiries</h2>
        <p className="mt-2 text-earth-700">
          For DFIs, impact funds, and agricultural trade partners exploring a structured partnership.
        </p>

        {submitted ? (
          <div className="mt-5 rounded-xl border border-earth-600/30 bg-earth-600/10 p-5 text-earth-800">
            <p className="font-semibold">Inquiry received</p>
            <p className="mt-1 text-sm">
              Thanks, {form.name || 'there'} — our partnerships team will follow up at{' '}
              {form.email || 'your email'} shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-sand-200 bg-white p-6 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="inv-org" className="mb-1 block text-sm font-medium text-earth-800">
                Organization
              </label>
              <input
                id="inv-org"
                type="text"
                required
                value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>
            <div>
              <label htmlFor="inv-type" className="mb-1 block text-sm font-medium text-earth-800">
                Inquiry type
              </label>
              <select
                id="inv-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:border-earth-600"
              >
                <option>DFI</option>
                <option>Impact Investor</option>
                <option>Trade Partner</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="inv-name" className="mb-1 block text-sm font-medium text-earth-800">
                Contact name
              </label>
              <input
                id="inv-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>
            <div>
              <label htmlFor="inv-email" className="mb-1 block text-sm font-medium text-earth-800">
                Email
              </label>
              <input
                id="inv-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="inv-message" className="mb-1 block text-sm font-medium text-earth-800">
                Message
              </label>
              <textarea
                id="inv-message"
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>
            <button
              type="submit"
              className="self-start rounded-xl bg-earth-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-earth-700 sm:col-span-2"
            >
              Send Inquiry
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5">
      <p className="text-sm text-earth-700">{label}</p>
      <p className="mt-1 text-2xl font-bold text-earth-950">{value}</p>
    </div>
  )
}
