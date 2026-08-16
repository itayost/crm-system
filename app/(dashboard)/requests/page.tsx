'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Search, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
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
import { PendingReviewCard } from '@/components/requests/pending-review-card'
import { AwaitingClientCard } from '@/components/requests/awaiting-client-card'
import { AttachmentLinks } from '@/components/requests/attachment-links'
import { AiMark, SourceIcon } from '@/components/requests/request-badges'
import {
  toneOf,
  emphasisOf,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  REQUEST_STATUS_TONES,
  REQUEST_TYPE_TONES,
} from '@/lib/design/tones'
import {
  label,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/design/labels'
import type { RequestRecord } from '@/lib/types/request'

interface ClientOption {
  id: string
  name: string
}

export default function RequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [pending, setPending] = useState<RequestRecord[]>([])
  const [awaiting, setAwaiting] = useState<RequestRecord[]>([])
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

  const fetchAwaiting = useCallback(async () => {
    try {
      const response = await api.get('/requests?awaitingClient=true')
      setAwaiting(response.data)
    } catch {
      setAwaiting([])
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter)
      } else {
        // Drafts already sit in the pending-review queue above the table;
        // listing them twice made the page read as double the real workload.
        params.set('excludePending', 'true')
      }
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (clientFilter !== 'ALL') params.set('clientId', clientFilter)
      if (search.trim()) params.set('search', search.trim())

      const response = await api.get(`/requests?${params.toString()}`)
      setRequests(response.data)
    } catch {
      toast.error('שגיאה בטעינת פניות')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, clientFilter, search])

  useEffect(() => {
    fetchPending()
    fetchAwaiting()
    const fetchClients = async () => {
      try {
        const response = await api.get('/clients')
        setClients(response.data)
      } catch {
        setClients([])
      }
    }
    fetchClients()
  }, [fetchPending, fetchAwaiting])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchRequests()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchRequests, search])

  const refetchAll = () => {
    fetchRequests()
    fetchPending()
    fetchAwaiting()
  }

  const handleAction = async (id: string, action: 'approve' | 'dismiss') => {
    // Approving twice is not free: it is the operation that creates the task and
    // messages the client, so a double click must not fire two requests.
    if (actingOn) return
    setActingOn(id)
    try {
      await api.post(`/requests/${id}/action`, { action })
      toast.success(action === 'approve' ? 'הפניה אושרה' : 'הפניה נדחתה')
      refetchAll()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בעדכון הפניה')
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
          <h1 className="text-2xl font-bold text-content-strong">פניות לקוחות</h1>
          <p className="text-sm text-content-subtle mt-1">
            בקשות, תקלות ושיפורים שהלקוחות ביקשו
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 ml-2" />
          פניה חדשה
        </Button>
      </div>

      <PendingReviewCard
        pending={pending}
        actingOn={actingOn}
        onAction={handleAction}
        onOpenAttachment={openAttachment}
      />

      <AwaitingClientCard awaiting={awaiting} />

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-faint w-4 h-4" />
          <Input
            type="search"
            placeholder="חיפוש פניה..."
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
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, statusLabel]) => (
              <SelectItem key={value} value={value}>
                {statusLabel}
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
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, typeLabel]) => (
              <SelectItem key={value} value={value}>
                {typeLabel}
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
        <div className="text-center py-12 text-content-subtle">
          <p className="text-lg font-medium">אין פניות</p>
          <p className="text-sm mt-1">צור פניה חדשה כדי להתחיל</p>
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
                <TableHead className="text-right w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/requests/${request.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{request.title}</span>
                      <AiMark isAiGenerated={request.isAiGenerated} />
                      <SourceIcon source={request.source} />
                      <AttachmentLinks
                        attachments={request.attachments}
                        onOpen={(path) => openAttachment(request.id, path)}
                      />
                    </div>
                  </TableCell>
                  {/* Metadata: a dot for the hue, body text for the word. */}
                  <TableCell>
                    <StatusPill tone={toneOf(REQUEST_TYPE_TONES, request.type)} emphasis="quiet" dot>
                      {label(REQUEST_TYPE_LABELS, request.type)}
                    </StatusPill>
                  </TableCell>
                  {/* The one pill in the row, and so the one the eye lands on. */}
                  <TableCell>
                    <StatusPill tone={toneOf(REQUEST_STATUS_TONES, request.status)} dot>
                      {label(REQUEST_STATUS_LABELS, request.status)}
                    </StatusPill>
                  </TableCell>
                  {/* Silent unless it is not. */}
                  <TableCell>
                    <StatusPill
                      tone={toneOf(PRIORITY_TONES, request.priority)}
                      emphasis={emphasisOf(PRIORITY_EMPHASIS, request.priority)}
                    >
                      {label(PRIORITY_LABELS, request.priority)}
                    </StatusPill>
                  </TableCell>
                  <TableCell>{request.client?.name ?? '-'}</TableCell>
                  <TableCell>{request.project?.name ?? '-'}</TableCell>
                  <TableCell>{formatDate(request.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="עריכה מהירה"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(request)
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
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
