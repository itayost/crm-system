'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MessageSquare, 
  Building, 
  MapPin,
  DollarSign,
  Star,
  MoreVertical,
  Edit,
  Trash,
  FileText,
  TrendingUp
} from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ClientForm } from '@/components/forms/client-form'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

interface Client {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  address?: string
  taxId?: string
  type: 'REGULAR' | 'VIP'
  status: 'ACTIVE' | 'INACTIVE'
  totalRevenue: number
  notes?: string
  createdAt: string
  updatedAt: string
  _count?: {
    projects: number
    payments: number
  }
  projects?: Array<{
    id: string
    name: string
    status: string
    type: string
  }>
  recurringPayments?: Array<{
    id: string
    name: string
    amount: number
    frequency: string
    nextDueDate: string
  }>
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.append('status', filterStatus)
      if (filterType !== 'all') params.append('type', filterType)

      const response = await api.get(`/clients?${params}`)
      setClients(response.data)
    } catch {
      toast.error('שגיאה בטעינת לקוחות')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])
  const handleCreateClient = async (data: unknown) => {
    try {
      const response = await api.post('/clients', data)
      setClients([response.data, ...clients])
      setShowCreateForm(false)
      if (response.data._warning) {
        toast(response.data._warning, { icon: '⚠️', duration: 5000 })
      }
      toast.success('לקוח נוסף בהצלחה!')
    } catch {
      toast.error('שגיאה ביצירת לקוח')
    }
  }

  const handleUpdateClient = async (data: unknown) => {
    if (!editingClient) return
    try {
      const response = await api.put(`/clients/${editingClient.id}`, data)
      setClients(clients.map(c => c.id === editingClient.id ? response.data : c))
      setEditingClient(null)
      toast.success('לקוח עודכן בהצלחה')
    } catch {
      toast.error('שגיאה בעדכון לקוח')
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק לקוח זה?')) return
    
    try {
      await api.delete(`/clients/${clientId}`)
      setClients(clients.filter(client => client.id !== clientId))
      toast.success('לקוח נמחק בהצלחה')
    } catch {
      toast.error('שגיאה במחיקת לקוח')
    }
  }

  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      client.name.toLowerCase().includes(search) ||
      client.email.toLowerCase().includes(search) ||
      client.phone.includes(search) ||
      client.company?.toLowerCase().includes(search)
    )
  })

  // Calculate statistics
  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === 'ACTIVE').length,
    vip: clients.filter(c => c.type === 'VIP').length,
    totalRevenue: clients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">ניהול לקוחות</h1>
          <p className="text-gray-600 mt-1">
            {stats.total} לקוחות סה&quot;כ • {stats.active} פעילים • {stats.vip} VIP
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 ml-2" />
          לקוח חדש
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סה&quot;כ לקוחות</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">לקוחות פעילים</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">לקוחות VIP</p>
                <p className="text-2xl font-bold">{stats.vip}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">הכנסות כוללות</p>
                <p className="text-2xl font-bold">₪{stats.totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="חיפוש לקוח..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="ACTIVE">פעיל</SelectItem>
            <SelectItem value="INACTIVE">לא פעיל</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="סוג לקוח" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="REGULAR">רגיל</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <Card key={client.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/clients/${client.id}`)}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {client.name}
                    {client.type === 'VIP' && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </CardTitle>
                  {client.company && (
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Building className="h-3 w-3" />
                      {client.company}
                    </CardDescription>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingClient(client) }}>
                      <Edit className="ml-2 h-4 w-4" />
                      ערוך פרטים
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast('הפקת חשבוניות - בקרוב', { icon: '🧾' }) }}>
                      <FileText className="ml-2 h-4 w-4" />
                      צור חשבונית
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id) }}
                      className="text-red-600"
                    >
                      <Trash className="ml-2 h-4 w-4" />
                      מחק לקוח
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Contact Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-3 w-3" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{client.email}</span>
                </div>
                {client.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex justify-between pt-3 border-t">
                <div className="text-center">
                  <p className="text-xs text-gray-500">פרויקטים</p>
                  <p className="font-bold">{client._count?.projects || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">תשלומים</p>
                  <p className="font-bold">{client._count?.payments || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">הכנסות</p>
                  <p className="font-bold">₪{(client.totalRevenue || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center pt-3 border-t">
                <Badge variant={client.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {client.status === 'ACTIVE' ? 'פעיל' : 'לא פעיל'}
                </Badge>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${client.phone}` }}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${client.email}` }}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`, '_blank') }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Active Projects */}
              {client.projects && client.projects.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">פרויקטים אחרונים:</p>
                  <div className="space-y-1">
                    {client.projects.slice(0, 2).map(project => (
                      <div key={project.id} className="text-xs flex justify-between">
                        <span className="truncate">{project.name}</span>
                        <Badge variant="outline" className="text-xs h-5">
                          {project.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'לא נמצאו לקוחות התואמים את החיפוש' : 'עדיין אין לקוחות במערכת'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 ml-2" />
                הוסף לקוח ראשון
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Client Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>לקוח חדש</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={handleCreateClient}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>עריכת לקוח</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm
              onSubmit={handleUpdateClient}
              onCancel={() => setEditingClient(null)}
              initialData={{
                name: editingClient.name,
                email: editingClient.email,
                phone: editingClient.phone,
                company: editingClient.company || '',
                address: editingClient.address || '',
                taxId: editingClient.taxId || '',
                type: editingClient.type,
                notes: editingClient.notes || '',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}