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

const NO_CLIENT = 'none'

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
  estimatedBudget: z.string().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
  clientId: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
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
  clientId?: string | null
  role?: string | null
  isPrimary?: boolean
}

interface ClientOption {
  id: string
  name: string
}

interface ContactFormProps {
  contact?: Contact
  defaultClientId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ContactForm({
  contact,
  defaultClientId,
  open,
  onOpenChange,
  onSuccess,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const isEditing = !!contact

  const buildDefaults = (): ContactFormValues => ({
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
    clientId: contact?.clientId ?? defaultClientId ?? NO_CLIENT,
    role: contact?.role ?? '',
    isPrimary: contact?.isPrimary ?? false,
  })

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: buildDefaults(),
  })

  // The dialog stays mounted, so useForm's defaults are only read once.
  // Without this, opening it for a different row shows the previous one.
  useEffect(() => {
    if (open) form.reset(buildDefaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact])

  const selectedClientId = form.watch('clientId')
  const hasClient = !!selectedClientId && selectedClientId !== NO_CLIENT

  // Load businesses so a contact can be attached to one
  useEffect(() => {
    if (!open) return
    const fetchClients = async () => {
      try {
        const response = await api.get('/clients')
        setClients(response.data)
      } catch {
        setClients([])
      }
    }
    fetchClients()
  }, [open])

  const handleSubmit = async (values: ContactFormValues) => {
    setIsSubmitting(true)
    try {
      const budgetNum = values.estimatedBudget ? Number(values.estimatedBudget) : undefined
      const clientId =
        values.clientId && values.clientId !== NO_CLIENT ? values.clientId : undefined
      const payload = {
        ...values,
        email: values.email || undefined,
        company: values.company || undefined,
        estimatedBudget: budgetNum && !isNaN(budgetNum) ? budgetNum : undefined,
        projectType: values.projectType || undefined,
        notes: values.notes || undefined,
        clientId,
        role: clientId ? values.role || undefined : undefined,
        isPrimary: clientId ? values.isPrimary : undefined,
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
      form.reset(buildDefaults())
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת איש קשר')
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

            {/* Business membership */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-content-body mb-3">
                שיוך לעסק (לקוח)
              </p>
            </div>

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עסק</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? NO_CLIENT}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ללא" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CLIENT}>ללא</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasClient && (
              <>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>תפקיד בעסק</FormLabel>
                      <FormControl>
                        <Input placeholder="למשל: בעלים, מנהל פרויקט" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm">איש קשר ראשי</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
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
