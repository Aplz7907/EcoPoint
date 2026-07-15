import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Server Components and Route Handlers.
 *
 * Acts *as the signed-in user*: anon key + the session cookie, so RLS still
 * applies. This is what you want for anything the user is allowed to see.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // middleware.ts refreshes the session, so this is safe to swallow.
          }
        },
      },
    }
  );
}

/**
 * Supabase client with the SERVICE ROLE key. Bypasses RLS entirely.
 *
 * ⚠️  SERVER-ONLY. The `import 'server-only'` at the top of this file makes the
 *     build fail if a Client Component ever imports it.
 *
 * Only two things in this app are allowed to use it:
 *   1. POST /api/submit — to write the submission row and award points, after
 *      the *server* has decided how many points that is.
 *   2. Signed-URL generation for private images.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server-only).'
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Turns storage paths into short-lived signed URLs.
 *
 * The `submissions` bucket is private and has no user-facing storage policy, so
 * this is the only way an image is ever readable — and it happens server-side,
 * for paths we already know belong to the viewer. Nobody can enumerate the
 * bucket or guess another user's photo.
 */
export async function getSignedImageUrls(
  paths: string[],
  expiresInSeconds = 60 * 60
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from('submissions')
    .createSignedUrls(paths, expiresInSeconds);

  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) {
      urls.set(entry.path, entry.signedUrl);
    }
  }

  return urls;
}

/**
 * The signed-in user's profile, or null. Used by every protected page.
 */
export async function getProfile() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, points_balance, is_banned, created_at')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return { ...profile, email: user.email ?? null };
}
