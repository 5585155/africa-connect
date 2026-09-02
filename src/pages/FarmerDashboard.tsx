import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react'
import ChartFallback from '../components/ChartFallback'
import OrderStatusTracker from '../components/OrderStatusTracker'
import { useAuth } from '../context/AuthContext'
import { useCrops } from '../context/CropContext'
import { useOrders } from '../context/OrdersContext'
import { CERTIFICATION_OPTIONS } from '../data/sellerListings'
import { cropFallbackIcon, isImageSource } from '../lib/cropVisuals'
import type { CropCategory, ListingStatus, SellerListing } from '../types'
import { ORDER_STAGES } from '../types'

const AIPricingRadar = lazy(() => import('../components/AIPricingRadar'))

const CATEGORIES: CropCategory[] = [
  'Grains',
  'Cocoa & Coffee',
  'Fruits',
  'Oilseeds',
  'Tubers',
  'Nuts',
  'Legumes',
  'Fiber',
]

const STATUSES: ListingStatus[] = ['Available', 'Sold Out', 'In Transit']

const EMPTY_FORM = {
  cropName: '',
  category: 'Grains' as CropCategory,
  quantity: '',
  unitPrice: '',
  harvestDate: '',
  originCountry: '',
  certifications: [] as string[],
  image: '',
}

