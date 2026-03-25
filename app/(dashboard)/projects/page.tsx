'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { ProjectForm } from '@/components/forms/project-form'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'טיוטה',
  IN_PROGRESS: 'בתהליך',
  ON_HOLD: 'מושהה',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const TYPE_LABELS: Record<string, string> = {
  LANDING_PAGE: 'דף נחיתה',
  WEBSITE: 'אתר',
  ECOMMERCE: 'חנות אונליין',
  WEB_APP: 'אפליקציית ווב',
  MOBILE_APP: 'אפליקציה',
  MANAGEMENT_SYSTEM: 'מערכת ניהול',
  CONSULTATION: 'ייעוץ',
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

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'הכל' },
  { value: 'DRAFT', label: 'טיוטה' },
  { value: 'IN_PROGRESS', label: 'בתהליך' },
  { value: 'ON_HOLD', label: 'מושהה' },
  { value: 'COMPLETED', label: 'הושלם' },
  { value: 'CANCELLED', label: 'בוטל' },
]

interface Project {
  id: string
  name: string
  type: string
  status: string
  priority: string
  price?: number | string | null
  deadline?: string | null
  contact: {
    id: string
    name: string
    company?: string | null
  }
  _count: {
    tasks: number
  }
}

function ProjectsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [defaultContactId, setDefaultContactId] = useState<string | undefined>(
    undefined
  )

  // Check if opened with ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      const contactId = searchParams.get('contactId')
      if (contactId) {
        setDefaultContactId(contactId)
      }
      setShowForm(true)
      // Clean URL
      router.replace('/projects', { scroll: false })
    }
  }, [searchParams, router])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())

      const response = await api.get(`/projects?${params.toString()}`)
      setProjects(response.data)
    } catch {
      toast.error('שגיאה בטעינת פרויקטים')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchProjects()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchProjects, search])

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount == null) return '-'
    return `${Number(amount).toLocaleString()} ₪`
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">פרויקטים</h1>
          <p className="text-sm text-gray-500 mt-1">ניהול ומעקב פרויקטים</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 ml-2" />
          פרויקט חדש
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="search"
            placeholder="חיפוש פרויקט..."
            className="pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">אין פרויקטים</p>
          <p className="text-sm mt-1">
            {search || statusFilter !== 'ALL'
              ? 'לא נמצאו תוצאות'
              : 'צור פרויקט חדש כדי להתחיל'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">עדיפות</TableHead>
                <TableHead className="text-right">דדליין</TableHead>
                <TableHead className="text-right">מחיר</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <TableCell className="font-medium">
                    {project.name}
                  </TableCell>
                  <TableCell>
                    {project.contact.name}
                    {project.contact.company && (
                      <span className="text-xs text-gray-500 mr-1">
                        ({project.contact.company})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {TYPE_LABELS[project.type] ?? project.type}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_COLORS[project.status] ?? ''}
                      variant="secondary"
                    >
                      {STATUS_LABELS[project.status] ?? project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={PRIORITY_COLORS[project.priority] ?? ''}
                      variant="secondary"
                    >
                      {PRIORITY_LABELS[project.priority] ?? project.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(project.deadline)}</TableCell>
                  <TableCell>{formatCurrency(project.price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Form Dialog */}
      <ProjectForm
        defaultContactId={defaultContactId}
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)
          if (!open) {
            setDefaultContactId(undefined)
          }
        }}
        onSuccess={fetchProjects}
      />
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full" /></div>}>
      <ProjectsPageContent />
    </Suspense>
  )
}
