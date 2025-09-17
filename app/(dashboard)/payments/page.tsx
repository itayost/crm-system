// app/(dashboard)/payments/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  MoreVertical,
  Edit,
  Trash
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaymentForm } from '@/components/forms/payment-form'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
}

const statusLabels: Record<string, string> = {
  PENDING: 'ממתין',
  PAID: 'שולם',
  OVERDUE: 'באיחור',
  CANCELLED: 'בוטל'
}

const paymentTypeLabels: Record<string, string> = {
  PROJECT: 'פרויקט',
  MAINTENANCE: 'אחזקה',
  CONSULTATION: 'ייעוץ',
  RECURRING: 'חוזר',
  OTHER: 'אחר'
}

const frequencyLabels: Record<string, string> = {
  MONTHLY: 'חודשי',
  QUARTERLY: 'רבעוני',
  YEARLY: 'שנתי'
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('payments')
  const [showForm, setShowForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<{
    id: string
    amount: number
    dueDate: string
    status: string
    type: string
    client?: { name?: string; email?: string }
    project?: { name?: string }
    invoiceNumber?: string
    notes?: string
    createdAt: string
  } | null>(null)
  const [payments, setPayments] = useState<Array<{
    id: string
    amount: number
    dueDate: string
    status: string
    type: string
    client?: { name?: string; email?: string }
    project?: { name?: string }
    invoiceNumber?: string
    paidAt?: string
    createdAt: string
  }>>([])
  const [recurringPayments, setRecurringPayments] = useState<Array<{
    id: string
    name: string
    amount: number
    frequency: string
    nextDueDate: string
    status: string
    isActive?: boolean
    serviceType?: string
    client?: { name?: string }
  }>>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [paymentsRes, recurringRes, clientsRes, projectsRes] = await Promise.all([
        api.get('/payments'),
        api.get('/payments/recurring'),
        api.get('/clients?status=ACTIVE'),
        api.get('/projects?status=IN_PROGRESS')
      ])
      
      setPayments(paymentsRes.data)
      setRecurringPayments(recurringRes.data)
      setClients(clientsRes.data)
      setProjects(projectsRes.data)
    } catch {
      console.error('Failed to fetch data')
      // Continue with empty data if some endpoints fail
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePayment = async (data: unknown) => {
    try {
      const response = await api.post('/payments', data)
      setPayments([response.data, ...payments])
      setShowForm(false)
      toast.success('תשלום נוסף בהצלחה!')
    } catch {
      toast.error('שגיאה ביצירת תשלום')
    }
  }

  const handleUpdatePayment = async (data: unknown) => {
    if (!editingPayment) return
    try {
      const response = await api.put(`/payments/${editingPayment.id}`, data)
      setPayments(payments.map(p => p.id === editingPayment.id ? response.data : p))
      setEditingPayment(null)
      setShowForm(false)
      toast.success('תשלום עודכן בהצלחה!')
    } catch {
      toast.error('שגיאה בעדכון תשלום')
    }
  }

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const response = await api.put(`/payments/${paymentId}`, { 
        status: 'PAID',
        paidAt: new Date().toISOString()
      })
      setPayments(payments.map(p => p.id === paymentId ? response.data : p))
      toast.success('תשלום סומן כשולם!')
    } catch {
      toast.error('שגיאה בסימון תשלום')
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return
    
    try {
      await api.delete(`/payments/${paymentId}`)
      setPayments(payments.filter(p => p.id !== paymentId))
      toast.success('תשלום נמחק בהצלחה')
    } catch (error) {
      const message = (error as {response?: {data?: {error?: string}}})?.response?.data?.error || 'שגיאה במחיקת תשלום'
      toast.error(message)
    }
  }

  // Filter and search payments
  const getFilteredPayments = () => {
    let filtered = payments

    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        filtered = filtered.filter(p => 
          p.status === 'PENDING' && new Date(p.dueDate) < new Date()
        )
      } else {
        filtered = filtered.filter(p => p.status === filterStatus)
      }
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.type === filterType)
    }

    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.client?.name?.toLowerCase().includes(search) ||
        p.client?.email?.toLowerCase().includes(search) ||
        p.invoiceNumber?.toLowerCase().includes(search) ||
        p.project?.name?.toLowerCase().includes(search)
      )
    }

    return filtered
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS' 
    }).format(num)
  }

  // Calculate statistics
  const calculateStats = () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const overduePayments = payments.filter(p => 
      p.status === 'PENDING' && new Date(p.dueDate) < now
    )
    
    const pendingPayments = payments.filter(p => p.status === 'PENDING')
    const paidThisMonth = payments.filter(p => 
      p.status === 'PAID' && p.paidAt && new Date(p.paidAt) >= thisMonth
    )
    
    return {
      totalPending: pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalOverdue: overduePayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      monthlyRevenue: paidThisMonth.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      recurringRevenue: recurringPayments
        .filter(r => r.isActive)
        .reduce((sum, r) => sum + parseFloat(r.amount), 0),
      overdueCount: overduePayments.length,
      pendingCount: pendingPayments.length
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  const stats = calculateStats()
  const filteredPayments = getFilteredPayments()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">תשלומים ואחזקה</h1>
          <p className="text-gray-600 mt-1">
            {payments.length} תשלומים • {stats.pendingCount} ממתינים • {stats.overdueCount} באיחור
          </p>
        </div>
        <Button onClick={() => {
          setEditingPayment(null)
          setShowForm(true)
        }}>
          <Plus className="w-4 h-4 ml-2" />
          תשלום חדש
        </Button>
      </div>

      {/* Overdue Alert */}
      {stats.overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              יש לך {stats.overdueCount} תשלומים באיחור בסך {formatCurrency(stats.totalOverdue)}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              הכנסות החודש
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.monthlyRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              ממתין לתשלום
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats.totalPending)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              באיחור
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalOverdue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              אחזקה חודשית
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.recurringRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'payments' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          תשלומי פרויקטים
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'recurring' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          תשלומי אחזקה
        </button>
      </div>

      {activeTab === 'payments' ? (
        <>
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="חיפוש לפי לקוח, פרויקט או מספר חשבונית..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="PENDING">ממתין</SelectItem>
                <SelectItem value="PAID">שולם</SelectItem>
                <SelectItem value="overdue">באיחור</SelectItem>
                <SelectItem value="CANCELLED">בוטל</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="סוג" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                <SelectItem value="PROJECT">פרויקט</SelectItem>
                <SelectItem value="MAINTENANCE">אחזקה</SelectItem>
                <SelectItem value="CONSULTATION">ייעוץ</SelectItem>
                <SelectItem value="OTHER">אחר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPayments.map(payment => {
              const isOverdue = payment.status === 'PENDING' && new Date(payment.dueDate) < new Date()
              const daysUntilDue = differenceInDays(new Date(payment.dueDate), new Date())
              
              return (
                <Card key={payment.id} className={isOverdue ? 'border-red-200' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold">
                          {payment.client?.name || 'לקוח לא מוגדר'}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {payment.project?.name || paymentTypeLabels[payment.type]}
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[isOverdue ? 'OVERDUE' : payment.status]}>
                        {statusLabels[isOverdue ? 'OVERDUE' : payment.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold">{formatCurrency(payment.amount)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              setEditingPayment(payment)
                              setShowForm(true)
                            }}>
                              <Edit className="w-4 h-4 ml-2" />
                              עריכה
                            </DropdownMenuItem>
                            {payment.status === 'PENDING' && (
                              <DropdownMenuItem onClick={() => handleMarkAsPaid(payment.id)}>
                                <CheckCircle className="w-4 h-4 ml-2" />
                                סמן כשולם
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeletePayment(payment.id)}
                            >
                              <Trash className="w-4 h-4 ml-2" />
                              מחיקה
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {isOverdue 
                              ? `באיחור ${Math.abs(daysUntilDue)} ימים`
                              : payment.status === 'PAID'
                              ? `שולם ב-${format(new Date(payment.paidAt), 'dd/MM/yyyy', { locale: he })}`
                              : `${daysUntilDue} ימים לתשלום`
                            }
                          </span>
                        </div>
                        {payment.invoiceNumber && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>חשבונית #{payment.invoiceNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredPayments.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500">לא נמצאו תשלומים</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Recurring Payments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recurringPayments.map(recurring => (
              <Card key={recurring.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-semibold">
                      {recurring.name}
                    </CardTitle>
                    <Badge className={recurring.isActive ? 'bg-green-100' : 'bg-gray-100'}>
                      {recurring.isActive ? 'פעיל' : 'מושעה'}
                    </Badge>
                  </div>
                  <CardDescription>
                    {recurring.client?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {formatCurrency(recurring.amount)}
                      <span className="text-sm font-normal text-gray-600 mr-2">
                        / {frequencyLabels[recurring.frequency] || recurring.frequency}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          תשלום הבא: {format(new Date(recurring.nextDueDate), 'dd/MM/yyyy', { locale: he })}
                        </span>
                      </div>
                      {recurring.serviceType && (
                        <div className="mt-1">
                          סוג שירות: {recurring.serviceType}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4 ml-1" />
                        ערוך
                      </Button>
                      {recurring.isActive ? (
                        <Button size="sm" variant="outline" className="text-orange-600">
                          <XCircle className="w-4 h-4 ml-1" />
                          השעה
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-green-600">
                          <CheckCircle className="w-4 h-4 ml-1" />
                          הפעל
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {recurringPayments.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500 mb-4">אין תשלומי אחזקה חוזרים</p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף תשלום חוזר
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Payment Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? 'עריכת תשלום' : 'הוספת תשלום חדש'}
            </DialogTitle>
            <DialogDescription>
              {editingPayment ? 'ערוך את פרטי התשלום' : 'הזן את פרטי התשלום החדש'}
            </DialogDescription>
          </DialogHeader>
          <PaymentForm
            onSubmit={editingPayment ? handleUpdatePayment : handleCreatePayment}
            clients={clients}
            projects={projects}
            defaultValues={editingPayment}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}