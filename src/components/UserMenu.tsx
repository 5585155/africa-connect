import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function UserMenu({ fullWidth = false }: { fullWidth?: boolean }) {
  const { user, switchRole, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  if (!user) {
    return (
      <Link
        to="/auth"
        className={`rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-earth-800 transition-colors hover:bg-sand-100 ${
          fullWidth ? 'block w-full text-center' : ''
        }`}
      >
        Sign In
      </Link>
    )
  }

  const dashboardPath = user.role === 'farmer' ? '/farmer/dashboard' : '/buyer/dashboard'
  const otherRole: Role = user.role === 'farmer' ? 'buyer' : 'farmer'

  function handleLogout() {
    logout()
    setOpen(false)
    navigate('/')
  }

  async function handleSwitchRole() {
    setSwitching(true)
    setSwitchError(null)
    const result = await switchRole(otherRole)
    setSwitching(false)
    if (result.error) {
      setSwitchError(result.error)
      return
    }
    setOpen(false)
    navigate(otherRole === 'farmer' ? '/farmer/dashboard' : '/buyer/dashboard')
  }

  return (
    <div className={`flex items-center gap-2 ${fullWidth ? 'w-full flex-col items-stretch' : ''}`}>
      <Link
        to="/messages"
        aria-label="Messages"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sand-100 hover:bg-earth-700"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-3.53-.65L3 21l1.53-3.83A8.19 8.19 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
      </Link>

      <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex items-center gap-2 rounded-full border border-earth-600 bg-earth-800 py-1 pl-1 pr-3 text-sm font-medium text-sand-100 hover:bg-earth-700 ${
            fullWidth ? 'w-full justify-between pr-3' : ''
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-earth-600 text-xs font-bold text-white">
              {initials(user.name)}
            </span>
            <span className="max-w-[8rem] truncate">{user.name}</span>
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold capitalize">{user.role}</span>
        </button>

        {open && (
          <div
            className={`absolute right-0 z-10 mt-2 w-56 rounded-lg border border-earth-200 bg-white p-1.5 text-earth-950 shadow-lg ${
              fullWidth ? 'w-full' : ''
            }`}
          >
            <Link
              to={dashboardPath}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-sand-100"
            >
              Dashboard
            </Link>
            <Link
              to="/messages"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-sand-100"
            >
              Messages
            </Link>

            <div className="my-1.5 border-t border-sand-200" />

            <button
              type="button"
              onClick={handleSwitchRole}
              disabled={switching}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Switch to {otherRole} workspace</span>
              <span aria-hidden className="text-earth-700/50">⇄</span>
            </button>
            {switchError && <p className="px-3 pb-1 text-xs text-clay-600">{switchError}</p>}

            <div className="my-1.5 border-t border-sand-200" />

            <button
              type="button"
              onClick={handleLogout}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-clay-600 hover:bg-clay-600/10"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
