'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { tone, CONTACT_STATUS_TONES, toneClass } from '@/lib/design/tones'
import { label, CONTACT_STATUS_LABELS, CONTACT_SOURCE_LABELS } from '@/lib/design/labels'
import { formatDate } from '@/lib/utils'
import type { ContactListItem } from '@/lib/types/contact'

/** Compared against the start of today, so a lead due today is not late. */
function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return new Date(iso) < start
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactListItem[]>([])
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

  // The server already applied `phase`, and it is the only place that knows
  // which statuses count as a lead. Re-filtering here just meant a second copy
  // of that list to forget to update.
  const isLeadsTab = tab === 'leads'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">אנשי קשר</h1>
          <p className="text-sm text-content-subtle mt-1">
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
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-faint w-4 h-4" />
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
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-content-subtle">
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
                    {isLeadsTab && <TableHead className="text-right">פעולה הבאה</TableHead>}
                    <TableHead className="text-right">מקור</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                    >
                      <TableCell className="font-medium">
                        {contact.name}
                        {contact.company && (
                          <span className="text-xs text-content-subtle mr-2">
                            ({contact.company})
                          </span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr" className="text-right">
                        {contact.phone}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={tone(CONTACT_STATUS_TONES, contact.status)}
                          variant="secondary"
                        >
                          {label(CONTACT_STATUS_LABELS, contact.status)}
                        </Badge>
                      </TableCell>
                      {isLeadsTab && (
                        <TableCell>
                          {contact.nextActionAt ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={
                                  isOverdue(contact.nextActionAt)
                                    ? toneClass.danger
                                    : toneClass.neutral
                                }
                              >
                                {formatDate(contact.nextActionAt)}
                              </Badge>
                              {contact.nextActionNote && (
                                <span className="text-xs text-content-subtle truncate max-w-[16rem]">
                                  {contact.nextActionNote}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-content-faint">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {label(CONTACT_SOURCE_LABELS, contact.source)}
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
