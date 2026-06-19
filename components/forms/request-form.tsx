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
  { value: 'REQUEST', label: 'בקשה' },
  { value: 'BUG', label: 'תקלה' },
  { value: 'IMPROVEMENT', label: 'שיפור' },
  { value: 'QUESTION', label: 'שאלה' },
  { value: 'OTHER', label: 'אחר' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'נמוך' },
  { value: 'MEDIUM', label: 'בינוני' },
  { value: 'HIGH', label: 'גבוה' },
  { value: 'URGENT', label: 'דחוף' },
] as const

const NO_PROJECT = 'none'

const requestFormSchema = z.object({
  title: z.string().min(1, 'כותרת בקשה חובה'),
  description: z.string().optional(),
  type: z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  clientId: z.string().min(1, 'לקוח חובה'),
  projectId: z.string().optional(),
})

type RequestFormValues = z.input<typeof requestFormSchema>

interface RequestRecord {
  id: string
  title: string
  description?: string | null
  type: string
  priority: string
  clientId: string
  projectId?: string | null
}

interface Option {
  id: string
  name: string
}

interface RequestFormProps {
  request?: RequestRecord
  defaultClientId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RequestForm({
  request,
  defaultClientId,
  open,
  onOpenChange,
  onSuccess,
}: RequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clients, setClients] = useState<Option[]>([])
  const [projects, setProjects] = useState<Option[]>([])
  const isEditing = !!request

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      title: request?.title ?? '',
      description: request?.description ?? '',
      type: (request?.type as RequestFormValues['type']) ?? 'REQUEST',
      priority: (request?.priority as RequestFormValues['priority']) ?? 'MEDIUM',
      clientId: request?.clientId ?? defaultClientId ?? '',
      projectId: request?.projectId ?? NO_PROJECT,
    },
  })

  const selectedClientId = form.watch('clientId')

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

  // Projects belong to a client — scope the project options to the chosen client
  useEffect(() => {
    if (!open || !selectedClientId) {
      setProjects([])
      return
    }
    const fetchProjects = async () => {
      try {
        const response = await api.get(`/projects?clientId=${selectedClientId}`)
        setProjects(response.data)
      } catch {
        setProjects([])
      }
    }
    fetchProjects()
  }, [open, selectedClientId])

  const handleSubmit = async (values: RequestFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        priority: values.priority,
        clientId: values.clientId,
        projectId:
          values.projectId && values.projectId !== NO_PROJECT
            ? values.projectId
            : undefined,
      }

      if (isEditing) {
        const { clientId: _clientId, ...updatePayload } = payload
        void _clientId
        await api.put(`/requests/${request.id}`, updatePayload)
        toast.success('בקשה עודכנה בהצלחה')
      } else {
        await api.post('/requests', payload)
        toast.success('בקשה נוצרה בהצלחה')
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת בקשה')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'עריכת בקשה' : 'בקשה חדשה'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'ערוך את פרטי הבקשה' : 'הזן את פרטי הבקשה החדשה'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת *</FormLabel>
                  <FormControl>
                    <Input placeholder="מה הלקוח ביקש" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור</FormLabel>
                  <FormControl>
                    <Textarea placeholder="פירוט הבקשה..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>סוג</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>עדיפות</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            {!isEditing && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>לקוח *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר לקוח" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            )}

            {projects.length > 0 && (
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>פרויקט (אופציונלי)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? NO_PROJECT}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="ללא פרויקט" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PROJECT}>ללא פרויקט</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'שומר...' : isEditing ? 'עדכן' : 'צור בקשה'}
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
