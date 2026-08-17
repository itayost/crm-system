'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
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
import { ProjectForm } from '@/components/forms/project-form'
import {
  toneOf,
  emphasisOf,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  PROJECT_STATUS_TONES,
} from '@/lib/design/tones'
import {
  label,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PRIORITY_LABELS,
} from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { projectTotal } from '@/lib/utils/project-money'
import type { ProjectListItem } from '@/lib/types/project'

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'הכל' },
  { value: 'ACTIVE', label: 'פעיל' },
  { value: 'COMPLETED', label: 'הושלם' },
]

function ProjectsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [defaultClientId, setDefaultClientId] = useState<string | undefined>(
    undefined
  )

  // Check if opened with ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      const clientId = searchParams.get('clientId')
      if (clientId) {
        setDefaultClientId(clientId)
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">פרויקטים</h1>
          <p className="text-sm text-content-subtle mt-1">ניהול ומעקב פרויקטים</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          פרויקט חדש
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-faint w-4 h-4" />
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
        <div className="text-center py-12 text-content-subtle">
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
                <TableHead>שם</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>עדיפות</TableHead>
                <TableHead>דדליין</TableHead>
                <TableHead>סה&quot;כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  key={project.id}
                  data-testid="row"
                  data-row-id={project.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <TableCell data-col="name" className="font-medium">
                    {project.name}
                  </TableCell>
                  <TableCell data-col="client">{project.client?.name ?? '-'}</TableCell>
                  <TableCell data-col="type">
                    {label(PROJECT_TYPE_LABELS, project.type)}
                  </TableCell>
                  <TableCell data-col="status">
                    <StatusPill tone={toneOf(PROJECT_STATUS_TONES, project.status)} dot>
                      {label(PROJECT_STATUS_LABELS, project.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell data-col="priority">
                    <StatusPill
                      tone={toneOf(PRIORITY_TONES, project.priority)}
                      emphasis={emphasisOf(PRIORITY_EMPHASIS, project.priority)}
                    >
                      {label(PRIORITY_LABELS, project.priority)}
                    </StatusPill>
                  </TableCell>
                  <TableCell data-col="deadline">{formatDate(project.deadline)}</TableCell>
                  <TableCell data-col="total">
                    {formatCurrency(projectTotal(project.advanceAmount, project.phases))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Form Dialog */}
      <ProjectForm
        defaultClientId={defaultClientId}
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)
          if (!open) {
            setDefaultClientId(undefined)
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
