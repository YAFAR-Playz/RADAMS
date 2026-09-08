import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/reset-password", "/auth/callback"];
const NO_AUTO_REDIRECT_PATHS = ["/reset-password", "/auth/callback"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // A stale/already-rotated refresh token (racing tabs, a long-idle
  // session, etc.) makes getUser() throw an AuthApiError instead of
  // returning a clean "no user" result — confirmed happening in
  // production (Vercel runtime errors: "Invalid Refresh Token: Refresh
  // Token Not Found" at /middleware, affecting multiple users over time).
  // Left uncaught, that crashes this request instead of just treating it
  // as logged-out, which is what a broken session actually is — the
  // crash is what shows up to the user as being abruptly logged out or a
  // page/action suddenly failing outright rather than a clean redirect to
  // /login. Signing out clears the bad cookies so the next request
  // doesn't immediately hit the same throw again.
  let isAuthed = false;
  try {
    const { data } = await supabase.auth.getUser();
    isAuthed = !!data.user;
  } catch {
    await supabase.auth.signOut();
    isAuthed = false;
  }
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthed && isPublic && !NO_AUTO_REDIRECT_PATHS.includes(path)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // /icon is the dynamic branded favicon (src/app/icon.tsx) — it must be
  // fetchable by every browser tab regardless of auth state, same as the
  // static favicon.ico it sits alongside, or the login page's tab loses
  // its icon entirely (redirected to /login instead of the image).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
