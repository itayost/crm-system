// components/forms/payment-form.tsx
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
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'

const paymentSchema = z.object({
  clientId: z.string().min(1, 'לקוח חובה'),
  projectId: z.string().optional(),
  amount: z.number().min(1, 'סכום חייב להיות גדול מ-0'),
  type: z.enum(['PROJECT', 'MAINTENANCE', 'CONSULTATION', 'OTHER']),
  dueDate: z.string().min(1, 'תאריך חובה'),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
})

export type PaymentFormData = z.infer<typeof paymentSchema>

interface PaymentFormProps {
  onSubmit: (data: PaymentFormData) => void
  clients: Array<{ id: string; name: string; company?: string }>
  projects?: Array<{ id: string; name: string; type: string }>
  isLoading?: boolean
  defaultValues?: Partial<PaymentFormData>
}

export function PaymentForm({ 
  onSubmit, 
  clients, 
  projects = [], 
  isLoading = false,
  defaultValues 
}: PaymentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      type: 'PROJECT',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      ...defaultValues,
    },
  })

  const _selectedType = watch('type')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">לקוח *</Label>
          <Select 
            value={watch('clientId')} 
            onValueChange={(value) => setValue('clientId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר לקוח" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name} {client.company && `(${client.company})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.clientId && (
            <p className="text-red-500 text-sm">{errors.clientId.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="projectId">פרויקט</Label>
          <Select 
            value={watch('projectId') || 'none'} 
            onValueChange={(value) => setValue('projectId', value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר פרויקט (אופציונלי)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא פרויקט</SelectItem>
              {projects?.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="amount">סכום *</Label>
          <Input 
            type="number" 
            placeholder="0.00"
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && (
            <p className="text-red-500 text-sm">{errors.amount.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="type">סוג תשלום *</Label>
          <Select 
            value={watch('type')} 
            onValueChange={(value) => setValue('type', value as 'PROJECT' | 'MAINTENANCE' | 'CONSULTATION' | 'OTHER')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PROJECT">פרויקט</SelectItem>
              <SelectItem value="MAINTENANCE">אחזקה</SelectItem>
              <SelectItem value="CONSULTATION">ייעוץ</SelectItem>
              <SelectItem value="OTHER">אחר</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="dueDate">תאריך לתשלום *</Label>
          <Input 
            type="date" 
            {...register('dueDate')}
          />
          {errors.dueDate && (
            <p className="text-red-500 text-sm">{errors.dueDate.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">מספר חשבונית</Label>
          <Input 
            placeholder="2024-XXX"
            {...register('invoiceNumber')}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">הערות</Label>
        <Textarea 
          placeholder="הערות נוספות..."
          {...register('notes')}
          rows={3}
        />
      </div>
      
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              שומר...
            </>
          ) : (
            'שמור תשלום'
          )}
        </Button>
      </div>
    </form>
  )
}