'use client'

import { useState } from 'react'
import { Plus, ChevronUp, ChevronDown, Edit, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { StatusPill } from '@/components/ui/status-pill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toneOf, PHASE_STATUS_TONES } from '@/lib/design/tones'
import { label, PHASE_STATUS_LABELS } from '@/lib/design/labels'
import { phaseStatus } from '@/lib/validations/enums'
import { formatCurrency } from '@/lib/utils'
import { projectTotal, projectPaid, projectOutstanding } from '@/lib/utils/project-money'
import { PhaseForm } from './phase-form'
import type { ProjectPhase } from '@/lib/types/project'

/**
 * How a project actually gets billed: a מקדמה to start, then a phase at a time.
 *
 * Payment is a separate control from status on purpose. Approving a phase says
 * the client is happy with the work; it says nothing about whether they have
 * paid, and conflating the two is what made "revenue" mean "finished work".
 */
export function PhasesCard({
  projectId,
  phases,
  advanceAmount,
  advancePaidAt,
  onChanged,
}: {
  projectId: string
  phases: ProjectPhase[]
  advanceAmount: number | string | null
  advancePaidAt: string | null
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ProjectPhase | undefined>()

  const run = async (id: string, work: () => Promise<unknown>, success: string) => {
    setBusyId(id)
    try {
      await work()
      toast.success(success)
      onChanged()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בעדכון שלב')
    } finally {
      setBusyId(null)
    }
  }

  const total = projectTotal(advanceAmount, phases)
  const paid = projectPaid(advanceAmount, advancePaidAt, phases)
  const outstanding = projectOutstanding(phases)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>שלבים ותשלומים</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setShowForm(true)
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          הוסף שלב
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Advance */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-surface-subtle">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">מקדמה</span>
            <StatusPill tone={advancePaidAt ? 'success' : 'neutral'} dot>
              {advancePaidAt ? 'שולם' : 'לא שולם'}
            </StatusPill>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">{formatCurrency(advanceAmount)}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === 'advance' || advanceAmount == null}
              onClick={() =>
                run(
                  'advance',
                  () => api.put(`/projects/${projectId}`, { advancePaid: !advancePaidAt }),
                  advancePaidAt ? 'תשלום מקדמה בוטל' : 'מקדמה סומנה כשולמה'
                )
              }
            >
              {advancePaidAt ? 'בטל תשלום' : 'סמן כשולם'}
            </Button>
          </div>
        </div>

        {/* Phases */}
        {phases.length === 0 ? (
          <p className="text-sm text-content-subtle text-center py-6">אין שלבים עדיין</p>
        ) : (
          <div className="space-y-3">
            {phases.map((phase, index) => (
              <div
                key={phase.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      aria-label="הזז למעלה"
                      disabled={index === 0 || busyId === phase.id}
                      onClick={() =>
                        run(
                          phase.id,
                          () =>
                            api.put(`/projects/${projectId}/phases/${phase.id}`, { move: 'UP' }),
                          'סדר השלבים עודכן'
                        )
                      }
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      aria-label="הזז למטה"
                      disabled={index === phases.length - 1 || busyId === phase.id}
                      onClick={() =>
                        run(
                          phase.id,
                          () =>
                            api.put(`/projects/${projectId}/phases/${phase.id}`, { move: 'DOWN' }),
                          'סדר השלבים עודכן'
                        )
                      }
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>

                  <span className="text-sm font-medium truncate">{phase.name}</span>
                  <span className="text-sm text-content-subtle">{formatCurrency(phase.price)}</span>

                  {phase.paidAt && (
                    <StatusPill tone="success" dot>
                      שולם
                    </StatusPill>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* A Select, not a "next" button: PENDING_APPROVAL and
                      REVISIONS cycle, so there is no single next stage. */}
                  <Select
                    value={phase.status}
                    disabled={busyId === phase.id}
                    onValueChange={(next) =>
                      run(
                        phase.id,
                        () =>
                          api.put(`/projects/${projectId}/phases/${phase.id}`, { status: next }),
                        'סטטוס שלב עודכן'
                      )
                    }
                  >
                    <SelectTrigger className="w-auto gap-1" aria-label={`סטטוס ${phase.name}`}>
                      <SelectValue asChild>
                        <StatusPill tone={toneOf(PHASE_STATUS_TONES, phase.status)} dot interactive>
                          {label(PHASE_STATUS_LABELS, phase.status)}
                        </StatusPill>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {phaseStatus.options.map((value) => (
                        <SelectItem key={value} value={value}>
                          {label(PHASE_STATUS_LABELS, value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Only offered once the work is signed off - invoicing for
                      something the client has not approved is the wrong order. */}
                  {phase.status === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === phase.id}
                      onClick={() =>
                        run(
                          phase.id,
                          () =>
                            api.put(`/projects/${projectId}/phases/${phase.id}`, {
                              paid: !phase.paidAt,
                            }),
                          phase.paidAt ? 'תשלום בוטל' : 'שלב סומן כשולם'
                        )
                      }
                    >
                      {phase.paidAt ? 'בטל תשלום' : 'סמן כשולם'}
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`עריכת ${phase.name}`}
                    onClick={() => {
                      setEditing(phase)
                      setShowForm(true)
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label={`מחיקת ${phase.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>מחיקת שלב</AlertDialogTitle>
                        <AlertDialogDescription>
                          האם למחוק את {phase.name}? פעולה זו אינה ניתנת לביטול.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            run(
                              phase.id,
                              () => api.delete(`/projects/${projectId}/phases/${phase.id}`),
                              'שלב נמחק בהצלחה'
                            )
                          }
                        >
                          מחק
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="flex flex-wrap gap-6 pt-3 border-t text-sm">
          <div>
            <span className="text-content-muted">סה&quot;כ פרויקט: </span>
            <span className="font-medium">{formatCurrency(total)}</span>
          </div>
          <div>
            <span className="text-content-muted">שולם: </span>
            <span className="font-medium text-figure-paid">{formatCurrency(paid)}</span>
          </div>
          {outstanding > 0 && (
            <div>
              <span className="text-content-muted">ממתין לתשלום: </span>
              <span className="font-medium text-figure-due">{formatCurrency(outstanding)}</span>
            </div>
          )}
        </div>
      </CardContent>

      <PhaseForm
        projectId={projectId}
        phase={editing}
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={onChanged}
      />
    </Card>
  )
}
