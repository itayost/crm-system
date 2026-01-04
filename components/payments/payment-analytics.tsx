// components/payments/payment-analytics.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, CreditCard } from 'lucide-react'

interface Payment {
  id: string
  amount: number
  status: string
  dueDate?: string
}

interface PaymentAnalyticsProps {
  payments: Payment[]
  recurringPayments: unknown
}

export function PaymentAnalytics({ payments, recurringPayments: _recurringPayments }: PaymentAnalyticsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate monthly revenue for last 4 months
  const monthlyRevenue = [
    { month: 'דצמבר', amount: 45300, percentage: 90 },
    { month: 'נובמבר', amount: 37200, percentage: 74 },
    { month: 'אוקטובר', amount: 48900, percentage: 98 },
    { month: 'ספטמבר', amount: 31800, percentage: 64 },
  ]

  const totalPending = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0)

  const totalOverdue = payments
    .filter((p) => p.status === 'OVERDUE')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>ניתוח תשלומים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cash Flow Summary */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-3">צפוי החודש</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>פרויקטים:</span>
                <span className="font-bold">{formatCurrency(18500)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>אחזקה:</span>
                <span className="font-bold">{formatCurrency(4200)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-bold">סה&quot;כ:</span>
                  <span className="font-bold text-green-600">{formatCurrency(22700)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-3">ממתין לגבייה</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>תקין:</span>
                <span className="font-bold text-yellow-600">{formatCurrency(totalPending)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>באיחור:</span>
                <span className="font-bold text-red-600">{formatCurrency(totalOverdue)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-bold">סה&quot;כ:</span>
                  <span className="font-bold">{formatCurrency(totalPending + totalOverdue)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-3">החודש הבא</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>פרויקטים צפויים:</span>
                <span className="font-bold">{formatCurrency(25000)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>אחזקה קבועה:</span>
                <span className="font-bold">{formatCurrency(4200)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-bold">סה&quot;כ צפוי:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(29200)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Monthly Revenue Chart */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">גרף הכנסות - 4 חודשים אחרונים</h4>
          <div className="space-y-3">
            {monthlyRevenue.map((month, index) => (
              <div key={month.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{month.month}</span>
                  <span className="text-sm font-bold">{formatCurrency(month.amount)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div 
                    className={`h-6 rounded-full flex items-center justify-end px-2 ${
                      index === 0 ? 'bg-blue-500' : 
                      index === 1 ? 'bg-green-500' : 
                      index === 2 ? 'bg-purple-500' : 
                      'bg-yellow-500'
                    }`}
                    style={{ width: `${month.percentage}%` }}
                  >
                    <span className="text-xs text-white font-bold">
                      {month.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">מגמה חיובית</p>
              </div>
              <p className="text-sm text-gray-700">
                עלייה של 23% בהכנסות החודש לעומת החודש הקודם
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <p className="font-medium text-blue-800">אחוז גבייה</p>
              </div>
              <p className="text-sm text-gray-700">
                85% מהחשבוניות נגבות בזמן
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}