import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * No CSP yet: the app still relies on inline styles from the UI library, and a
 * policy that has to allow 'unsafe-inline' buys little. The headers below are
 * the ones that cost nothing and are worth having.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

/**
 * The client portal, where the URL itself is the credential.
 *
 * `no-referrer` is the load-bearing one and overrides the global
 * strict-origin-when-cross-origin: the form token sits in the path, so any
 * outbound request from these pages - a signed attachment URL on Supabase, a
 * link the client taps, a third-party asset the page ever picks up - would
 * otherwise carry the whole token in its Referer header and hand someone
 * else's log a working key.
 *
 * noindex belongs here rather than in robots.txt: a Disallow rule is itself
 * public, advertises the prefix, and does not stop a crawler indexing a URL it
 * found linked somewhere else. X-Frame-Options: DENY already comes from the
 * global rule below, and is what stops the אישור button being clickjacked.
 */
const portalHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "no-store, must-revalidate" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // After the global rule, so these win on the keys they share.
      //
      // Only /r/. The portal reads through server components and answers a
      // quote through a Server Action, so it has no JSON API of its own to
      // cover. If one ever appears, add its prefix here at the same time.
      { source: "/r/:path*", headers: portalHeaders },
    ];
  },
};

export default nextConfig;
