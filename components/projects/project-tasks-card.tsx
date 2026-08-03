'use client'

import { useRouter } from 'next/navigation'
import { Plus, CheckSquare } from 'lucide-react'
import { StatusPill } from '@/components/ui/status-pill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toneOf, emphasisOf, TASK_STATUS_TONES, PRIORITY_TONES, PRIORITY_EMPHASIS } from '@/lib/design/tones'
import { label, TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/design/labels'
import { formatDate } from '@/lib/utils'
import type { ProjectTask } from '@/lib/types/project'

export function ProjectTasksCard({
  tasks,
  onAdd,
}: {
  tasks: ProjectTask[]
  onAdd: () => void
}) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>משימות</CardTitle>
        <Button size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 ml-2" />
          משימה חדשה
        </Button>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-content-subtle text-center py-6">אין משימות עדיין</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-subtle cursor-pointer transition-colors"
                onClick={() => router.push('/tasks')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push('/tasks')
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <CheckSquare
                    className={`w-4 h-4 ${
                      task.status === 'COMPLETED' ? 'text-tone-success-mark' : 'text-content-faint'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      task.status === 'COMPLETED' ? 'line-through text-content-faint' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                  <StatusPill tone={toneOf(TASK_STATUS_TONES, task.status)} dot>
                    {label(TASK_STATUS_LABELS, task.status)}
                  </StatusPill>
                </div>
                <div className="flex items-center gap-3 text-sm text-content-subtle">
                  <StatusPill
                    tone={toneOf(PRIORITY_TONES, task.priority)}
                    emphasis={emphasisOf(PRIORITY_EMPHASIS, task.priority)}
                  >
                    {label(PRIORITY_LABELS, task.priority)}
                  </StatusPill>
                  {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
