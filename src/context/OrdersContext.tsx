import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isSchemaMismatchError, rowToOrder, type OrderRow } from '../lib/supabaseMappers'
import { ORDER_STAGES, type Order } from '../types'
import { useAuth } from './AuthContext'
import { toFundingUpdate, type EscrowBreakdown } from '../lib/escrow'

interface CreateOrderParams {
  threadId: string
  listingId: string
  cropName: string
  farmerName: string
  /** Supabase profile id of the farmer — required in Supabase mode, ignored locally. */
  farmerId?: string
  buyerName: string
  quantity: number
  unitPriceUSD: number
}

interface OrdersContextValue {
  orders: Order[]
  loading: boolean
  createOrder: (params: CreateOrderParams) => Promise<string>
  /** Resolves true only once the order's row is confirmed to actually reflect 'Escrow Funded' — never assume success from the absence of an error alone. */
  fundEscrow: (orderId: string, breakdown: EscrowBreakdown) => Promise<boolean>
  advanceOrder: (orderId: string) => void
  getOrderByThread: (threadId: string) => Order | undefined
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

// ── Local mock storage ─────────────────────────────────────────────────────
function LocalOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useLocalStorage<Order[]>('ac-orders', [])
  const idCounter = useRef(0)

  const createOrder = useCallback(
    async (params: CreateOrderParams) => {
      let orderId = ''
      setOrders((prev) => {
        const existing = prev.find((o) => o.threadId === params.threadId)
        if (existing) {
          orderId = existing.id
          return prev
        }
        idCounter.current += 1
        const id = `order-${Date.now()}-${idCounter.current}`
        orderId = id
        const order: Order = {
          id,
          threadId: params.threadId,
          listingId: params.listingId,
          cropName: params.cropName,
          farmerName: params.farmerName,
          buyerName: params.buyerName,
          quantity: params.quantity,
          unitPriceUSD: params.unitPriceUSD,
          logisticsUSD: 0,
          escrowFeeUSD: 0,
          totalUSD: params.quantity * params.unitPriceUSD,
          status: 'Inquiry Sent',
          createdAt: Date.now(),
        }
        return [order, ...prev]
      })
      return orderId
    },
    [setOrders],
  )

