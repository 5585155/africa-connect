import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

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
  /** Supabase profile id of the farmer being contacted — required in Supabase mode, ignored locally. */
  counterpartId?: string
  initialMessage: string
}

interface MessagingContextValue {
  threads: Thread[]
  loading: boolean
  startThread: (params: StartThreadParams) => Promise<string>
  sendMessage: (threadId: string, text: string, kind?: MessageKind, priceOffer?: number) => void
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

// ── Local mock storage — simulates the other party replying ────────────────
function LocalMessagingProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useLocalStorage<Thread[]>('ac-threads', [])
  const idCounter = useRef(0)

  const nextId = useCallback((prefix: string) => {
    idCounter.current += 1
    return `${prefix}-${Date.now()}-${idCounter.current}`
  }, [])

  const startThread = useCallback(
    async ({ listingId, cropName, counterpartName, initialMessage }: StartThreadParams) => {
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

  const value = useMemo<MessagingContextValue>(
    () => ({ threads, loading: false, startThread, sendMessage }),
    [threads, startThread, sendMessage],
  )

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
}

// ── Supabase-backed conversations/messages, live across devices ────────────
function SupabaseMessagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) {
      setThreads([])
      setLoading(false)
      return
    }

    const { data: conversations, error: convError } = await supabase!
      .from('conversations')
      .select(
        '*, crop_listings(crop_name), buyer:profiles!conversations_buyer_id_fkey(full_name), farmer:profiles!conversations_farmer_id_fkey(full_name)',
      )
      .or(`buyer_id.eq.${user.id},farmer_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (convError) {
      console.error('[MessagingContext] failed to load conversations', convError)
      setLoading(false)
      return
    }

    const ids = (conversations ?? []).map((c) => c.id)
    const { data: messages, error: msgError } = ids.length
      ? await supabase!.from('messages').select('*').in('conversation_id', ids).order('created_at', { ascending: true })
      : { data: [], error: null }

    if (msgError) console.error('[MessagingContext] failed to load messages', msgError)

    const nextThreads: Thread[] = (conversations ?? []).map((c) => ({
      id: c.id,
      listingId: c.crop_id,
      cropName: c.crop_listings?.crop_name ?? 'Listing',
      counterpartName: (user.id === c.buyer_id ? c.farmer?.full_name : c.buyer?.full_name) ?? 'Trade partner',
      messages: (messages ?? [])
        .filter((m) => m.conversation_id === c.id)
        .map((m) => ({
          id: m.id,
          sender: m.sender_id === user.id ? 'me' : ('them' as const),
          kind: m.kind as MessageKind,
          text: m.text,
          timestamp: new Date(m.created_at).getTime(),
        })),
    }))

    setThreads(nextThreads)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()

    if (!user?.id) return
    const channel = supabase!
      .channel(`messaging-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [user?.id, load])

  const startThread = useCallback(
    async ({ listingId, counterpartId, initialMessage }: StartThreadParams) => {
      if (!user?.id || !counterpartId) return ''

      const existing = threads.find((t) => t.listingId === listingId)
      if (existing) return existing.id

      const { data: conversation, error } = await supabase!
        .from('conversations')
        .upsert({ buyer_id: user.id, farmer_id: counterpartId, crop_id: listingId }, { onConflict: 'buyer_id,crop_id' })
        .select()
        .single()

      if (error || !conversation) {
        console.error('[MessagingContext] failed to start conversation', error)
        return ''
      }

      await supabase!.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        text: initialMessage,
        kind: 'text',
      })

      await load()
      return conversation.id as string
    },
    [threads, user, load],
  )

  const sendMessage = useCallback(
    (threadId: string, text: string, kind: MessageKind = 'text', priceOffer?: number) => {
      if (!user?.id) return
      supabase!
        .from('messages')
        .insert({ conversation_id: threadId, sender_id: user.id, text, kind, price_offer: priceOffer ?? null })
        .then(({ error }) => error && console.error('[MessagingContext] sendMessage failed', error))
    },
    [user],
  )

  const value = useMemo<MessagingContextValue>(
    () => ({ threads, loading, startThread, sendMessage }),
    [threads, loading, startThread, sendMessage],
  )

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  return isSupabaseConfigured ? (
    <SupabaseMessagingProvider>{children}</SupabaseMessagingProvider>
  ) : (
    <LocalMessagingProvider>{children}</LocalMessagingProvider>
  )
}

export function useMessaging() {
  const ctx = useContext(MessagingContext)
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider')
  return ctx
}
