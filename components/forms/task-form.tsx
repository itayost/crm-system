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

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'נמוך' },
  { value: 'MEDIUM', label: 'בינוני' },
  { value: 'HIGH', label: 'גבוה' },
  { value: 'URGENT', label: 'דחוף' },
] as const

const taskFormSchema = z.object({
  title: z.string().min(1, 'כותרת משימה חובה'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
})

type TaskFormValues = z.input<typeof taskFormSchema>

interface Task {
  id: string
  title: string
  description?: string | null
  priority: string
  dueDate?: string | null
  projectId?: string | null
}

interface ProjectOption {
  id: string
  name: string
}

interface TaskFormProps {
  task?: Task
  defaultProjectId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TaskForm({
  task,
  defaultProjectId,
  open,
  onOpenChange,
  onSuccess,
}: TaskFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const isEditing = !!task

  const toDateInputValue = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: (task?.priority as TaskFormValues['priority']) ?? 'MEDIUM',
      dueDate: toDateInputValue(task?.dueDate),
      projectId: task?.projectId ?? defaultProjectId ?? '',
    },
  })

  // Fetch projects for the select
  useEffect(() => {
    if (!open) return
    const fetchProjects = async () => {
      setLoadingProjects(true)
      try {
        const response = await api.get('/projects')
        setProjects(
          response.data.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }))
        )
      } catch {
        // Projects list is optional, don't show error
      } finally {
        setLoadingProjects(false)
      }
    }
    fetchProjects()
  }, [open])

  const handleSubmit = async (values: TaskFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...values,
        description: values.description || undefined,
        dueDate: values.dueDate
          ? new Date(values.dueDate).toISOString()
          : undefined,
        projectId: values.projectId || undefined,
      }

      if (isEditing) {
        await api.put(`/tasks/${task.id}`, payload)
        toast.success('משימה עודכנה בהצלחה')
      } else {
        await api.post('/tasks', payload)
        toast.success('משימה נוצרה בהצלחה')
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(
        axiosError.response?.data?.error ?? 'שגיאה בשמירת משימה'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'עריכת משימה' : 'משימה חדשה'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'ערוך את פרטי המשימה'
              : 'הזן את פרטי המשימה החדשה'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת *</FormLabel>
                  <FormControl>
                    <Input placeholder="כותרת המשימה" {...field} />
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
                      placeholder="תיאור המשימה..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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

              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך יעד</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Project */}
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>פרויקט (אופציונלי)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingProjects ? 'טוען...' : 'ללא פרויקט'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">ללא פרויקט</SelectItem>
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

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting
                  ? 'שומר...'
                  : isEditing
                    ? 'עדכן'
                    : 'צור משימה'}
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
