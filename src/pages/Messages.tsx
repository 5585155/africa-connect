import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import EscrowPaymentModal, { computeEscrowBreakdown, type EscrowPaymentResult } from '../components/EscrowPaymentModal'
import OrderStatusTracker from '../components/OrderStatusTracker'
import { useAuth } from '../context/AuthContext'
import { useMessaging } from '../context/MessagingContext'
import { useOrders } from '../context/OrdersContext'

export default function Messages() {
  const { user } = useAuth()
  const { threads, loading, sendMessage } = useMessaging()
  const { getOrderByThread, fundEscrow } = useOrders()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('thread'))
  const [draft, setDraft] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [showOfferInput, setShowOfferInput] = useState(false)
  const [showEscrowModal, setShowEscrowModal] = useState(false)
  // Set when "Fund Escrow" is triggered from a specific offer bubble, so the
  // modal charges the negotiated price rather than the original listing price.
  const [escrowUnitPriceUSD, setEscrowUnitPriceUSD] = useState<number | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    const fromUrl = searchParams.get('thread')
    if (fromUrl) setActiveId(fromUrl)
    else if (!activeId && threads.length > 0) setActiveId(threads[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, threads])

  const activeThread = threads.find((t) => t.id === activeId) ?? null
  const activeOrder = activeThread ? getOrderByThread(activeThread.id) : undefined
  // Only the buyer actually pays into escrow — the farmer sees the same
  // accepted offer but as a read-only "waiting on buyer" note, not a button
  // that would open a payment modal for money that isn't theirs to send.
  const isBuyerViewing = Boolean(
    activeOrder && (user?.id ? user.id === activeOrder.buyerId : user?.name === activeOrder.buyerName),
  )

  // Only the most recent offer is actionable — once it's superseded by a
  // newer counter-offer, older ones are just history. "Accepted" means a
  // later `offer_accepted` message exists after it in the thread.
  const messages = activeThread?.messages ?? []
  const lastOfferId = [...messages].reverse().find((m) => m.kind === 'offer')?.id ?? null
  const lastOfferIndex = lastOfferId ? messages.findIndex((m) => m.id === lastOfferId) : -1
  const isLastOfferAccepted =
    lastOfferIndex >= 0 && messages.slice(lastOfferIndex + 1).some((m) => m.kind === 'offer_accepted')

  function selectThread(id: string) {
    setActiveId(id)
    setSearchParams({ thread: id })
    setShowOfferInput(false)
    setShowEscrowModal(false)
    setEscrowUnitPriceUSD(null)
    setAcceptError(null)
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

  /**
   * Recipient-side "Accept Offer" — records acceptance as its own message so
   * there's a clear, auditable moment the negotiated price was agreed to,
   * which is what unlocks that offer's Fund Escrow button for the sender.
   * Doesn't touch `orders.escrow_status` — an accepted-but-unfunded offer is
   * still exactly what `'Inquiry Sent'` already means; there's no separate
   * "pending escrow" stage in the schema (see OrderStatusTracker's four
   * canonical stages), and adding one would be a status value nothing else
   * in the app — the check constraint, the tracker UI — recognizes.
   */
  function handleAcceptOffer(priceOffer: number | undefined) {
    if (!activeThread || priceOffer == null) return
    if (!activeOrder) {
      setAcceptError(
        "This conversation isn't linked to an order yet, so there's nothing to accept into. This normally happens automatically when the buyer first made contact.",
      )
      return
    }
    setAcceptError(null)
    sendMessage(activeThread.id, `✅ Accepted offer of $${priceOffer.toLocaleString()}/ton`, 'offer_accepted', priceOffer)
  }

  /** Opens the escrow modal — `unitPriceUSD` overrides the order's original listing price when funding a specific negotiated offer. */
  function openEscrowModal(unitPriceUSD?: number) {
    setEscrowUnitPriceUSD(unitPriceUSD ?? null)
    setShowEscrowModal(true)
  }

  function handleConfirmEscrow(result: EscrowPaymentResult) {
    if (!activeThread || !activeOrder) return
    const unitPriceUSD = escrowUnitPriceUSD ?? activeOrder.unitPriceUSD
    const { logisticsUSD, escrowFeeUSD, totalUSD } = computeEscrowBreakdown(activeOrder.quantity, unitPriceUSD)
    fundEscrow(activeOrder.id, { unitPriceUSD, logisticsUSD, escrowFeeUSD, totalUSD, receiptReference: result.reference })

    const gateway = result.method === 'flutterwave' ? 'Flutterwave' : result.method === 'paystack' ? 'Paystack' : 'Stripe'
    sendMessage(
      activeThread.id,
      `Funded escrow trade for ${activeOrder.quantity} t ${activeOrder.cropName} via ${gateway}${
        result.sandbox ? ' (sandbox)' : ''
      } — total $${totalUSD.toLocaleString()} held in protected escrow. Receipt: ${result.reference}`,
      'escrow',
    )
    setShowEscrowModal(false)
    setEscrowUnitPriceUSD(null)
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
                {messages.map((message) => {
                  const isMe = message.sender !== 'them'
                  const offerUnitPriceUSD = message.priceOffer ?? activeOrder?.unitPriceUSD
                  const isLastOffer = message.kind === 'offer' && message.id === lastOfferId

                  return (
                    <div
                      key={message.id}
                      className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                        message.sender === 'them' ? 'bg-sand-100 text-earth-950' : 'ml-auto bg-earth-800 text-white'
                      } ${message.kind === 'offer' ? 'border border-clay-600/40' : ''} ${
                        message.kind === 'offer_accepted' ? 'border border-earth-600/50' : ''
                      } ${message.kind === 'escrow' ? 'border border-earth-600/50' : ''}`}
                    >
                      {message.kind === 'offer' && <p className="mb-0.5 text-xs font-bold uppercase tracking-wide">💵 Offer</p>}
                      {message.kind === 'offer_accepted' && (
                        <p className="mb-0.5 text-xs font-bold uppercase tracking-wide">✅ Offer Accepted</p>
                      )}
                      {message.kind === 'escrow' && (
                        <p className="mb-0.5 text-xs font-bold uppercase tracking-wide">🔒 Escrow</p>
                      )}
                      {message.text}

                      {/* Older, superseded offers get no action — only the most recent one is live. */}
                      {isLastOffer &&
                        (!activeOrder ? (
                          <p className={`mt-2 text-xs ${isMe ? 'text-sand-100/80' : 'text-earth-700/70'}`}>
                            No linked order yet — this offer can't be accepted or funded directly.
                          </p>
                        ) : activeOrder.status !== 'Inquiry Sent' ? (
                          <p className={`mt-2 text-xs font-medium ${isMe ? 'text-sand-100' : 'text-earth-700'}`}>
                            ✓ {activeOrder.status}
                          </p>
                        ) : !isLastOfferAccepted ? (
                          isMe ? (
                            <p className="mt-2 text-xs font-medium text-sand-100">
                              ⏳ Waiting for {activeThread.counterpartName} to accept…
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAcceptOffer(message.priceOffer)}
                              className="mt-2 block w-full rounded-lg bg-earth-800 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-earth-700"
                            >
                              ✅ Accept Offer — ${(message.priceOffer ?? 0).toLocaleString()}/ton
                            </button>
                          )
                        ) : isBuyerViewing ? (
                          <button
                            type="button"
                            onClick={() => openEscrowModal(offerUnitPriceUSD)}
                            className={`mt-2 block w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              isMe
                                ? 'bg-white/15 text-white hover:bg-white/25'
                                : 'bg-earth-800 text-white hover:bg-earth-700'
                            }`}
                          >
                            🔒 Fund Escrow — ${((offerUnitPriceUSD ?? 0) * activeOrder.quantity).toLocaleString()}
                          </button>
                        ) : (
                          <p className={`mt-2 text-xs font-medium ${isMe ? 'text-sand-100' : 'text-earth-700'}`}>
                            ✓ Accepted — waiting for the buyer to fund escrow
                          </p>
                        ))}
                    </div>
                  )
                })}
              </div>

              {acceptError && (
                <p role="alert" className="mx-5 mb-2 rounded-lg bg-clay-600/10 px-3 py-2 text-sm text-clay-700">
                  {acceptError}
                </p>
              )}

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
                  {activeOrder &&
                    activeOrder.status === 'Inquiry Sent' &&
                    isBuyerViewing &&
                    // Block funding at the original listing price while a
                    // counter-offer is still awaiting the farmer's acceptance
                    // — otherwise the buyer could bypass their own negotiation.
                    (!lastOfferId || isLastOfferAccepted) && (
                      <button
                        type="button"
                        onClick={() => openEscrowModal()}
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
          unitPriceUSD={escrowUnitPriceUSD ?? activeOrder.unitPriceUSD}
          onConfirm={handleConfirmEscrow}
          onClose={() => {
            setShowEscrowModal(false)
            setEscrowUnitPriceUSD(null)
          }}
        />
      )}
    </div>
  )
}
