'use client'

/**
 * One link per attached file. A WhatsApp request can arrive with a voice note
 * and a screenshot together, so linking only the first file would hide the rest.
 */
export function AttachmentLinks({
  attachments,
  onOpen,
  className = '',
}: {
  attachments: string[]
  onOpen: (path: string) => void
  className?: string
}) {
  if (!attachments?.length) return null

  return (
    <>
      {attachments.map((path, index) => (
        <button
          key={path}
          type="button"
          className={`text-xs text-link underline ${className}`}
          onClick={(e) => {
            e.stopPropagation()
            onOpen(path)
          }}
        >
          {attachments.length > 1 ? `קובץ ${index + 1}` : 'צפייה בקובץ'}
        </button>
      ))}
    </>
  )
}
