import { useState, type FormEvent } from 'react'

interface ChatMessage {
  from: 'user' | 'agent'
  text: string
}

const INITIAL_MESSAGE: ChatMessage = {
  from: 'agent',
  text: "Hi! I'm here to help with escrow, logistics, or certification questions. What's on your mind?",
}

export default function LiveChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [draft, setDraft] = useState('')

  function handleSend(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return

    setMessages((prev) => [
      ...prev,
      { from: 'user', text },
      {
        from: 'agent',
        text: "Thanks — a support specialist will follow up shortly. In the meantime, check our FAQ above for common answers.",
      },
    ])
    setDraft('')
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-earth-800 px-4 py-3 text-white">
            <span className="text-sm font-semibold">Live Support</span>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  message.from === 'agent'
                    ? 'bg-sand-100 text-earth-950'
                    : 'ml-auto bg-earth-800 text-white'
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-sand-200 p-3">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-earth-800 px-3 py-2 text-sm font-semibold text-white hover:bg-earth-700"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close live chat' : 'Open live chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-earth-800 text-2xl text-white shadow-lg transition-transform hover:scale-105"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}
