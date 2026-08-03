'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, Edit, Trash2, Building2, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
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
import { ContactStatusSelect } from '@/components/contacts/contact-status-select'
import { NextActionEditor } from '@/components/contacts/next-action-editor'
import { ContactInfoCard } from '@/components/contacts/contact-info-card'
import { ContactProjectsCard } from '@/components/contacts/contact-projects-card'
import { LEAD_STATUSES } from '@/lib/validations/enums'
import { toneOf, CONTACT_STATUS_TONES } from '@/lib/design/tones'
import { label, CONTACT_STATUS_LABELS } from '@/lib/design/labels'
import type { ContactRecord } from '@/lib/types/contact'

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [contact, setContact] = useState<ContactRecord | null>(null)
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

  // LOST is not in LEAD_STATUSES, so a dead lead loses the convert button but
  // keeps the status Select - reviving it is a status change, not a conversion.
  const isLead = contact ? (LEAD_STATUSES as readonly string[]).includes(contact.status) : false
  const isPipeline = isLead || contact?.status === 'LOST'

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
      <div className="text-center py-12 text-content-subtle">
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
            <h1 className="text-2xl font-bold text-content-strong">
              {contact.name}
            </h1>
            {contact.isVip && (
              <Star role="img" aria-label="VIP" className="w-5 h-5 text-marker-vip fill-marker-vip" />
            )}
            {isPipeline ? (
              <ContactStatusSelect
                contactId={contact.id}
                status={contact.status}
                onChanged={fetchContact}
              />
            ) : (
              <StatusPill tone={toneOf(CONTACT_STATUS_TONES, contact.status)} dot>
                {label(CONTACT_STATUS_LABELS, contact.status)}
              </StatusPill>
            )}
          </div>
          {contact.company && (
            <p className="text-sm text-content-subtle mt-1">{contact.company}</p>
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

      {isPipeline && (
        <NextActionEditor
          contactId={contact.id}
          nextActionAt={contact.nextActionAt}
          nextActionNote={contact.nextActionNote}
          onChanged={fetchContact}
        />
      )}

      <ContactInfoCard contact={contact} />

      {/* Business link (for clients) */}
      {contact.client && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-content-faint" />
              <span className="text-sm text-content-muted">עסק:</span>
              <button
                className="text-sm font-medium text-link hover:underline"
                onClick={() => router.push(`/clients/${contact.client!.id}`)}
              >
                {contact.client.name}
              </button>
              {contact.role && (
                <StatusPill tone="neutral" emphasis="quiet">
                  {contact.role}
                </StatusPill>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyed off the business, not the status: an INACTIVE client still has
          projects worth looking at. */}
      {contact.client && (
        <ContactProjectsCard
          clientId={contact.client.id}
          projects={contact.client.projects}
        />
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
