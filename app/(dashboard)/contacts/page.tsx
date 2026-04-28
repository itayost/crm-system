'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContactForm } from '@/components/forms/contact-form'

const STATUS_LABELS: Record<string, string> = {
  NEW: 'חדש',
  CONTACTED: 'נוצר קשר',
  QUOTED: 'הוצעה הצעה',
  NEGOTIATING: 'במשא ומתן',
  CLIENT: 'לקוח',
  INACTIVE: 'לא פעיל',
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUOTED: 'bg-purple-100 text-purple-800',
  NEGOTIATING: 'bg-orange-100 text-orange-800',
  CLIENT: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
}

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'אתר',
  PHONE: 'טלפון',
  WHATSAPP: 'וואטסאפ',
  REFERRAL: 'הפניה',
  OTHER: 'אחר',
}

interface Contact {
  id: string
  name: string
  phone: string
  email?: string | null
  company?: string | null
  status: string
  source: string
  createdAt: string
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab === 'leads') params.set('phase', 'lead')
      if (tab === 'clients') params.set('phase', 'client')
      if (search.trim()) params.set('search', search.trim())

      const response = await api.get(`/contacts?${params.toString()}`)
      setContacts(response.data)
    } catch {
      toast.error('שגיאה בטעינת אנשי קשר')
    } finally {
      setLoading(false)
    }
  }, [tab, search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchContacts()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchContacts, search])

  const visibleContacts = contacts.filter((c) => {
    if (tab === 'leads') return ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'].includes(c.status)
    if (tab === 'clients') return ['CLIENT', 'INACTIVE'].includes(c.status)
    return true
  })

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">אנשי קשר</h1>
          <p className="text-sm text-gray-500 mt-1">
            ניהול לידים ולקוחות
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 ml-2" />
          איש קשר חדש
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="search"
          placeholder="חיפוש לפי שם, טלפון, אימייל..."
          className="pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">הכל</TabsTrigger>
          <TabsTrigger value="leads">לידים</TabsTrigger>
          <TabsTrigger value="clients">לקוחות</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : visibleContacts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">אין אנשי קשר</p>
              <p className="text-sm mt-1">
                {search ? 'לא נמצאו תוצאות לחיפוש' : 'צור איש קשר חדש כדי להתחיל'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">מקור</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                    >
                      <TableCell className="font-medium">
                        {contact.name}
                        {contact.company && (
                          <span className="text-xs text-gray-500 mr-2">
                            ({contact.company})
                          </span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr" className="text-right">
                        {contact.phone}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_COLORS[contact.status] ?? ''}
                          variant="secondary"
                        >
                          {STATUS_LABELS[contact.status] ?? contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {SOURCE_LABELS[contact.source] ?? contact.source}
                      </TableCell>
                      <TableCell>{formatDate(contact.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Form Dialog */}
      <ContactForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchContacts}
      />
    </div>
  )
}
