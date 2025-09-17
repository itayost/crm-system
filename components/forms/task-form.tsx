'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

const taskSchema = z.object({
  title: z.string().min(1, 'כותרת חובה'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  tags: z.array(z.string()).optional()
})

type TaskFormData = z.infer<typeof taskSchema>

interface TaskFormProps {
  task?: {
    id: string
    name: string
    description?: string
    priority: string
    status: string
    projectId?: string
    dueDate?: string
  }
  projects?: Array<{ id: string; name: string; type: string }>
  clients?: Array<{ id: string; name: string; company?: string }>
  onSubmit: (data: TaskFormData) => void
  onCancel: () => void
}

const priorityOptions = [
  { value: 'LOW', label: 'נמוכה' },
  { value: 'MEDIUM', label: 'בינונית' },
  { value: 'HIGH', label: 'גבוהה' },
  { value: 'URGENT', label: 'דחוף' }
]

export function TaskForm({ 
  task, 
  projects = [], 
  clients = [], 
  onSubmit, 
  onCancel 
}: TaskFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ? {
      title: task.name,
      description: task.description || '',
      priority: (task.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      projectId: task.projectId || '',
      clientId: undefined
    } : {
      priority: 'MEDIUM'
    }
  })

  const selectedProjectId = watch('projectId')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title */}
      <div>
        <Label htmlFor="title">כותרת המשימה *</Label>
        <Input 
          id="title" 
          {...register('title')}
          placeholder="הזן כותרת המשימה"
        />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">תיאור</Label>
        <Textarea 
          id="description" 
          {...register('description')}
          placeholder="תיאור המשימה (אופציונלי)"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Priority */}
        <div>
          <Label htmlFor="priority">עדיפות</Label>
          <Select 
            value={watch('priority') || 'MEDIUM'}
            onValueChange={(value) => setValue('priority', value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר עדיפות" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due Date */}
        <div>
          <Label htmlFor="dueDate">תאריך יעד</Label>
          <Input 
            id="dueDate" 
            type="date"
            {...register('dueDate')}
          />
        </div>

        {/* Project */}
        <div>
          <Label htmlFor="projectId">פרויקט</Label>
          <Select 
            value={watch('projectId') || 'none'}
            onValueChange={(value) => setValue('projectId', value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר פרויקט" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא פרויקט</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Client */}
        <div>
          <Label htmlFor="clientId">לקוח</Label>
          <Select 
            value={watch('clientId') || 'none'}
            onValueChange={(value) => setValue('clientId', value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר לקוח" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא לקוח</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name} {client.company && `- ${client.company}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          ביטול
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'שומר...' : task ? 'עדכן משימה' : 'צור משימה'}
        </Button>
      </div>
    </form>
  )
}