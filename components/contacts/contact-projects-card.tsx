'use client'

import { useRouter } from 'next/navigation'
import { Plus, Briefcase } from 'lucide-react'
import { StatusPill } from '@/components/ui/status-pill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toneOf, PROJECT_STATUS_TONES } from '@/lib/design/tones'
import { label, PROJECT_STATUS_LABELS } from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { projectTotal } from '@/lib/money/project'
import type { ContactProject } from '@/lib/types/contact'

/**
 * Shown for anyone attached to a business, not only status CLIENT - an
 * INACTIVE client's projects are exactly what you want to see when working out
 * whether to chase them again.
 */
export function ContactProjectsCard({
  clientId,
  projects,
}: {
  clientId: string
  projects: ContactProject[]
}) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>פרויקטים</CardTitle>
        <Button
          size="sm"
          onClick={() => router.push(`/projects?new=true&clientId=${clientId}`)}
        >
          <Plus className="w-4 h-4" />
          פרויקט חדש
        </Button>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-content-subtle text-center py-6">אין פרויקטים עדיין</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-subtle cursor-pointer transition-colors"
                onClick={() => router.push(`/projects/${project.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/projects/${project.id}`)
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-content-faint" />
                  <span className="text-sm font-medium">{project.name}</span>
                  <StatusPill tone={toneOf(PROJECT_STATUS_TONES, project.status)} dot>
                    {label(PROJECT_STATUS_LABELS, project.status)}
                  </StatusPill>
                </div>
                <div className="flex items-center gap-4 text-sm text-content-subtle">
                  <span>{formatCurrency(projectTotal(project.advanceAmount, project.phases))}</span>
                  {project.deadline && <span>{formatDate(project.deadline)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
