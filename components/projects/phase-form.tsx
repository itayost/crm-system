'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { ProjectPhase } from '@/lib/types/project'

// Price is a string in the form and coerced on submit, matching project-form:
// a number input bound to a number makes clearing the field impossible.
const phaseFormSchema = z.object({
  name: z.string().min(1, 'שם שלב חובה'),
  price: z.string().optional(),
})

type PhaseFormValues = z.infer<typeof phaseFormSchema>

export function PhaseForm({
  projectId,
  phase,
  open,
  onOpenChange,
  onSuccess,
}: {
  projectId: string
  phase?: ProjectPhase
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!phase

  const form = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseFormSchema),
    defaultValues: { name: '', price: '' },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: phase?.name ?? '',
      price: phase?.price != null ? String(phase.price) : '',
    })
  }, [open, phase, form])

  const handleSubmit = async (values: PhaseFormValues) => {
    setIsSubmitting(true)
    try {
      // Zero is a real price, so an empty field means zero rather than "skip".
      const priceNum = values.price ? Number(values.price) : 0
      const payload = { name: values.name, price: Number.isNaN(priceNum) ? 0 : priceNum }

      if (isEditing) {
        await api.put(`/projects/${projectId}/phases/${phase.id}`, payload)
        toast.success('שלב עודכן בהצלחה')
      } else {
        await api.post(`/projects/${projectId}/phases`, payload)
        toast.success('שלב נוסף בהצלחה')
      }

      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת שלב')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'עריכת שלב' : 'שלב חדש'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם שלב</FormLabel>
                  <FormControl>
                    <Input placeholder="למשל: אפיון, עיצוב, פיתוח" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מחיר (₪)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'שומר...' : isEditing ? 'שמירה' : 'הוספה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
