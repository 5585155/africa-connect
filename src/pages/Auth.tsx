import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

export default function Auth() {
  const { signUp, signIn, resendConfirmation } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [role, setRole] = useState<Role>('farmer')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  async function handleResend() {
    setResending(true)
    setResendStatus(null)
    const result = await resendConfirmation(email)
    setResending(false)
    setResendStatus(
      result.error
        ? result.error
        : 'Confirmation requested again. Check your spam folder and allow a few minutes for delivery.',
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result =
      mode === 'signup' ? await signUp({ name, email, password, role }) : await signIn({ email, password, role })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }
    if (result.needsEmailConfirmation) {
      setCheckEmail(true)
      return
    }
    navigate((result.role ?? role) === 'farmer' ? '/farmer/dashboard' : '/buyer/dashboard')
  }

  if (checkEmail) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-earth-800/10 text-2xl">
          📬
        </div>
        <h1 className="mt-4 text-2xl font-bold text-earth-950">Check your email</h1>
        <p className="mt-2 text-earth-700">
          A confirmation link was requested for <strong>{email}</strong>. Confirm it, then come back and log in.
        </p>
        <p className="mt-3 text-sm text-earth-700/75">Check your spam folder and verify that the address is correct.</p>
        {resendStatus && (
          <p role="status" className="mt-4 rounded-lg bg-sand-100 px-3 py-2 text-sm text-earth-800">
            {resendStatus}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="rounded-xl bg-earth-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-earth-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? 'Requesting…' : 'Resend confirmation'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCheckEmail(false)
              setResendStatus(null)
            }}
            className="rounded-xl border border-sand-300 px-5 py-2.5 text-sm font-semibold text-earth-800 hover:bg-sand-100"
          >
            Correct email address
          </button>
        </div>
      </div>
    )
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
          {mode === 'signin' ? (
            <p className="mt-1.5 text-xs text-earth-700/60">
              Only used as a fallback when no backend is connected — a real account's role comes from your profile.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-earth-700/60">
              This is your starting workspace — you can switch to the other one anytime from your account menu.
            </p>
          )}
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

        {error && (
          <p role="alert" className="rounded-lg bg-clay-600/10 px-3 py-2 text-sm text-clay-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-earth-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : mode === 'signin' ? 'Log In' : `Create ${role} account`}
        </button>

        <p className="text-center text-xs text-earth-700/70">
          {mode === 'signin'
            ? 'Signing in loads whichever workspace your account last used — switch anytime from the account menu.'
            : 'Your account is created for real when a Supabase project is connected; otherwise this is a local demo session.'}
        </p>
      </form>
    </div>
  )
}
