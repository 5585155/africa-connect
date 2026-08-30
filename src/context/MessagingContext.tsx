import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export type MessageKind = 'text' | 'offer' | 'escrow'

export interface ChatMessage {
  id: string
  sender: 'me' | 'them'
  kind: MessageKind
  text: string
  timestamp: number
}

export interface Thread {
  id: string
  listingId: string
  cropName: string
  counterpartName: string
  messages: ChatMessage[]
}

interface StartThreadParams {
  listingId: string
  cropName: string
  counterpartName: string
  initialMessage: string
}

interface MessagingContextValue {
  threads: Thread[]
  startThread: (params: StartThreadParams) => string
  sendMessage: (threadId: string, text: string, kind?: MessageKind) => void
}

const MessagingContext = createContext<MessagingContextValue | null>(null)

const REPLY_BANK: Record<MessageKind, string[]> = {
  text: [
    "Thanks for reaching out — yes, it's still available. How many tons are you looking for?",
    'Good to hear from you. Happy to answer any questions about the harvest or shipping.',
    "I'm around most of the day — let me know what works for your buying window.",
  ],
  offer: [
    "Received your offer — let me check with my cooperative and get back to you shortly.",
    "That's close to what I had in mind. Could you confirm the quantity and I'll match it?",
  ],
  escrow: [
    "Escrow trade accepted on my end — funds will be released once delivery is confirmed.",
    "Confirmed. I'll prep the shipment as soon as escrow shows funded.",
  ],
}

function pickReply(kind: MessageKind): string {
  const options = REPLY_BANK[kind]
  return options[Math.floor(Math.random() * options.length)]
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useLocalStorage<Thread[]>('ac-threads', [])
  const idCounter = useRef(0)

  const nextId = useCallback((prefix: string) => {
    idCounter.current += 1
    return `${prefix}-${Date.now()}-${idCounter.current}`
  }, [])

  const startThread = useCallback(
    ({ listingId, cropName, counterpartName, initialMessage }: StartThreadParams) => {
      let threadId = ''
      setThreads((prev) => {
        const existing = prev.find((t) => t.listingId === listingId)
        if (existing) {
          threadId = existing.id
          return prev
        }
        const id = nextId('thread')
        threadId = id
        const newThread: Thread = {
          id,
          listingId,
          cropName,
          counterpartName,
          messages: [
            {
              id: nextId('msg'),
              sender: 'me',
              kind: 'text',
              text: initialMessage,
              timestamp: Date.now(),
            },
          ],
        }
        return [newThread, ...prev]
      })
      return threadId
    },
    [nextId, setThreads],
  )

  const sendMessage = useCallback(
    (threadId: string, text: string, kind: MessageKind = 'text') => {
      const message: ChatMessage = {
        id: nextId('msg'),
        sender: 'me',
        kind,
        text,
        timestamp: Date.now(),
      }
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, message] } : t)))

      window.setTimeout(() => {
        const reply: ChatMessage = {
          id: nextId('msg'),
          sender: 'them',
          kind,
          text: pickReply(kind),
          timestamp: Date.now(),
        }
        setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, reply] } : t)))
      }, 1200)
    },
    [nextId, setThreads],
  )

  return (
    <MessagingContext.Provider value={{ threads, startThread, sendMessage }}>{children}</MessagingContext.Provider>
  )
}

export function useMessaging() {
  const ctx = useContext(MessagingContext)
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider')
  return ctx
}
