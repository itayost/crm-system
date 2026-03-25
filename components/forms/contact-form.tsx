'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

const SOURCE_OPTIONS = [
  { value: 'WEBSITE', label: 'אתר' },
  { value: 'PHONE', label: 'טלפון' },
  { value: 'WHATSAPP', label: 'וואטסאפ' },
  { value: 'REFERRAL', label: 'הפניה' },
  { value: 'OTHER', label: 'אחר' },
] as const

const contactFormSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  phone: z
    .string()
    .min(9, 'טלפון חובה')
    .regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין'),
  email: z
    .string()
    .email('אימייל לא תקין')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']),
  estimatedBudget: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === '') return undefined
      const num = Number(v)
      return isNaN(num) ? undefined : num
    }),
  projectType: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
})

type ContactFormValues = z.input<typeof contactFormSchema>

interface Contact {
  id: string
  name: string
  phone: string
  email?: string | null
  company?: string | null
  source: string
  status: string
  estimatedBudget?: number | string | null
  projectType?: string | null
  notes?: string | null
  isVip?: boolean
  address?: string | null
  taxId?: string | null
}

interface ContactFormProps {
  contact?: Contact
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ContactForm({
  contact,
  open,
  onOpenChange,
  onSuccess,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!contact
  const isClient = contact?.status === 'CLIENT'

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
      email: contact?.email ?? '',
      company: contact?.company ?? '',
      source: (contact?.source as ContactFormValues['source']) ?? 'PHONE',
      estimatedBudget: contact?.estimatedBudget != null
        ? String(contact.estimatedBudget)
        : '',
      projectType: contact?.projectType ?? '',
      notes: contact?.notes ?? '',
      isVip: contact?.isVip ?? false,
      address: contact?.address ?? '',
      taxId: contact?.taxId ?? '',
    },
  })

  const handleSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...values,
        email: values.email || undefined,
        company: values.company || undefined,
        projectType: values.projectType || undefined,
        notes: values.notes || undefined,
        address: values.address || undefined,
        taxId: values.taxId || undefined,
      }

      if (isEditing) {
        await api.put(`/contacts/${contact.id}`, payload)
        toast.success('איש קשר עודכן בהצלחה')
      } else {
        await api.post('/contacts', payload)
        toast.success('איש קשר נוצר בהצלחה')
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'שגיאה בשמירת איש קשר'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'עריכת איש קשר' : 'איש קשר חדש'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'ערוך את פרטי איש הקשר'
              : 'הזן את פרטי איש הקשר החדש'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם *</FormLabel>
                  <FormControl>
                    <Input placeholder="שם מלא" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>טלפון *</FormLabel>
                  <FormControl>
                    <Input placeholder="050-1234567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אימייל</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="example@email.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company */}
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>חברה</FormLabel>
                  <FormControl>
                    <Input placeholder="שם החברה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Source */}
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מקור</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר מקור" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Estimated Budget */}
            <FormField
              control={form.control}
              name="estimatedBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תקציב משוער</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Project Type */}
            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג פרויקט</FormLabel>
                  <FormControl>
                    <Input placeholder="למשל: אתר, אפליקציה..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות נוספות..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client-only fields */}
            {isClient && (
              <>
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    פרטי לקוח
                  </p>
                </div>

                {/* VIP */}
                <FormField
                  control={form.control}
                  name="isVip"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm">לקוח VIP</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Address */}
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

                {/* Tax ID */}
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
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting
                  ? 'שומר...'
                  : isEditing
                    ? 'עדכן'
                    : 'צור איש קשר'}
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
