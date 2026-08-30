import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { ORDER_STAGES, type Order } from '../types'

interface CreateOrderParams {
  threadId: string
  listingId: string
  cropName: string
  farmerName: string
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
  createOrder: (params: CreateOrderParams) => string
  fundEscrow: (orderId: string, breakdown: EscrowBreakdown) => void
  advanceOrder: (orderId: string) => void
  getOrderByThread: (threadId: string) => Order | undefined
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }) {
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

  return (
    <OrdersContext.Provider value={{ orders, createOrder, fundEscrow, advanceOrder, getOrderByThread }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider')
  return ctx
}
