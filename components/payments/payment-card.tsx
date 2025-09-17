// components/payments/payment-card.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  MoreVertical,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle,
  Edit,
  Trash2,
  FileText,
  Receipt
} from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

interface Payment {
  id: string
  client: { 
    id: string
    name: string
    company?: string
    phone: string
    email: string
  }
  project?: { 
    id: string
    name: string
    type: string 
  }
  amount: number
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  type: 'PROJECT' | 'MAINTENANCE' | 'CONSULTATION' | 'OTHER'
  dueDate: string
  paidAt?: string
  invoiceNumber?: string
  receiptNumber?: string
  notes?: string
}

interface PaymentCardProps {
  payment: Payment
  onMarkAsPaid: (id: string) => void
  onSendReminder: (id: string, method: 'email' | 'whatsapp' | 'sms') => void
  onEdit: (payment: Payment) => void
  onDelete: (id: string) => void
  onGenerateInvoice: (id: string) => void
  onGenerateReceipt: (id: string) => void
}

const statusColors = {
  PAID: 'bg-green-100 text-green-800 border-green-300',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
}

const statusLabels = {
  PAID: 'שולם',
  PENDING: 'ממתין',
  OVERDUE: 'באיחור',
  CANCELLED: 'בוטל',
}

const typeLabels = {
  PROJECT: 'פרויקט',
  MAINTENANCE: 'אחזקה',
  CONSULTATION: 'ייעוץ',
  OTHER: 'אחר',
}

export function PaymentCard({
  payment,
  onMarkAsPaid,
  onSendReminder,
  onEdit,
  onDelete,
  onGenerateInvoice,
  onGenerateReceipt,
}: PaymentCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getDaysOverdue = () => {
    const due = new Date(payment.dueDate)
    const today = new Date()
    return Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <Card className={payment.status === 'OVERDUE' ? 'border-red-300' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold">{payment.client.name}</h4>
              <Badge className={statusColors[payment.status]}>
                {statusLabels[payment.status]}
              </Badge>
            </div>
            {payment.client.company && (
              <p className="text-sm text-gray-600">{payment.client.company}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              {payment.project?.name || typeLabels[payment.type]}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {payment.status !== 'PAID' && (
                <>
                  <DropdownMenuItem onClick={() => onMarkAsPaid(payment.id)}>
                    <CheckCircle className="w-4 h-4 ml-2" />
                    סמן כשולם
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={() => onSendReminder(payment.id, 'email')}>
                <Mail className="w-4 h-4 ml-2" />
                שלח תזכורת באימייל
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSendReminder(payment.id, 'whatsapp')}>
                <MessageSquare className="w-4 h-4 ml-2" />
                שלח תזכורת ב-WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = `tel:${payment.client.phone}`}>
                <Phone className="w-4 h-4 ml-2" />
                התקשר ללקוח
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {!payment.invoiceNumber && (
                <DropdownMenuItem onClick={() => onGenerateInvoice(payment.id)}>
                  <FileText className="w-4 h-4 ml-2" />
                  צור חשבונית
                </DropdownMenuItem>
              )}
              
              {payment.status === 'PAID' && (
                <DropdownMenuItem onClick={() => onGenerateReceipt(payment.id)}>
                  <Receipt className="w-4 h-4 ml-2" />
                  צור קבלה
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => onEdit(payment)}>
                <Edit className="w-4 h-4 ml-2" />
                ערוך
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(payment.id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                מחק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">סכום:</span>
            <span className="font-bold text-lg">{formatCurrency(payment.amount)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">תאריך לתשלום:</span>
            <span className="text-sm">
              {format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: he })}
            </span>
          </div>
          
          {payment.status === 'OVERDUE' && (
            <div className="bg-red-50 rounded p-2 mt-2">
              <p className="text-sm text-red-700 font-medium">
                באיחור: {getDaysOverdue()} ימים
              </p>
            </div>
          )}
          
          {payment.status === 'PAID' && payment.paidAt && (
            <div className="bg-green-50 rounded p-2 mt-2">
              <p className="text-sm text-green-700">
                שולם: {format(new Date(payment.paidAt), 'dd/MM/yyyy', { locale: he })}
              </p>
              {payment.receiptNumber && (
                <p className="text-xs text-green-600">קבלה: {payment.receiptNumber}</p>
              )}
            </div>
          )}
          
          {payment.invoiceNumber && (
            <div className="flex items-center gap-2 mt-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">חשבונית: {payment.invoiceNumber}</span>
            </div>
          )}
          
          {payment.notes && (
            <p className="text-xs text-gray-500 mt-2">{payment.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}