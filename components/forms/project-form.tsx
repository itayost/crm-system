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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TYPE_OPTIONS = [
  { value: 'LANDING_PAGE', label: 'דף נחיתה' },
  { value: 'WEBSITE', label: 'אתר' },
  { value: 'ECOMMERCE', label: 'חנות אונליין' },
  { value: 'WEB_APP', label: 'אפליקציית ווב' },
  { value: 'MOBILE_APP', label: 'אפליקציה' },
  { value: 'MANAGEMENT_SYSTEM', label: 'מערכת ניהול' },
  { value: 'CONSULTATION', label: 'ייעוץ' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'נמוך' },
  { value: 'MEDIUM', label: 'בינוני' },
  { value: 'HIGH', label: 'גבוה' },
  { value: 'URGENT', label: 'דחוף' },
] as const

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'חודשי' },
  { value: 'YEARLY', label: 'שנתי' },
] as const

const projectFormSchema = z.object({
  name: z.string().min(1, 'שם פרויקט חובה'),
  description: z.string().optional(),
  type: z.enum([
    'LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP',
    'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  price: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === '') return undefined
      const num = Number(v)
      return isNaN(num) ? undefined : num
    }),
  retention: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === '') return undefined
      const num = Number(v)
      return isNaN(num) ? undefined : num
    }),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).optional(),
  contactId: z.string().min(1, 'לקוח חובה'),
})

type ProjectFormValues = z.input<typeof projectFormSchema>

interface Project {
  id: string
  name: string
  description?: string | null
  type: string
  priority: string
  startDate?: string | null
  deadline?: string | null
  price?: number | string | null
  retention?: number | string | null
  retentionFrequency?: string | null
  contactId: string
}

interface ClientContact {
  id: string
  name: string
  company?: string | null
}

interface ProjectFormProps {
  project?: Project
  defaultContactId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProjectForm({
  project,
  defaultContactId,
  open,
  onOpenChange,
  onSuccess,
}: ProjectFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clients, setClients] = useState<ClientContact[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const isEditing = !!project

  const toDateInputValue = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      type: (project?.type as ProjectFormValues['type']) ?? 'WEBSITE',
      priority: (project?.priority as ProjectFormValues['priority']) ?? 'MEDIUM',
      startDate: toDateInputValue(project?.startDate),
      deadline: toDateInputValue(project?.deadline),
      price: project?.price != null ? String(project.price) : '',
      retention: project?.retention != null ? String(project.retention) : '',
      retentionFrequency:
        (project?.retentionFrequency as ProjectFormValues['retentionFrequency']) ??
        undefined,
      contactId: project?.contactId ?? defaultContactId ?? '',
    },
  })

  const retentionValue = form.watch('retention')
  const hasRetention = retentionValue != null && retentionValue !== '' && retentionValue !== '0'

  // Fetch client contacts for the select
  useEffect(() => {
    if (!open) return
    const fetchClients = async () => {
      setLoadingClients(true)
      try {
        const response = await api.get('/contacts?phase=client')
        setClients(response.data)
      } catch {
        toast.error('שגיאה בטעינת לקוחות')
      } finally {
        setLoadingClients(false)
      }
    }
    fetchClients()
  }, [open])

  const handleSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...values,
        description: values.description || undefined,
        startDate: values.startDate
          ? new Date(values.startDate).toISOString()
          : undefined,
        deadline: values.deadline
          ? new Date(values.deadline).toISOString()
          : undefined,
        retentionFrequency: hasRetention
          ? values.retentionFrequency || 'MONTHLY'
          : undefined,
      }

      if (isEditing) {
        const { contactId: _contactId, ...updatePayload } = payload
        await api.put(`/projects/${project.id}`, updatePayload)
        toast.success('פרויקט עודכן בהצלחה')
      } else {
        await api.post('/projects', payload)
        toast.success('פרויקט נוצר בהצלחה')
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(
        axiosError.response?.data?.error ?? 'שגיאה בשמירת פרויקט'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'עריכת פרויקט' : 'פרויקט חדש'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'ערוך את פרטי הפרויקט'
              : 'הזן את פרטי הפרויקט החדש'}
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
                  <FormLabel>שם פרויקט *</FormLabel>
                  <FormControl>
                    <Input placeholder="שם הפרויקט" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="תיאור הפרויקט..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>סוג *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוג" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((option) => (
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

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>עדיפות</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר עדיפות" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
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
            </div>

            {/* Contact (Client) */}
            {!isEditing && (
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>לקוח *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingClients ? 'טוען...' : 'בחר לקוח'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                            {client.company ? ` (${client.company})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך התחלה</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Deadline */}
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>דדליין</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Price */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מחיר (₪)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Retention */}
            <FormField
              control={form.control}
              name="retention"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ריטיינר (₪)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Retention Frequency (only shown if retention > 0) */}
            {hasRetention && (
              <FormField
                control={form.control}
                name="retentionFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תדירות ריטיינר</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? 'MONTHLY'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תדירות" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((option) => (
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
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting
                  ? 'שומר...'
                  : isEditing
                    ? 'עדכן'
                    : 'צור פרויקט'}
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
