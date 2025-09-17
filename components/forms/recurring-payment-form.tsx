// components/forms/recurring-payment-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { format, addDays } from 'date-fns'

const recurringSchema = z.object({
  clientId: z.string().min(1, 'לקוח חובה'),
  name: z.string().min(1, 'שם השירות חובה'),
  amount: z.number().min(1, 'סכום חייב להיות גדול מ-0'),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  serviceType: z.string().min(1, 'סוג שירות חובה'),
  reminderDays: z.number().min(1).max(90),
  nextDueDate: z.string().min(1, 'תאריך חובה'),
})

export type RecurringPaymentFormData = z.infer<typeof recurringSchema>

interface RecurringPaymentFormProps {
  onSubmit: (data: RecurringPaymentFormData) => void
  clients: Array<{ id: string; name: string; company?: string }>
  isLoading?: boolean
  defaultValues?: Partial<RecurringPaymentFormData>
}

export function RecurringPaymentForm({ 
  onSubmit, 
  clients, 
  isLoading = false,
  defaultValues 
}: RecurringPaymentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RecurringPaymentFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      frequency: 'MONTHLY',
      reminderDays: 30,
      nextDueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>לקוח *</Label>
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
          <Label>שם השירות *</Label>
          <Input 
            placeholder="אחזקת אתר / אירוח / תמיכה"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-red-500 text-sm">{errors.name.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>סכום *</Label>
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
          <Label>תדירות *</Label>
          <Select 
            value={watch('frequency')} 
            onValueChange={(value) => setValue('frequency', value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">חודשי</SelectItem>
              <SelectItem value="QUARTERLY">רבעוני (3 חודשים)</SelectItem>
              <SelectItem value="YEARLY">שנתי</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>סוג שירות *</Label>
          <Input 
            placeholder="אירוח + תמיכה + עדכונים"
            {...register('serviceType')}
          />
          {errors.serviceType && (
            <p className="text-red-500 text-sm">{errors.serviceType.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>תזכורת (ימים לפני) *</Label>
          <Input 
            type="number" 
            {...register('reminderDays', { valueAsNumber: true })}
          />
          {errors.reminderDays && (
            <p className="text-red-500 text-sm">{errors.reminderDays.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>תאריך חיוב הבא *</Label>
          <Input 
            type="date" 
            {...register('nextDueDate')}
          />
          {errors.nextDueDate && (
            <p className="text-red-500 text-sm">{errors.nextDueDate.message}</p>
          )}
        </div>
      </div>
      
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              שומר...
            </>
          ) : (
            'שמור תשלום חוזר'
          )}
        </Button>
      </div>
    </form>
  )
}