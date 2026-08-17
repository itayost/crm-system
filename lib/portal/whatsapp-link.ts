/**
 * The business WhatsApp number as a wa.me link, or nothing.
 *
 * Read server-side per render rather than baked into a NEXT_PUBLIC_ var: the
 * portal pages are force-dynamic, so there is nothing to gain from build-time
 * inlining, and the number stays out of the client bundle for every other page
 * in the app.
 *
 * Lifted out of the request detail page because the footer now offers it on
 * every portal page - a client who needs to reach a human should not have to
 * find the one screen that happened to carry the link.
 */
export function whatsappLink(): string | null {
  const raw = (process.env.OWNER_PHONE ?? '').replace(/\D/g, '')
  if (!raw) return null

  const international = raw.startsWith('0') ? `972${raw.slice(1)}` : raw
  return `https://wa.me/${international}`
}
