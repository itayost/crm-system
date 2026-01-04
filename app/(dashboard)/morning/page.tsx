// app/(dashboard)/morning/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  FileText,
  Receipt,
  RefreshCw,
  CheckCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  AlertCircle,
  Building2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

interface MorningDocument {
  id: string
  number: number
  type: number
  status: number
  date: string
  amount: number
  client: {
    name: string
    email?: string
  }
}

interface MorningRetainer {
  id: string
  client?: {
    name: string
  }
  income: Array<{ description: string; price: number }>
  frequency: number
  startDate: string
  endDate?: string
  status: number
  nextDate?: string
}

const documentTypeLabels: Record<number, string> = {
  10: 'הצעת מחיר',
  100: 'הזמנה',
  300: 'חשבונית עסקה',
  305: 'חשבונית מס',
  320: 'חשבונית מס קבלה',
  330: 'חשבונית זיכוי',
  400: 'קבלה'
}

const frequencyLabels: Record<number, string> = {
  1: 'חודשי',
  2: 'דו-חודשי',
  3: 'רבעוני',
  6: 'חצי שנתי',
  12: 'שנתי'
}

const retainerStatusLabels: Record<number, string> = {
  0: 'פעיל',
  1: 'מושהה',
  2: 'הושלם',
  3: 'בוטל'
}

const retainerStatusColors: Record<number, string> = {
  0: 'bg-green-100 text-green-800',
  1: 'bg-yellow-100 text-yellow-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-gray-100 text-gray-800'
}

