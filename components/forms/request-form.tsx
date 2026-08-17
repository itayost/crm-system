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
import { requestType, priority } from '@/lib/validations/enums'
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/design/labels'
import type { RequestRecord } from '@/lib/types/request'

const TYPE_OPTIONS = Object.entries(REQUEST_TYPE_LABELS)
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS)

const NO_PROJECT = 'none'

const requestFormSchema = z.object({
  title: z.string().min(1, 'כותרת פניה חובה'),
  description: z.string().optional(),
  type: requestType,
  priority: priority,
  clientId: z.string().min(1, 'לקוח חובה'),
  projectId: z.string().optional(),
})

type RequestFormValues = z.input<typeof requestFormSchema>

type RequestFormRecord = Pick<
  RequestRecord,
  'id' | 'title' | 'description' | 'type' | 'priority' | 'clientId' | 'projectId'
>

interface Option {
  id: string
  name: string
}

interface RequestFormProps {
  request?: RequestFormRecord
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

  const buildDefaults = (): RequestFormValues => ({
    title: request?.title ?? '',
    description: request?.description ?? '',
    type: request?.type ?? 'REQUEST',
    priority: request?.priority ?? 'MEDIUM',
    clientId: request?.clientId ?? defaultClientId ?? '',
    projectId: request?.projectId ?? NO_PROJECT,
  })

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
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
  }, [open, request?.id])

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
        toast.success('הפניה עודכנה בהצלחה')
      } else {
        await api.post('/requests', payload)
        toast.success('הפניה נוצרה בהצלחה')
      }

      onSuccess()
      onOpenChange(false)
      form.reset(buildDefaults())
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת הפניה')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'עריכת פניה' : 'פניה חדשה'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'ערוך את פרטי הפניה' : 'הזן את פרטי הפניה החדשה'}
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
                        {TYPE_OPTIONS.map(([value, optionLabel]) => (
                          <SelectItem key={value} value={value}>
                            {optionLabel}
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
                        {PRIORITY_OPTIONS.map(([value, optionLabel]) => (
                          <SelectItem key={value} value={value}>
                            {optionLabel}
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
                {isSubmitting ? 'שומר...' : isEditing ? 'עדכן' : 'צור פניה'}
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
