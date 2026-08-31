import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import CropCard from '../components/CropCard'
import OrderStatusTracker from '../components/OrderStatusTracker'
import { useAuth } from '../context/AuthContext'
import { useCrops } from '../context/CropContext'
import { useMessaging } from '../context/MessagingContext'
import { useOrders } from '../context/OrdersContext'
import { useWatchlist } from '../context/WatchlistContext'

export default function BuyerDashboard() {
  const { user } = useAuth()
  const { threads } = useMessaging()
  const { orders } = useOrders()
  const { listings } = useCrops()
  const { savedIds } = useWatchlist()

  const myOrders = useMemo(
    () =>
      orders
        .filter((o) => (user?.id ? o.buyerId === user.id : o.buyerName === user?.name))
        .sort((a, b) => b.createdAt - a.createdAt),
    [orders, user],
  )
  const savedListings = useMemo(() => listings.filter((l) => savedIds.includes(l.id)), [listings, savedIds])

  const metrics = useMemo(() => {
    const activeInquiries = threads.length
    const escrowFunded = myOrders.filter((o) => o.status !== 'Inquiry Sent').length
    const offersSent = threads.reduce((sum, t) => sum + t.messages.filter((m) => m.kind === 'offer').length, 0)
    return { activeInquiries, escrowFunded, offersSent }
  }, [threads, myOrders])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-earth-950">Buyer Dashboard</h1>
        <p className="mt-1 text-earth-700">Welcome back, {user?.name}. Track your inquiries and trades here.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Active Inquiries" value={metrics.activeInquiries} />
        <MetricCard label="Offers Sent" value={metrics.offersSent} />
        <MetricCard label="Trades in Escrow+" value={metrics.escrowFunded} />
      </div>

      <div className="mt-10 rounded-2xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-bold text-earth-950">Saved Listings &amp; Watchlist</h2>

        {savedListings.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-sand-200 py-10 text-center text-earth-700">
            No saved listings yet. Tap the bookmark icon on any crop card to add it here.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {savedListings.map((listing) => (
              <CropCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 rounded-2xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-bold text-earth-950">Active Trade Inquiries</h2>

        {threads.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-sand-200 py-10 text-center text-earth-700">
            No inquiries yet. Browse the marketplace and contact a farmer to get started.
            <div className="mt-4">
              <Link
                to="/marketplace"
                className="inline-block rounded-xl bg-earth-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-earth-700"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                to={`/messages?thread=${thread.id}`}
                className="flex items-center justify-between rounded-xl border border-sand-200 px-4 py-3 hover:bg-sand-50"
              >
                <div>
                  <p className="font-medium text-earth-950">{thread.cropName}</p>
                  <p className="text-sm text-earth-700">with {thread.counterpartName}</p>
                </div>
                <span className="text-sm text-earth-700/70">{thread.messages.length} messages</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 rounded-2xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-bold text-earth-950">Order History &amp; Escrow Status</h2>

        {myOrders.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-sand-200 py-10 text-center text-earth-700">
            No orders yet. Fund an escrow trade from a conversation to see it tracked here.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {myOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-sand-200 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-earth-950">
                      {order.quantity} t {order.cropName}
                    </p>
                    <p className="text-sm text-earth-700">Farmer: {order.farmerName}</p>
                  </div>
                  <span className="text-sm font-semibold text-earth-950">${order.totalUSD.toLocaleString()}</span>
                </div>
                <OrderStatusTracker status={order.status} />
              </div>
            ))}
          </div>
        )}
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
