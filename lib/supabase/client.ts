import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components ("use client").
 *
 * Uses the anon key only. Every query it makes is filtered by RLS, so the worst
 * a hostile browser can do with it is read its own rows.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
