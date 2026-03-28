'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowRight,
  Edit,
  Trash2,
  Phone,
  Mail,
  Building2,
  Star,
  Plus,
  Briefcase,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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

const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  COMPLETED: 'הושלם',
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-700',
}

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING']

interface Project {
  id: string
  name: string
  type: string
  status: string
  price?: number | string | null
  deadline?: string | null
}

interface ContactDetail {
  id: string
  name: string
  phone: string
  email?: string | null
  company?: string | null
  status: string
  source: string
  estimatedBudget?: number | string | null
  projectType?: string | null
  isVip: boolean
  address?: string | null
  taxId?: string | null
  notes?: string | null
  convertedAt?: string | null
  createdAt: string
  updatedAt: string
  projects: Project[]
}

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [converting, setConverting] = useState(false)

  const fetchContact = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get(`/contacts/${id}`)
      setContact(response.data)
    } catch {
      toast.error('שגיאה בטעינת פרטי איש קשר')
      router.push('/contacts')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchContact()
  }, [fetchContact])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/contacts/${id}`)
      toast.success('איש קשר נמחק בהצלחה')
      router.push('/contacts')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה במחיקת איש קשר')
    } finally {
      setDeleting(false)
    }
  }

  const handleConvertToClient = async () => {
    setConverting(true)
    try {
      await api.put(`/contacts/${id}`, { status: 'CLIENT' })
      toast.success('הליד הומר ללקוח בהצלחה')
      fetchContact()
    } catch {
      toast.error('שגיאה בהמרה ללקוח')
    } finally {
      setConverting(false)
    }
  }

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

  const isLead = contact ? LEAD_STATUSES.includes(contact.status) : false

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>איש קשר לא נמצא</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button + Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/contacts')}
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {contact.name}
            </h1>
            {contact.isVip && (
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            )}
            <Badge
              className={STATUS_COLORS[contact.status] ?? ''}
              variant="secondary"
            >
              {STATUS_LABELS[contact.status] ?? contact.status}
            </Badge>
          </div>
          {contact.company && (
            <p className="text-sm text-gray-500 mt-1">{contact.company}</p>
          )}
        </div>

        <div className="flex gap-2">
          {isLead && (
            <Button
              onClick={handleConvertToClient}
              disabled={converting}
              variant="default"
            >
              {converting ? 'ממיר...' : 'המר ללקוח'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4 ml-2" />
            עריכה
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="w-4 h-4 ml-2" />
                מחיקה
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת איש קשר</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את {contact.name}? פעולה זו
                  אינה ניתנת לביטול.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  מחק
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי איש קשר</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">טלפון:</span>
                <a
                  href={`tel:${contact.phone}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                  dir="ltr"
                >
                  {contact.phone}
                </a>
              </div>
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">אימייל:</span>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">חברה:</span>
                  <span className="text-sm font-medium">{contact.company}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">מקור:</span>
                <span className="text-sm font-medium">
                  {SOURCE_LABELS[contact.source] ?? contact.source}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {contact.estimatedBudget != null && (
                <div>
                  <span className="text-sm text-gray-600">תקציב משוער: </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(contact.estimatedBudget)}
                  </span>
                </div>
              )}
              {contact.projectType && (
                <div>
                  <span className="text-sm text-gray-600">סוג פרויקט: </span>
                  <span className="text-sm font-medium">
                    {contact.projectType}
                  </span>
                </div>
              )}
              {contact.address && (
                <div>
                  <span className="text-sm text-gray-600">כתובת: </span>
                  <span className="text-sm font-medium">{contact.address}</span>
                </div>
              )}
              {contact.taxId && (
                <div>
                  <span className="text-sm text-gray-600">ח.פ / ע.מ: </span>
                  <span className="text-sm font-medium">{contact.taxId}</span>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">נוצר בתאריך: </span>
                <span className="text-sm font-medium">
                  {formatDate(contact.createdAt)}
                </span>
              </div>
              {contact.convertedAt && (
                <div>
                  <span className="text-sm text-gray-600">
                    הומר ללקוח בתאריך:{' '}
                  </span>
                  <span className="text-sm font-medium">
                    {formatDate(contact.convertedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {contact.notes && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600 mb-1">הערות:</p>
              <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects Section (for clients) */}
      {contact.status === 'CLIENT' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>פרויקטים</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                router.push(`/projects?new=true&contactId=${contact.id}`)
              }
            >
              <Plus className="w-4 h-4 ml-2" />
              פרויקט חדש
            </Button>
          </CardHeader>
          <CardContent>
            {contact.projects.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                אין פרויקטים עדיין
              </p>
            ) : (
              <div className="space-y-3">
                {contact.projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/projects/${project.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        router.push(`/projects/${project.id}`)
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {project.name}
                      </span>
                      <Badge
                        className={
                          PROJECT_STATUS_COLORS[project.status] ?? ''
                        }
                        variant="secondary"
                      >
                        {PROJECT_STATUS_LABELS[project.status] ??
                          project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {project.price != null && (
                        <span>{formatCurrency(project.price)}</span>
                      )}
                      {project.deadline && (
                        <span>{formatDate(project.deadline)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Form Dialog */}
      <ContactForm
        contact={contact}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={fetchContact}
      />
    </div>
  )
}
