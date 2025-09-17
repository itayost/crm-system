// components/payments/quick-payment.tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { CheckCircle, Loader2 } from 'lucide-react'

interface QuickPaymentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payments: Array<{
    id: string
    client: { name: string }
    project?: { name: string }
    amount: number
    type: string
  }>
  onSubmit: (data: {
    paymentId: string
    paidAmount: number
    paymentMethod: string
    receiptNumber?: string
    notes?: string
  }) => void
  isLoading?: boolean
}

export function QuickPayment({
  open,
  onOpenChange,
  payments,
  onSubmit,
  isLoading = false,
}: QuickPaymentProps) {
  const [formData, setFormData] = useState({
    paymentId: '',
    paidAmount: 0,
    paymentMethod: 'BANK_TRANSFER',
    receiptNumber: '',
    notes: '',
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handlePaymentSelect = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId)
    setFormData({
      ...formData,
      paymentId,
      paidAmount: payment?.amount || 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>קבלת תשלום מהיר</DialogTitle>
          <DialogDescription>
            סמן תשלום כשולם וצור קבלה אוטומטית
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>בחר תשלום</Label>
            <Select 
              value={formData.paymentId} 
              onValueChange={handlePaymentSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר תשלום ממתין" />
              </SelectTrigger>
              <SelectContent>
                {payments.map(payment => (
                  <SelectItem key={payment.id} value={payment.id}>
                    {payment.client.name} - {formatCurrency(payment.amount)}
                    {payment.project && ` - ${payment.project.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>סכום ששולם</Label>
              <Input 
                type="number" 
                value={formData.paidAmount}
                onChange={(e) => setFormData({
                  ...formData,
                  paidAmount: parseFloat(e.target.value)
                })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>אמצעי תשלום</Label>
              <Select 
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({
                  ...formData,
                  paymentMethod: value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">העברה בנקאית</SelectItem>
                  <SelectItem value="CREDIT_CARD">כרטיס אשראי</SelectItem>
                  <SelectItem value="CASH">מזומן</SelectItem>
                  <SelectItem value="CHECK">צ&apos;ק</SelectItem>
                  <SelectItem value="PAYPAL">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>מספר קבלה</Label>
              <Input 
                placeholder="יווצר אוטומטית"
                value={formData.receiptNumber}
                onChange={(e) => setFormData({
                  ...formData,
                  receiptNumber: e.target.value
                })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>הערות</Label>
              <Input 
                placeholder="הערות אופציונליות"
                value={formData.notes}
                onChange={(e) => setFormData({
                  ...formData,
                  notes: e.target.value
                })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.paymentId || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מעבד...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 ml-2" />
                  סמן כשולם וצור קבלה
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}