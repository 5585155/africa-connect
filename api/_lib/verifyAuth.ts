import type { VercelRequest } from '@vercel/node'
import { getSupabaseAdmin } from './supabaseAdmin'

/**
 * Verifies the Supabase access token a client sent in `Authorization: Bearer
 * <token>` and returns the authenticated user's id. This is what makes
 * api/create-payment-attempt.ts a real server-side authority rather than
 * just another client write — the caller can't claim to be any buyer they
 * like, only the one their own session token actually belongs to.
 *
 * Returns null on any failure (missing header, invalid/expired token, admin
 * client not configured) — callers should respond 401 in that case.
 */
export async function verifyBearerToken(req: VercelRequest): Promise<{ userId: string; email: string | null } | null> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  return { userId: data.user.id, email: data.user.email ?? null }
}