  const fundEscrow = useCallback(
    // DEFERRED, NOT VERIFIED — 2026-09-03 containment patch: `matched` is
    // assigned inside the updater function passed to `setOrders`, but React
    // does not guarantee that updater runs synchronously before this
    // function's `return matched` executes — under batching it can be
    // deferred past this point, which would make `matched` read as `false`
    // even when a real match exists and will be applied moments later. Not
    // exercised by tests/orders.test.mjs (which covers SupabaseOrdersProvider
    // only) or by any test in this containment patch. Left as-is because
    // funding is hard-disabled everywhere `fundEscrow` is called while
    // ORDER_WRITES_CONTAINED is true — do not treat this as fixed, and fix
    // it before ever relying on local mode's fundEscrow return value again.
    async (orderId: string, breakdown: EscrowBreakdown) => {
      let matched = false
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o
          matched = true
          return {
            ...o,
            status: 'Escrow Funded',
            unitPriceUSD: breakdown.unitPriceUSD,
            logisticsUSD: breakdown.logisticsUSD,
            escrowFeeUSD: breakdown.escrowFeeUSD,
            totalUSD: breakdown.totalUSD,
            receiptReference: breakdown.receiptReference,
          }
        }),
      )
      return matched
    },
    [setOrders],
  )

  const advanceOrder = useCallback(
    (orderId: string) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o
          const currentIndex = ORDER_STAGES.indexOf(o.status)
          const nextStage = ORDER_STAGES[Math.min(currentIndex + 1, ORDER_STAGES.length - 1)]
          return { ...o, status: nextStage }
        }),
      )
    },
    [setOrders],
  )

  const getOrderByThread = useCallback((threadId: string) => orders.find((o) => o.threadId === threadId), [orders])

  const value = useMemo<OrdersContextValue>(
    () => ({ orders, loading: false, createOrder, fundEscrow, advanceOrder, getOrderByThread }),
    [orders, createOrder, fundEscrow, advanceOrder, getOrderByThread],
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

// ── Supabase-backed, live across devices ────────────────────────────────────
const ORDER_SELECT =
  '*, crop_listings(crop_name), buyer:profiles!orders_buyer_id_fkey(full_name), farmer:profiles!orders_farmer_id_fkey(full_name)'

function SupabaseOrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) {
      setOrders([])
      setLoading(false)
      return
    }

    let { data, error } = await supabase!
      .from('orders')
      .select(ORDER_SELECT)
      .or(`buyer_id.eq.${user.id},farmer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error && isSchemaMismatchError(error)) {
      // The embedded joins (buyer/farmer/crop names) or the created_at
      // order-by don't match this project's live schema — fall back to a
      // plain select so orders still load, just without the joined display
      // names (rowToOrder already tolerates those fields being absent).
      console.warn('[OrdersContext] rich orders query failed, retrying with a simplified query', error)
      ;({ data, error } = await supabase!
        .from('orders')
        .select('*')
        .or(`buyer_id.eq.${user.id},farmer_id.eq.${user.id}`))
    }

    if (error) console.error('[OrdersContext] failed to load orders', error)
    const rows = ((data as unknown as OrderRow[] | null) ?? []).slice()
    rows.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    setOrders(rows.map(rowToOrder))
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
    if (!user?.id) return

    const channel = supabase!
      .channel(`orders-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [user?.id, load])

  const createOrder = useCallback(
    async (params: CreateOrderParams) => {
      if (!user?.id) throw new Error('You need to be signed in to start an order.')
      if (!params.farmerId) {
        // `orders.farmer_id` is NOT NULL in the schema — mirrors the same guard
        // in MessagingContext.startThread, which normally throws before this
        // is ever reached. Kept here too in case createOrder is ever called
        // on its own.
        throw new Error("This listing isn't linked to a farmer account yet, so an order can't be created for it.")
      }

      // Idempotent by conversation: `orders` has no unique constraint on
      // conversation_id, so re-contacting a farmer for a thread that already
      // has a linked order (the common case — Contact Farmer reopens an
      // existing conversation) must reuse that order instead of inserting a
      // fresh 'Inquiry Sent' row that would shadow one that may already be
      // funded (getOrderByThread resolves to the newest order per thread).
      const { data: existing, error: findError } = await supabase!
        .from('orders')
        .select('id')
        .eq('conversation_id', params.threadId)
        .maybeSingle()

      if (findError) {
        console.error('[OrdersContext] failed to check for an existing order', findError)
      } else if (existing) {
        return existing.id as string
      }

      const { data: inserted, error } = await supabase!
        .from('orders')
        .upsert({
          conversation_id: params.threadId,
          buyer_id: user.id,
          farmer_id: params.farmerId,
          crop_id: params.listingId,
          quantity_tons: params.quantity,
          unit_price_usd: params.unitPriceUSD,
          total_amount: params.quantity * params.unitPriceUSD,
          escrow_status: 'Inquiry Sent',
        }, { onConflict: 'conversation_id', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()

      let orderId = inserted?.id as string | undefined
      if (!error && !orderId) {
        const { data: winner, error: winnerError } = await supabase!
          .from('orders')
          .select('id')
          .eq('conversation_id', params.threadId)
          .single()
        if (winnerError) {
          console.error('[OrdersContext] failed to resolve concurrent order creation', winnerError)
        } else {
          orderId = winner.id as string
        }
      }

      if (error || !orderId) {
        console.error('[OrdersContext] createOrder failed', {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
        })
        throw new Error(error?.message || 'Could not create an order for this conversation. Please try again.')
      }

      // Awaited so a caller that immediately navigates to /messages (like
      // ProductDetailModal) finds the order already in state — without this,
      // the offer bubble would render "No linked order yet" until the
      // postgres_changes subscription below happened to fire a reload.
      await load()
      return orderId
    },
    [user, load],
  )

  const fundEscrow = useCallback(async (orderId: string, breakdown: EscrowBreakdown) => {
    // `.select()` after `.update()` returns the row PostgREST actually
    // changed — an update matching zero rows (RLS-blocked, or an unknown
    // id) returns no `error` at all, so checking the returned row's actual
    // `escrow_status` is what catches that, not `error === null` alone.
    const { data, error } = await supabase!
      .from('orders')
      .update(toFundingUpdate(breakdown))
      .eq('id', orderId)
      .select('escrow_status')
      .maybeSingle()

    if (error) {
      console.error('[OrdersContext] fundEscrow failed', error)
      return false
    }
    if (data?.escrow_status !== 'Escrow Funded') {
      console.error('[OrdersContext] fundEscrow reported no error but changed no row', { orderId, data })
      return false
    }
    return true
  }, [])

  const advanceOrder = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId)
      if (!order) return
      const currentIndex = ORDER_STAGES.indexOf(order.status)
      const nextStage = ORDER_STAGES[Math.min(currentIndex + 1, ORDER_STAGES.length - 1)]
      supabase!
        .from('orders')
        .update({ escrow_status: nextStage })
        .eq('id', orderId)
        .then(({ error }) => error && console.error('[OrdersContext] advanceOrder failed', error))
    },
    [orders],
  )

  const getOrderByThread = useCallback((threadId: string) => orders.find((o) => o.threadId === threadId), [orders])

  const value = useMemo<OrdersContextValue>(
    () => ({ orders, loading, createOrder, fundEscrow, advanceOrder, getOrderByThread }),
    [orders, loading, createOrder, fundEscrow, advanceOrder, getOrderByThread],
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  return isSupabaseConfigured ? (
    <SupabaseOrdersProvider>{children}</SupabaseOrdersProvider>
  ) : (
    <LocalOrdersProvider>{children}</LocalOrdersProvider>
  )
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider')
  return ctx
}
