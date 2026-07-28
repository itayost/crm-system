import { Phone, Mail, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { label, CONTACT_SOURCE_LABELS } from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ContactRecord } from '@/lib/types/contact'

/** The static half of the contact detail page - no state, so no client boundary. */
export function ContactInfoCard({ contact }: { contact: ContactRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטי איש קשר</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-content-faint" />
              <span className="text-sm text-content-muted">טלפון:</span>
              <a
                href={`tel:${contact.phone}`}
                className="text-sm font-medium text-link hover:underline"
                dir="ltr"
              >
                {contact.phone}
              </a>
            </div>
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">אימייל:</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-sm font-medium text-link hover:underline"
                >
                  {contact.email}
                </a>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">חברה:</span>
                <span className="text-sm font-medium">{contact.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-content-muted">מקור:</span>
              <span className="text-sm font-medium">
                {label(CONTACT_SOURCE_LABELS, contact.source)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {contact.estimatedBudget != null && (
              <div>
                <span className="text-sm text-content-muted">תקציב משוער: </span>
                <span className="text-sm font-medium">
                  {formatCurrency(contact.estimatedBudget)}
                </span>
              </div>
            )}
            {contact.projectType && (
              <div>
                <span className="text-sm text-content-muted">סוג פרויקט: </span>
                <span className="text-sm font-medium">{contact.projectType}</span>
              </div>
            )}
            {contact.address && (
              <div>
                <span className="text-sm text-content-muted">כתובת: </span>
                <span className="text-sm font-medium">{contact.address}</span>
              </div>
            )}
            {contact.taxId && (
              <div>
                <span className="text-sm text-content-muted">ח.פ / ע.מ: </span>
                <span className="text-sm font-medium">{contact.taxId}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-content-muted">נוצר בתאריך: </span>
              <span className="text-sm font-medium">{formatDate(contact.createdAt)}</span>
            </div>
            {contact.convertedAt && (
              <div>
                <span className="text-sm text-content-muted">הומר ללקוח בתאריך: </span>
                <span className="text-sm font-medium">{formatDate(contact.convertedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {contact.notes && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-content-muted mb-1">הערות:</p>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
