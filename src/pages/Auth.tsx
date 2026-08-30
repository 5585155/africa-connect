import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

export default function Auth() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [role, setRole] = useState<Role>('farmer')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const displayName = name.trim() || email.split('@')[0] || 'there'
    login({ name: displayName, email, role })
    navigate(role === 'farmer' ? '/farmer/dashboard' : '/buyer/dashboard')
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-earth-950">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-earth-700">
          {mode === 'signin' ? 'Sign in to manage your trades.' : 'Join Africa Connect as a farmer or buyer.'}
        </p>
      </div>

      <div className="mb-6 flex rounded-full bg-sand-100 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-full py-2 transition-colors ${
            mode === 'signup' ? 'bg-earth-800 text-white' : 'text-earth-800'
          }`}
        >
          Sign Up
        </button>
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-full py-2 transition-colors ${
            mode === 'signin' ? 'bg-earth-800 text-white' : 'text-earth-800'
          }`}
        >
          Log In
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-sand-200 bg-white p-6">
        <div>
          <p className="mb-2 text-sm font-medium text-earth-800">I am a</p>
          <div role="tablist" aria-label="Choose account type" className="flex rounded-xl bg-sand-100 p-1">
            {(['farmer', 'buyer'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={role === option}
                onClick={() => setRole(option)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                  role === option ? 'bg-earth-800 text-white' : 'text-earth-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="auth-name" className="mb-1 block text-sm font-medium text-earth-800">
              Full name
            </label>
            <input
              id="auth-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wanjiru Kamau"
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
            />
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-earth-800">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-earth-800">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
          />
        </div>

        <button
          type="submit"
          className="mt-2 rounded-xl bg-earth-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-700"
        >
          {mode === 'signin' ? 'Log In' : `Create ${role} account`}
        </button>

        <p className="text-center text-xs text-earth-700/70">
          This is a demo — no real account is created and passwords aren't stored.
        </p>
      </form>
    </div>
  )
}
