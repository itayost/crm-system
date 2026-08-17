'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

const clientFormSchema = z.object({
  name: z.string().min(1, 'שם עסק חובה'),
  isVip: z.boolean().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  isInternal: z.boolean().optional(),
})

type ClientFormValues = z.input<typeof clientFormSchema>

interface Client {
  id: string
  name: string
  isVip?: boolean
  address?: string | null
  taxId?: string | null
  notes?: string | null
  isInternal?: boolean
}

interface ClientFormProps {
  client?: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ClientForm({
  client,
  open,
  onOpenChange,
  onSuccess,
}: ClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!client

  const buildDefaults = (): ClientFormValues => ({
    name: client?.name ?? '',
    isVip: client?.isVip ?? false,
    address: client?.address ?? '',
    taxId: client?.taxId ?? '',
    notes: client?.notes ?? '',
    isInternal: client?.isInternal ?? false,
  })

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: buildDefaults(),
  })

  // Keyed on the record's id, not the record object.
  //
  // With `[open, record]` this effect re-ran whenever the parent page refetched
  // and handed down a new object with the same contents - which silently reset
  // the form and threw away whatever had been typed into it. It reproduced as
  // "the edit dialog saved, the toast said so, and nothing changed", because
  // the reset restored the old values just before submit read them.
  //
  // The id still gives the original guarantee: opening the dialog for a
  // different row shows that row rather than the previous one.
  // The dialog stays mounted, so useForm's defaults are only read once.
  // Without this, opening it for a different row shows the previous one.
  useEffect(() => {
    if (open) form.reset(buildDefaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id])

  const handleSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...values,
        address: values.address || undefined,
        taxId: values.taxId || undefined,
        notes: values.notes || undefined,
      }

      if (isEditing) {
        await api.put(`/clients/${client.id}`, payload)
        toast.success('לקוח עודכן בהצלחה')
      } else {
        await api.post('/clients', payload)
        toast.success('לקוח נוצר בהצלחה')
      }

      onSuccess()
      onOpenChange(false)
      form.reset(buildDefaults())
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת לקוח')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'עריכת לקוח' : 'לקוח חדש'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'ערוך את פרטי העסק' : 'הזן את פרטי העסק החדש'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם עסק *</FormLabel>
                  <FormControl>
                    <Input placeholder="שם העסק" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כתובת</FormLabel>
                  <FormControl>
                    <Input placeholder="כתובת מלאה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ח.פ / ע.מ</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר עוסק" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea placeholder="הערות על העסק..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isVip"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-sm">לקוח VIP</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isInternal"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-sm">עסק פנימי</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'שומר...' : isEditing ? 'עדכן' : 'צור לקוח'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ביטול
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
