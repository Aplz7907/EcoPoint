import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Pages that a signed-out visitor is allowed to see. */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/auth'];

/** Pages that make no sense once you are already signed in. */
const SIGNED_IN_REDIRECTS = ['/login', '/register', '/forgot-password'];

/**
 * Refreshes the Supabase session cookie on every request (tokens are short-lived)
 * and bounces signed-out users to /login.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: this call is what actually refreshes the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // API routes answer with their own 401 JSON; never redirect them to an HTML
  // login page, or fetch() callers would silently get a 200 + login markup.
  const isApi = pathname.startsWith('/api/');

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // /reset-password is deliberately NOT in this list: you arrive there *with* a
  // session (the recovery link creates one) and still need to see the form.
  if (user && SIGNED_IN_REDIRECTS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
