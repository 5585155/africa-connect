import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

export default function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-earth-700">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-earth-800/10 text-2xl">
          🔒
        </div>
        <p className="mt-4">Loading your session…</p>
      </div>
    )
  }

  if (!user || user.role !== role) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-earth-800/10 text-2xl">
          🔒
        </div>
        <h1 className="mt-4 text-2xl font-bold text-earth-950">Sign in required</h1>
        <p className="mt-2 text-earth-700">
          {user
            ? `This page is only available to ${role} accounts.`
            : `Log in or create a ${role} account to view this page.`}
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-block rounded-xl bg-earth-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-700"
        >
          Go to Sign In
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