export default function MorningPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<MorningDocument[]>([])
  const [retainers, setRetainers] = useState<MorningRetainer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewRetainerDialog, setShowNewRetainerDialog] = useState(false)
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string; phone?: string }>>([])

  // New retainer form state
  const [newRetainer, setNewRetainer] = useState({
    clientId: '',
    description: '',
    amount: '',
    frequency: '1'
  })

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      setLoading(true)
      const response = await api.get('/morning')
      setIsConnected(response.data.connected)
      setBusinessName(response.data.businessName || '')

      if (response.data.connected) {
        await Promise.all([fetchDocuments(), fetchRetainers(), fetchClients()])
      }
    } catch {
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/morning/documents')
      setDocuments(response.data.items || [])
    } catch {
      console.error('Failed to fetch documents')
    }
  }

  const fetchRetainers = async () => {
    try {
      const response = await api.get('/morning/retainers')
      setRetainers(response.data.items || [])
    } catch {
      console.error('Failed to fetch retainers')
    }
  }

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients?status=ACTIVE')
      setClients(response.data || [])
    } catch {
      console.error('Failed to fetch clients')
    }
  }

  const handleCreateRetainer = async () => {
    const selectedClient = clients.find(c => c.id === newRetainer.clientId)
    if (!selectedClient) {
      toast.error('נא לבחור לקוח')
      return
    }

    try {
      await api.post('/morning/retainers', {
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        clientPhone: selectedClient.phone,
        description: newRetainer.description,
        amount: parseFloat(newRetainer.amount),
        frequency: parseInt(newRetainer.frequency)
      })

      toast.success('ריטיינר נוצר בהצלחה!')
      setShowNewRetainerDialog(false)
      setNewRetainer({ clientId: '', description: '', amount: '', frequency: '1' })
      fetchRetainers()
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'שגיאה ביצירת ריטיינר'
      toast.error(message)
    }
  }

  const handleRetainerAction = async (retainerId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      await api.put(`/morning/retainers/${retainerId}`, { action })

      const actionLabels = {
        pause: 'הושהה',
        resume: 'חודש',
        cancel: 'בוטל'
      }

      toast.success(`הריטיינר ${actionLabels[action]} בהצלחה!`)
      fetchRetainers()
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'שגיאה בעדכון ריטיינר'
      toast.error(message)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Morning - חשבוניות</h1>
          <p className="text-gray-600 mt-1">ניהול חשבוניות ותשלומים חוזרים</p>
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              אינטגרציית Morning לא מחוברת
            </CardTitle>
            <CardDescription className="text-yellow-700">
              כדי להשתמש באינטגרציה, יש להגדיר את פרטי ה-API בקובץ .env
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-4 rounded-lg border border-yellow-200">
              <code className="text-sm text-gray-800">
                MORNING_API_KEY=your_api_key<br />
                MORNING_API_SECRET=your_api_secret<br />
                ENABLE_MORNING_INTEGRATION=true
              </code>
            </div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => window.open('https://app.greeninvoice.co.il/settings/api', '_blank')}
            >
              <ExternalLink className="w-4 h-4 ml-2" />
              קבל מפתח API מ-Morning
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Morning - חשבוניות</h1>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            מחובר ל: {businessName}
            <CheckCircle className="w-4 h-4 text-green-500" />
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkConnection}>
            <RefreshCw className="w-4 h-4 ml-2" />
            רענון
          </Button>
          <Button onClick={() => setShowNewRetainerDialog(true)}>
            <Plus className="w-4 h-4 ml-2" />
            ריטיינר חדש
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">מסמכים החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">ריטיינרים פעילים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {retainers.filter(r => r.status === 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">הכנסה חוזרת חודשית</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(
                retainers
                  .filter(r => r.status === 0)
                  .reduce((sum, r) => sum + (r.income?.[0]?.price || 0), 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">מסמכים השנה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            מסמכים
          </TabsTrigger>
          <TabsTrigger value="retainers" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            ריטיינרים
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          {/* Search */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="חיפוש מסמכים..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => window.open('https://app.greeninvoice.co.il', '_blank')}
            >
              <ExternalLink className="w-4 h-4 ml-2" />
              פתח Morning
            </Button>
          </div>

          {/* Documents List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">
                        {documentTypeLabels[doc.type] || 'מסמך'} #{doc.number}
                      </CardTitle>
                      <CardDescription>{doc.client?.name}</CardDescription>
                    </div>
                    <Badge className={doc.status === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {doc.status === 1 ? 'סגור' : 'פתוח'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold">{formatCurrency(doc.amount)}</span>
                    <span className="text-sm text-gray-500">
                      {format(new Date(doc.date), 'dd/MM/yyyy', { locale: he })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {documents.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Receipt className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">אין מסמכים להצגה</p>
                <p className="text-sm text-gray-400 mt-1">
                  מסמכים שתיצור דרך ה-CRM יופיעו כאן
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Retainers Tab */}
        <TabsContent value="retainers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {retainers.map((retainer) => (
              <Card key={retainer.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">
                        {retainer.income?.[0]?.description || 'ריטיינר'}
                      </CardTitle>
                      <CardDescription>{retainer.client?.name}</CardDescription>
                    </div>
                    <Badge className={retainerStatusColors[retainer.status]}>
                      {retainerStatusLabels[retainer.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold">
                        {formatCurrency(retainer.income?.[0]?.price || 0)}
                      </span>
                      <span className="text-sm text-gray-500">
                        / {frequencyLabels[retainer.frequency]}
                      </span>
                    </div>

                    {retainer.nextDate && (
                      <div className="text-sm text-gray-600">
                        חשבונית הבאה: {format(new Date(retainer.nextDate), 'dd/MM/yyyy', { locale: he })}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {retainer.status === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetainerAction(retainer.id, 'pause')}
                        >
                          <PauseCircle className="w-4 h-4 ml-1" />
                          השהה
                        </Button>
                      )}
                      {retainer.status === 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600"
                          onClick={() => handleRetainerAction(retainer.id, 'resume')}
                        >
                          <PlayCircle className="w-4 h-4 ml-1" />
                          חדש
                        </Button>
                      )}
                      {retainer.status !== 3 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => handleRetainerAction(retainer.id, 'cancel')}
                        >
                          <XCircle className="w-4 h-4 ml-1" />
                          בטל
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {retainers.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <RefreshCw className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">אין ריטיינרים להצגה</p>
                <Button onClick={() => setShowNewRetainerDialog(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  צור ריטיינר חדש
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* New Retainer Dialog */}
      <Dialog open={showNewRetainerDialog} onOpenChange={setShowNewRetainerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>יצירת ריטיינר חדש</DialogTitle>
            <DialogDescription>
              ריטיינר יפיק חשבוניות אוטומטית לפי התדירות שתבחר
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Select
                value={newRetainer.clientId}
                onValueChange={(value) => setNewRetainer({ ...newRetainer, clientId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>תיאור שירות</Label>
              <Input
                value={newRetainer.description}
                onChange={(e) => setNewRetainer({ ...newRetainer, description: e.target.value })}
                placeholder="לדוגמה: תחזוקת אתר חודשית"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סכום (₪)</Label>
                <Input
                  type="number"
                  value={newRetainer.amount}
                  onChange={(e) => setNewRetainer({ ...newRetainer, amount: e.target.value })}
                  placeholder="300"
                />
              </div>

              <div className="space-y-2">
                <Label>תדירות</Label>
                <Select
                  value={newRetainer.frequency}
                  onValueChange={(value) => setNewRetainer({ ...newRetainer, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">חודשי</SelectItem>
                    <SelectItem value="3">רבעוני</SelectItem>
                    <SelectItem value="12">שנתי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRetainerDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateRetainer}>
              צור ריטיינר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
