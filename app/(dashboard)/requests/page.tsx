'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Search, Check, X, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RequestForm } from '@/components/forms/request-form'

const TYPE_LABELS: Record<string, string> = {
  REQUEST: 'בקשה',
  BUG: 'תקלה',
  IMPROVEMENT: 'שיפור',
  QUESTION: 'שאלה',
  OTHER: 'אחר',
}

const TYPE_COLORS: Record<string, string> = {
  REQUEST: 'bg-blue-100 text-blue-800',
  BUG: 'bg-red-100 text-red-800',
  IMPROVEMENT: 'bg-purple-100 text-purple-800',
  QUESTION: 'bg-yellow-100 text-yellow-800',
  OTHER: 'bg-gray-100 text-gray-700',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'ממתין לאישור',
  OPEN: 'פתוח',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'טופל',
  DISMISSED: 'נדחה',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  RESOLVED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-600',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'נמוך',
  MEDIUM: 'בינוני',
  HIGH: 'גבוה',
  URGENT: 'דחוף',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

interface RequestRecord {
  id: string
  title: string
  description?: string | null
  type: string
  status: string
  priority: string
  source: string
  attachments: string[]
  isAiGenerated: boolean
  aiNote?: string | null
  clientId: string
  projectId?: string | null
  createdAt: string
  client?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
}

interface ClientOption {
  id: string
  name: string
}

/**
 * One link per attached file. A WhatsApp request can arrive with a voice note
 * and a screenshot together, so linking only the first file would hide the rest.
 */
function AttachmentLinks({
  attachments,
  onOpen,
  className = '',
}: {
  attachments: string[]
  onOpen: (path: string) => void
  className?: string
}) {
  if (!attachments?.length) return null

  return (
    <>
      {attachments.map((path, index) => (
        <button
          key={path}
          type="button"
          className={`text-xs text-blue-600 underline ${className}`}
          onClick={(e) => {
            e.stopPropagation()
            onOpen(path)
          }}
        >
          {attachments.length > 1 ? `קובץ ${index + 1}` : 'צפייה בקובץ'}
        </button>
      ))}
    </>
  )
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [pending, setPending] = useState<RequestRecord[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [clientFilter, setClientFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RequestRecord | undefined>(undefined)
  const [actingOn, setActingOn] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const response = await api.get('/requests?pendingReview=true')
      setPending(response.data)
    } catch {
      setPending([])
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (clientFilter !== 'ALL') params.set('clientId', clientFilter)
      if (search.trim()) params.set('search', search.trim())

      const response = await api.get(`/requests?${params.toString()}`)
      setRequests(response.data)
    } catch {
      toast.error('שגיאה בטעינת בקשות')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, clientFilter, search])

  useEffect(() => {
    fetchPending()
    const fetchClients = async () => {
      try {
        const response = await api.get('/clients')
        setClients(response.data)
      } catch {
        setClients([])
      }
    }
    fetchClients()
  }, [fetchPending])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchRequests()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchRequests, search])

  const refetchAll = () => {
    fetchRequests()
    fetchPending()
  }

  const handleAction = async (id: string, action: 'approve' | 'dismiss') => {
    // Approving twice is not free: it is the operation that creates the task and
    // messages the client, so a double click must not fire two requests.
    if (actingOn) return
    setActingOn(id)
    try {
      await api.post(`/requests/${id}/action`, { action })
      toast.success(action === 'approve' ? 'הבקשה אושרה' : 'הבקשה נדחתה')
      refetchAll()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בעדכון בקשה')
    } finally {
      setActingOn(null)
    }
  }

  const openCreate = () => {
    setEditing(undefined)
    setShowForm(true)
  }

  const openEdit = (request: RequestRecord) => {
    setEditing(request)
    setShowForm(true)
  }

  const openAttachment = async (id: string, path: string) => {
    const tab = window.open('', '_blank')
    if (!tab) {
      toast.error('הדפדפן חסם את פתיחת הקובץ. אפשרו חלונות קופצים ונסו שוב')
      return
    }
    try {
      const { data } = await api.get(`/requests/${id}/attachment?path=${encodeURIComponent(path)}`)
      tab.location.href = data.url
    } catch {
      tab.close()
      toast.error('שגיאה בפתיחת הקובץ')
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">בקשות לקוחות</h1>
          <p className="text-sm text-gray-500 mt-1">
            בקשות, תקלות ושיפורים שהלקוחות ביקשו
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 ml-2" />
          בקשה חדשה
        </Button>
      </div>

      {/* Pending review queue */}
      {pending.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Sparkles className="w-5 h-5" />
              ממתין לאישור ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-white"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={TYPE_COLORS[request.type] ?? ''} variant="secondary">
                        {TYPE_LABELS[request.type] ?? request.type}
                      </Badge>
                      {request.source === 'FORM' && (
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800">
                          טופס
                        </Badge>
                      )}
                      {request.isAiGenerated && (
                        <Badge variant="secondary" className="bg-violet-100 text-violet-800">
                          AI
                        </Badge>
                      )}
                      <span className="text-sm font-medium">{request.title}</span>
                      <AttachmentLinks
                        attachments={request.attachments}
                        onOpen={(path) => openAttachment(request.id, path)}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {request.client?.name ?? '-'}
                      {request.aiNote ? ` · ${request.aiNote}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={actingOn === request.id}
                      onClick={() => handleAction(request.id, 'approve')}
                    >
                      <Check className="w-4 h-4 ml-1" />
                      אשר
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingOn === request.id}
                      onClick={() => handleAction(request.id, 'dismiss')}
                    >
                      <X className="w-4 h-4 ml-1" />
                      דחה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="search"
            placeholder="חיפוש בקשה..."
            className="pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הסטטוסים</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="סוג" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הסוגים</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="לקוח" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הלקוחות</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">אין בקשות</p>
          <p className="text-sm mt-1">צור בקשה חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">כותרת</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">עדיפות</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">פרויקט</TableHead>
                <TableHead className="text-right">תאריך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(request)}
                >
                  <TableCell className="font-medium">
                    {request.title}
                    {request.isAiGenerated && (
                      <Sparkles className="inline w-3 h-3 text-violet-500 mr-1" />
                    )}
                    <AttachmentLinks
                      attachments={request.attachments}
                      onOpen={(path) => openAttachment(request.id, path)}
                      className="mr-2"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge className={TYPE_COLORS[request.type] ?? ''} variant="secondary">
                        {TYPE_LABELS[request.type] ?? request.type}
                      </Badge>
                      {request.source === 'FORM' && (
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800">
                          טופס
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[request.status] ?? ''} variant="secondary">
                      {STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={PRIORITY_COLORS[request.priority] ?? ''} variant="secondary">
                      {PRIORITY_LABELS[request.priority] ?? request.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{request.client?.name ?? '-'}</TableCell>
                  <TableCell>{request.project?.name ?? '-'}</TableCell>
                  <TableCell>{formatDate(request.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RequestForm
        request={editing}
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={refetchAll}
      />
    </div>
  )
}