export default function FarmerDashboard() {
  const { user } = useAuth()
  const { listings, addListing, updateListing, updateStatus, deleteListing } = useCrops()
  const { orders, advanceOrder } = useOrders()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const myListings = useMemo(
    () => listings.filter((l) => (user?.id ? l.farmerId === user.id : l.farmerName === user?.name)),
    [listings, user],
  )
  const myOrders = useMemo(
    () =>
      orders
        .filter((o) => (user?.id ? o.farmerId === user.id : o.farmerName === user?.name))
        .sort((a, b) => b.createdAt - a.createdAt),
    [orders, user],
  )

  const metrics = useMemo(() => {
    const activeListings = myListings.filter((l) => l.status === 'Available').length
    const totalInquiries = myOrders.length
    const pendingEscrowTrades = myOrders.filter((o) => o.status === 'Escrow Funded').length
    const totalRevenue = myListings
      .filter((l) => l.status === 'Sold Out')
      .reduce((sum, l) => sum + l.unitPriceUSD * l.availableQuantity, 0)
    return { activeListings, totalInquiries, pendingEscrowTrades, totalRevenue }
  }, [myListings, myOrders])

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function toggleCertification(cert: string) {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.includes(cert)
        ? f.certifications.filter((c) => c !== cert)
        : [...f.certifications, cert],
    }))
  }

  function handleImageChange(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, image: reader.result as string }))
    reader.readAsDataURL(file)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const quantity = Number(form.quantity)
    const unitPrice = Number(form.unitPrice)
    if (!form.cropName || !form.originCountry || !form.harvestDate || quantity <= 0 || unitPrice <= 0) return

    if (editingId) {
      updateListing(editingId, {
        cropName: form.cropName,
        category: form.category,
        availableQuantity: quantity,
        unitPriceUSD: unitPrice,
        harvestDate: form.harvestDate,
        originCountry: form.originCountry,
        certifications: form.certifications,
        ...(form.image ? { image: form.image } : {}),
      })
    } else {
      const newListing: SellerListing = {
        id: `seller-${Date.now()}`,
        cropName: form.cropName,
        category: form.category,
        originCountry: form.originCountry,
        availableQuantity: quantity,
        unitPriceUSD: unitPrice,
        farmerName: user?.name ?? 'You',
        verifiedStatus: false,
        harvestDate: form.harvestDate,
        image: form.image || '🌱',
        certifications: form.certifications,
        status: 'Available',
      }
      addListing(newListing)
    }

    resetForm()
  }

  function handleEdit(listing: SellerListing) {
    setEditingId(listing.id)
    setForm({
      cropName: listing.cropName,
      category: listing.category,
      quantity: String(listing.availableQuantity),
      unitPrice: String(listing.unitPriceUSD),
      harvestDate: listing.harvestDate,
      originCountry: listing.originCountry,
      certifications: listing.certifications,
      image: listing.image,
    })
    document.getElementById('listing-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    deleteListing(id)
    if (editingId === id) resetForm()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-earth-950">Farmer Dashboard</h1>
        <p className="mt-1 text-earth-700">Welcome back, {user?.name}. Here's how your listings are performing.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Active Listings" value={metrics.activeListings} />
        <MetricCard label="Total Inquiries" value={metrics.totalInquiries} />
        <MetricCard label="Pending Escrow Trades" value={metrics.pendingEscrowTrades} />
        <MetricCard label="Total Revenue" value={`$${metrics.totalRevenue.toLocaleString()}`} />
      </div>

      <div className="mt-10">
        <Suspense fallback={<ChartFallback height={280} />}>
          <AIPricingRadar listings={myListings} />
        </Suspense>
      </div>

      <div id="listing-form" className="mt-10 rounded-2xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-bold text-earth-950">{editingId ? 'Edit Listing' : 'New Crop Listing'}</h2>

        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cropName" className="mb-1 block text-sm font-medium text-earth-800">
              Crop name
            </label>
            <input
              id="cropName"
              type="text"
              required
              value={form.cropName}
              onChange={(e) => setForm((f) => ({ ...f, cropName: e.target.value }))}
              placeholder="e.g. White Maize"
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-earth-800">
              Category
            </label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CropCategory }))}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:border-earth-600"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-earth-800">
              Quantity (tons)
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              required
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
          </div>

          <div>
            <label htmlFor="unitPrice" className="mb-1 block text-sm font-medium text-earth-800">
              Unit price (USD / ton)
            </label>
            <input
              id="unitPrice"
              type="number"
              min={1}
              required
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
          </div>

          <div>
            <label htmlFor="harvestDate" className="mb-1 block text-sm font-medium text-earth-800">
              Harvest date
            </label>
            <input
              id="harvestDate"
              type="date"
              required
              value={form.harvestDate}
              onChange={(e) => setForm((f) => ({ ...f, harvestDate: e.target.value }))}
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
          </div>

          <div>
            <label htmlFor="originCountry" className="mb-1 block text-sm font-medium text-earth-800">
              Origin country
            </label>
            <input
              id="originCountry"
              type="text"
              required
              value={form.originCountry}
              onChange={(e) => setForm((f) => ({ ...f, originCountry: e.target.value }))}
              placeholder="e.g. Kenya"
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-earth-800">Certifications</p>
            <div className="flex flex-wrap gap-4">
              {CERTIFICATION_OPTIONS.map((cert) => (
                <label key={cert} className="flex items-center gap-2 text-sm text-earth-800">
                  <input
                    type="checkbox"
                    checked={form.certifications.includes(cert)}
                    onChange={() => toggleCertification(cert)}
                    className="h-4 w-4 accent-earth-800"
                  />
                  {cert}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="image" className="mb-1 block text-sm font-medium text-earth-800">
              Listing photo
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand-100 text-3xl">
                {form.image ? (
                  <img src={form.image} alt="Listing preview" className="h-full w-full object-cover" />
                ) : (
                  '🌱'
                )}
              </div>
              <input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e.target.files?.[0])}
                className="text-sm text-earth-700"
              />
            </div>
          </div>

          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-earth-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-earth-700"
            >
              {editingId ? 'Update Listing' : 'Add Listing'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-sand-200 px-6 py-2.5 text-sm font-semibold text-earth-800 hover:bg-sand-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-earth-950">My Listings</h2>
        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-xs uppercase tracking-wide text-earth-700/70">
                <th className="px-4 py-3">Crop</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Qty (t)</th>
                <th className="px-4 py-3">Price / ton</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {myListings.map((listing) => (
                <tr key={listing.id} className="border-b border-sand-100 last:border-0">
                  <td className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-sand-100 text-lg">
                      {isImageSource(listing.image) ? (
                        <img src={listing.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        cropFallbackIcon(listing.cropName, listing.category)
                      )}
                    </span>
                    <span className="font-medium text-earth-950">{listing.cropName}</span>
                  </td>
                  <td className="px-4 py-3 text-earth-700">{listing.category}</td>
                  <td className="px-4 py-3 text-earth-700">{listing.availableQuantity}</td>
                  <td className="px-4 py-3 text-earth-700">${listing.unitPriceUSD.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={listing.status}
                      onChange={(e) => updateStatus(listing.id, e.target.value as ListingStatus)}
                      className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-medium text-earth-800 outline-none focus:border-earth-600"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(listing)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-earth-700 hover:bg-sand-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(listing.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-clay-600 hover:bg-clay-600/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {myListings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-earth-700">
                    No listings yet. Add your first crop above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-earth-950">Orders on My Listings</h2>
        <div className="flex flex-col gap-3">
          {myOrders.map((order) => {
            const canAdvance = order.status !== 'Inquiry Sent' && order.status !== 'Delivered & Released'
            return (
              <div key={order.id} className="rounded-2xl border border-sand-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-earth-950">
                      {order.quantity} t {order.cropName}
                    </p>
                    <p className="text-sm text-earth-700">Buyer: {order.buyerName}</p>
                  </div>
                  {canAdvance && (
                    <button
                      type="button"
                      onClick={() => advanceOrder(order.id)}
                      className="rounded-lg bg-earth-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-earth-700"
                    >
                      Advance to{' '}
                      {ORDER_STAGES[Math.min(ORDER_STAGES.indexOf(order.status) + 1, ORDER_STAGES.length - 1)]}
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <OrderStatusTracker status={order.status} />
                </div>
                {order.receiptReference && (
                  <p className="mt-3 text-xs text-earth-700/70">Receipt: {order.receiptReference}</p>
                )}
              </div>
            )
          })}

          {myOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-sand-200 bg-white py-10 text-center text-earth-700">
              No orders yet. Orders appear here once a buyer contacts you about a listing.
            </div>
          )}
        </div>
      </div>
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
