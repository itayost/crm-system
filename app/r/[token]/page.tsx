import { prisma } from '@/lib/db/prisma'
import { PublicRequestForm } from '@/components/forms/public-request-form'

export const dynamic = 'force-dynamic'

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const client = await prisma.client.findFirst({
    where: { formToken: token },
    select: {
      id: true,
      name: true,
      projects: {
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!client) {
    return (
      <main dir="rtl" className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-content-strong">הקישור אינו תקין</h1>
          <p className="mt-2 text-content-muted">בדקו את הקישור או פנו אלינו ישירות.</p>
        </div>
      </main>
    )
  }

  return (
    <main dir="rtl" lang="he" className="mx-auto max-w-lg p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-content-strong">דיווח תקלה / בקשה — {client.name}</h1>
        <p className="mt-1 text-sm text-content-muted">מלאו את הטופס ונחזור אליכם בהקדם.</p>
      </header>
      <PublicRequestForm token={token} clientName={client.name} projects={client.projects} />
    </main>
  )
}
