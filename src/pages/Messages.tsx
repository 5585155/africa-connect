import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import EscrowPaymentModal, { computeEscrowBreakdown, type EscrowPaymentResult } from '../components/EscrowPaymentModal'
import OrderStatusTracker from '../components/OrderStatusTracker'
import { useMessaging } from '../context/MessagingContext'
import { useOrders } from '../context/OrdersContext'

export default function Messages() {
  const { threads, loading, sendMessage } = useMessaging()
  const { getOrderByThread, fundEscrow } = useOrders()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('thread'))
  const [draft, setDraft] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [showOfferInput, setShowOfferInput] = useState(false)
  const [showEscrowModal, setShowEscrowModal] = useState(false)

  useEffect(() => {
    const fromUrl = searchParams.get('thread')
    if (fromUrl) setActiveId(fromUrl)
    else if (!activeId && threads.length > 0) setActiveId(threads[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, threads])

  const activeThread = threads.find((t) => t.id === activeId) ?? null
  const activeOrder = activeThread ? getOrderByThread(activeThread.id) : undefined

  function selectThread(id: string) {
    setActiveId(id)
    setSearchParams({ thread: id })
    setShowOfferInput(false)
    setShowEscrowModal(false)
  }

  function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!activeThread || !draft.trim()) return
    sendMessage(activeThread.id, draft.trim(), 'text')
    setDraft('')
  }

  function handleSendOffer(event: FormEvent) {
    event.preventDefault()
    if (!activeThread || !offerPrice) return
    sendMessage(activeThread.id, `Counter-offer: $${offerPrice} / ton`, 'offer', Number(offerPrice))
    setOfferPrice('')
    setShowOfferInput(false)
  }

  function handleConfirmEscrow(result: EscrowPaymentResult) {
    if (!activeThread || !activeOrder) return
    const { logisticsUSD, escrowFeeUSD, totalUSD } = computeEscrowBreakdown(activeOrder.quantity, activeOrder.unitPriceUSD)
    fundEscrow(activeOrder.id, { logisticsUSD, escrowFeeUSD, totalUSD, receiptReference: result.reference })

    const gateway = result.method === 'flutterwave' ? 'Flutterwave' : result.method === 'paystack' ? 'Paystack' : 'Stripe'
    sendMessage(
      activeThread.id,
      `Funded escrow trade for ${activeOrder.quantity} t ${activeOrder.cropName} via ${gateway}${
        result.sandbox ? ' (sandbox)' : ''
      } — total $${totalUSD.toLocaleString()} held in protected escrow. Receipt: ${result.reference}`,
      'escrow',
    )
    setShowEscrowModal(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-earth-700">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-earth-800/10 text-2xl">
          💬
        </div>
        <p className="mt-4">Loading your conversations…</p>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-earth-800/10 text-2xl">
          💬
        </div>
        <h1 className="mt-4 text-2xl font-bold text-earth-950">No messages yet</h1>
        <p className="mt-2 text-earth-700">
          Contact a farmer from any listing in the marketplace to start a conversation.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-earth-950">Messages</h1>

      <div className="grid grid-cols-1 gap-4 overflow-hidden rounded-2xl border border-sand-200 bg-white md:grid-cols-[280px_1fr]">
        <aside className="border-b border-sand-200 md:border-b-0 md:border-r">
          <ul className="max-h-[32rem] overflow-y-auto">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-sand-100 px-4 py-3 text-left transition-colors ${
                    thread.id === activeId ? 'bg-earth-800/5' : 'hover:bg-sand-50'
                  }`}
                >
                  <span className="font-medium text-earth-950">{thread.cropName}</span>
                  <span className="text-xs text-earth-700">{thread.counterpartName}</span>
                  <span className="mt-1 line-clamp-1 text-xs text-earth-700/70">
                    {thread.messages[thread.messages.length - 1]?.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex h-[36rem] flex-col">
          {activeThread ? (
            <>
              <div className="border-b border-sand-200 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-earth-950">{activeThread.counterpartName}</p>
                    <p className="text-xs text-earth-700">Re: {activeThread.cropName}</p>
                  </div>
                  {activeOrder && (
                    <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold text-earth-700">
                      {activeOrder.status}
                    </span>
                  )}
                </div>
                {activeOrder && (
                  <div className="mt-3">
                    <OrderStatusTracker status={activeOrder.status} compact />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {activeThread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                      message.sender === 'them'
                        ? 'bg-sand-100 text-earth-950'
                        : 'ml-auto bg-earth-800 text-white'
                    } ${message.kind === 'offer' ? 'border border-clay-600/40' : ''} ${
                      message.kind === 'escrow' ? 'border border-earth-600/50' : ''
                    }`}
                  >
                    {message.kind === 'offer' && <p className="mb-0.5 text-xs font-bold uppercase tracking-wide">💵 Offer</p>}
                    {message.kind === 'escrow' && (
                      <p className="mb-0.5 text-xs font-bold uppercase tracking-wide">🔒 Escrow</p>
                    )}
                    {message.text}
                  </div>
                ))}
              </div>

              <div className="border-t border-sand-200 p-4">
                {showOfferInput && (
                  <form onSubmit={handleSendOffer} className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-medium text-earth-800">$</span>
                    <input
                      type="number"
                      min={1}
                      autoFocus
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      placeholder="Price per ton"
                      className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg bg-earth-800 px-3 py-2 text-sm font-semibold text-white hover:bg-earth-700"
                    >
                      Send Offer
                    </button>
                  </form>
                )}

                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOfferInput((s) => !s)}
                    className="rounded-full border border-sand-200 px-3 py-1.5 text-xs font-semibold text-earth-800 hover:border-earth-600"
                  >
                    💵 Counter-offer
                  </button>
                  {activeOrder && activeOrder.status === 'Inquiry Sent' && (
                    <button
                      type="button"
                      onClick={() => setShowEscrowModal(true)}
                      className="rounded-full border border-earth-600/40 bg-earth-600/10 px-3 py-1.5 text-xs font-semibold text-earth-700 hover:bg-earth-600/20"
                    >
                      🔒 Fund Escrow Trade
                    </button>
                  )}
                </div>

                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-earth-800 px-4 py-2 text-sm font-semibold text-white hover:bg-earth-700"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-earth-700">Select a conversation</div>
          )}
        </div>
      </div>

      {showEscrowModal && activeOrder && (
        <EscrowPaymentModal
          orderId={activeOrder.id}
          cropName={activeOrder.cropName}
          quantity={activeOrder.quantity}
          unitPriceUSD={activeOrder.unitPriceUSD}
          onConfirm={handleConfirmEscrow}
          onClose={() => setShowEscrowModal(false)}
        />
      )}
    </div>
  )
}
