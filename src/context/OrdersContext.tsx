import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { rowToOrder, type OrderRow } from '../lib/supabaseMappers'
import { ORDER_STAGES, type Order } from '../types'
import { useAuth } from './AuthContext'

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

interface EscrowBreakdown {
  logisticsUSD: number
  escrowFeeUSD: number
  totalUSD: number
}

interface OrdersContextValue {
  orders: Order[]
  loading: boolean
  createOrder: (params: CreateOrderParams) => string
  fundEscrow: (orderId: string, breakdown: EscrowBreakdown) => void
  advanceOrder: (orderId: string) => void
  getOrderByThread: (threadId: string) => Order | undefined
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

// ── Local mock storage ─────────────────────────────────────────────────────
function LocalOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useLocalStorage<Order[]>('ac-orders', [])
  const idCounter = useRef(0)

  const createOrder = useCallback(
    (params: CreateOrderParams) => {
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
    (orderId: string, breakdown: EscrowBreakdown) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'Escrow Funded',
                logisticsUSD: breakdown.logisticsUSD,
                escrowFeeUSD: breakdown.escrowFeeUSD,
                totalUSD: breakdown.totalUSD,
              }
            : o,
        ),
      )
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

    const { data, error } = await supabase!
      .from('orders')
      .select(ORDER_SELECT)
      .or(`buyer_id.eq.${user.id},farmer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) console.error('[OrdersContext] failed to load orders', error)
    setOrders((data as unknown as OrderRow[] | null)?.map(rowToOrder) ?? [])
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
    (params: CreateOrderParams) => {
      if (!user?.id || !params.farmerId) return ''
      supabase!
        .from('orders')
        .insert({
          conversation_id: params.threadId,
          buyer_id: user.id,
          farmer_id: params.farmerId,
          crop_id: params.listingId,
          quantity_tons: params.quantity,
          unit_price_usd: params.unitPriceUSD,
          total_amount: params.quantity * params.unitPriceUSD,
          escrow_status: 'Inquiry Sent',
        })
        .then(({ error }) => error && console.error('[OrdersContext] createOrder failed', error))
      return ''
    },
    [user],
  )

  const fundEscrow = useCallback((orderId: string, breakdown: EscrowBreakdown) => {
    supabase!
      .from('orders')
      .update({
        escrow_status: 'Escrow Funded',
        logistics_usd: breakdown.logisticsUSD,
        escrow_fee_usd: breakdown.escrowFeeUSD,
        total_amount: breakdown.totalUSD,
      })
      .eq('id', orderId)
      .then(({ error }) => error && console.error('[OrdersContext] fundEscrow failed', error))
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
