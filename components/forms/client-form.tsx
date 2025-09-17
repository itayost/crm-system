'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const clientSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין'),
  phone: z.string().min(9, 'טלפון חובה'),
  company: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  type: z.enum(['REGULAR', 'VIP']).optional(),
  notes: z.string().optional(),
})

type ClientFormData = z.infer<typeof clientSchema>

interface ClientFormProps {
  onSubmit: (data: ClientFormData) => void
  onCancel: () => void
  initialData?: Partial<ClientFormData>
}

export function ClientForm({ onSubmit, onCancel, initialData }: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData || {
      type: 'REGULAR'
    }
  })

  const clientType = watch('type')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <Label htmlFor="name">שם מלא *</Label>
          <Input 
            id="name" 
            {...register('name')} 
            placeholder="שם הלקוח"
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>
        
        {/* Company */}
        <div>
          <Label htmlFor="company">חברה</Label>
          <Input 
            id="company" 
            {...register('company')} 
            placeholder="שם החברה (אופציונלי)"
          />
        </div>
        
        {/* Phone */}
        <div>
          <Label htmlFor="phone">טלפון *</Label>
          <Input 
            id="phone" 
            {...register('phone')} 
            placeholder="050-1234567"
            dir="ltr"
          />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
          )}
        </div>
        
        {/* Email */}
        <div>
          <Label htmlFor="email">אימייל *</Label>
          <Input 
            id="email" 
            type="email" 
            {...register('email')} 
            placeholder="client@example.com"
            dir="ltr"
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
        
        {/* Tax ID */}
        <div>
          <Label htmlFor="taxId">ח.פ / ע.מ</Label>
          <Input 
            id="taxId" 
            {...register('taxId')} 
            placeholder="מספר עוסק מורשה"
            dir="ltr"
          />
        </div>
        
        {/* Client Type */}
        <div>
          <Label htmlFor="type">סוג לקוח</Label>
          <Select 
            value={clientType} 
            onValueChange={(value) => setValue('type', value as 'REGULAR' | 'VIP')}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר סוג לקוח" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGULAR">רגיל</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Address */}
      <div>
        <Label htmlFor="address">כתובת</Label>
        <Input 
          id="address" 
          {...register('address')} 
          placeholder="רחוב, עיר"
        />
      </div>
      
      {/* Notes */}
      <div>
        <Label htmlFor="notes">הערות</Label>
        <Textarea 
          id="notes" 
          {...register('notes')} 
          rows={3}
          placeholder="הערות נוספות על הלקוח..."
        />
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          ביטול
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'שומר...' : initialData ? 'עדכן לקוח' : 'צור לקוח'}
        </Button>
      </div>
    </form>
  )
}