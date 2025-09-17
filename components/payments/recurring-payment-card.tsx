// components/payments/recurring-payment-card.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock, Edit, History, Calendar } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { he } from 'date-fns/locale'

interface RecurringPayment {
  id: string
  client: { 
    id: string
    name: string
    phone: string
    email: string
  }
  name: string
  amount: number
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  nextDueDate: string
  lastPaidDate?: string
  isActive: boolean
  serviceType: string
  reminderDays: number
}

interface RecurringPaymentCardProps {
  payment: RecurringPayment
  onEdit: (payment: RecurringPayment) => void
  onSuspend: (id: string) => void
  onActivate: (id: string) => void
  onViewHistory: (id: string) => void
}

const frequencyLabels = {
  MONTHLY: 'חודשי',
  QUARTERLY: 'רבעוני',
  YEARLY: 'שנתי',
}

export function RecurringPaymentCard({
  payment,
  onEdit,
  onSuspend,
  onActivate,
  onViewHistory,
}: RecurringPaymentCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getDaysUntilDue = () => {
    const due = new Date(payment.nextDueDate)
    const today = new Date()
    return differenceInDays(due, today)
  }

  const daysUntil = getDaysUntilDue()
  const isReminderTime = daysUntil <= payment.reminderDays && daysUntil > 0

  return (
    <Card className={`${!payment.isActive ? 'opacity-60' : ''} ${isReminderTime ? 'border-yellow-400' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-bold">{payment.client.name}</h4>
            <p className="text-sm text-gray-600">{payment.name}</p>
          </div>
          <Badge className={payment.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {payment.isActive ? 'פעיל' : 'מושעה'}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">סכום {frequencyLabels[payment.frequency]}:</span>
            <span className="font-bold">{formatCurrency(payment.amount)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">כולל:</span>
            <span>{payment.serviceType}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">תשלום הבא:</span>
            <span className={`font-bold ${isReminderTime ? 'text-yellow-600' : 'text-blue-600'}`}>
              {format(new Date(payment.nextDueDate), 'dd/MM/yyyy', { locale: he })}
            </span>
          </div>
          
          {isReminderTime && (
            <div className="bg-yellow-50 rounded p-2 mt-2">
              <p className="text-xs text-yellow-800">
                <Calendar className="w-3 h-3 inline ml-1" />
                תזכורת: בעוד {daysUntil} ימים
              </p>
            </div>
          )}
          
          {payment.frequency === 'YEARLY' && (
            <div className="flex justify-between">
              <span className="text-gray-600">חיסכון:</span>
              <span className="text-green-600">
                {formatCurrency(payment.amount * 0.1)} (חודש חינם)
              </span>
            </div>
          )}
        </div>
        
        {payment.lastPaidDate && (
          <div className="bg-gray-50 rounded-lg p-2 mt-3">
            <p className="text-xs text-gray-600">
              שולם לאחרונה: {format(new Date(payment.lastPaidDate), 'dd/MM/yyyy', { locale: he })}
            </p>
          </div>
        )}
        
        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(payment)}>
            <Edit className="w-3 h-3 ml-1" />
            עדכן
          </Button>
          
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onViewHistory(payment.id)}>
            <History className="w-3 h-3 ml-1" />
            היסטוריה
          </Button>
          
          {payment.isActive ? (
            <Button 
              size="sm" 
              variant="destructive" 
              className="flex-1"
              onClick={() => onSuspend(payment.id)}
            >
              <Lock className="w-3 h-3 ml-1" />
              השעה
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="default" 
              className="flex-1"
              onClick={() => onActivate(payment.id)}
            >
              הפעל
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}