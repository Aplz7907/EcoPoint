import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Where the email magic link and the password-recovery link land. Trades the
 * `code` in the URL for a session cookie, then forwards to the page the user
 * was headed to.
 *
 * This is a generic PKCE code exchange, so it would also serve an OAuth
 * provider unchanged if one is ever switched on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Only ever redirect to a path on this site — never to an attacker's URL.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
