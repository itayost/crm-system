/**
 * The portal had no loading state at all.
 *
 * Every page here is `force-dynamic` and does a database round trip before it
 * can render a byte, and the reader is on a phone on cellular. Without this the
 * gap between tapping a WhatsApp link and seeing anything is a blank screen of
 * unknown length - which reads as "broken", not as "loading". The console has
 * had a loading.tsx since the rebuild; this surface is the one that needed it
 * more.
 *
 * Shaped like the home page rather than a spinner, so the layout does not jump
 * when the real content lands.
 */
export default function PortalLoading() {
  return (
    <div className="flex flex-col gap-7" aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען…</span>

      <div className="flex flex-col gap-2.5">
        <div className="h-3 w-20 rounded-sm bg-surface-subtle" />
        <div className="h-7 w-3/4 rounded-sm bg-surface-subtle" />
        <div className="h-7 w-1/2 rounded-sm bg-surface-subtle" />
      </div>

      <div className="h-36 rounded-lg border bg-card" />

      <div className="flex flex-col gap-3">
        <div className="h-4 w-28 rounded-sm bg-surface-subtle" />
        <div className="h-28 rounded-lg border bg-card" />
      </div>
    </div>
  )
}
