import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Runs on every request. Responsible for three things only:
 *  1. Strict security headers (CSP, HSTS, frame/content-type protection)
 *  2. CSRF double-submit cookie check on state-changing requests
 *  3. IP-based rate limiting on API + auth routes
 *
 * Business logic (auth, validation) stays in the route handlers —
 * this file should never grow request-specific branches beyond routing.
 */

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next.js style injection in dev;
  // in strict production builds, replace with a nonce-based policy.
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.stripe.com",
  "connect-src 'self' https://api.stripe.com https://api.groq.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Webhook routes verify authenticity via provider signatures, not cookies,
// so they are exempt from the CSRF double-submit check. WhatsApp no longer
// has a webhook route here — see whatsapp-bot/bot.ts — so only Stripe remains.
const CSRF_EXEMPT_PATHS = ["/api/webhooks/stripe"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // ── 1. Security headers ──────────────────────────────────────
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-DNS-Prefetch-Control", "off");

  // ── 2. CSRF double-submit cookie check ───────────────────────
  if (
    pathname.startsWith("/api") &&
    STATE_CHANGING_METHODS.has(req.method) &&
    !CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p))
  ) {
    const cookieToken = req.cookies.get("csrf_token")?.value;
    const headerToken = req.headers.get("x-csrf-token");

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
  }

  // ── 3. Rate limiting on API + auth routes ────────────────────
  if (pathname.startsWith("/api")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "anonymous";

    // Auth and payment endpoints get a much tighter budget than
    // general read endpoints — brute force / abuse surfaces.
    const isSensitive =
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/reservations") ||
      pathname.startsWith("/api/ai/concierge");

    const { success, remaining, limit } = await checkRateLimit(
      `${ip}:${isSensitive ? "sensitive" : "standard"}`,
      isSensitive ? "sensitive" : "standard"
    );

    res.headers.set("X-RateLimit-Limit", String(limit));
    res.headers.set("X-RateLimit-Remaining", String(remaining));

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: res.headers }
      );
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, images, and _next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)",
  ],
};
