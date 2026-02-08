// app/(dashboard)/leads/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Phone, Mail, MessageSquare, MoreVertical, ChevronRight, UserPlus, Trash, Edit, Clock } from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger 
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LeadForm } from '@/components/forms/lead-form'
import { ReminderDialog } from '@/components/notifications/reminder-dialog'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

const statusColors = {
  NEW: 'bg-red-100 text-red-800 border-red-300',
  CONTACTED: 'bg-orange-100 text-orange-800 border-orange-300',
  QUOTED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  NEGOTIATING: 'bg-blue-100 text-blue-800 border-blue-300',
  CONVERTED: 'bg-green-100 text-green-800 border-green-300',
  LOST: 'bg-gray-100 text-gray-800 border-gray-300',
}

const statusLabels = {
  NEW: 'חדש',
  CONTACTED: 'יצרתי קשר',
  QUOTED: 'הצעת מחיר',
  NEGOTIATING: 'משא ומתן',
  CONVERTED: 'הומר ללקוח',
  LOST: 'אבוד',
}

export default function LeadsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingLead, setEditingLead] = useState<{
    id: string
    name: string
    email: string
    phone: string
    status: string
    source: string
    notes?: string
    company?: string
    projectType?: string
    estimatedBudget?: number
    createdAt: string
  } | null>(null)
  const [leads, setLeads] = useState<Array<{
    id: string
    name: string
    email: string
    phone: string
    status: string
    source: string
    notes?: string
    company?: string
    projectType?: string
    estimatedBudget?: number
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [reminderLead, setReminderLead] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    fetchLeads()
  }, [])
  
  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads')
      setLeads(response.data)
    } catch {
      toast.error('שגיאה בטעינת לידים')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCreateLead = async (data: unknown) => {
    try {
      const response = await api.post('/leads', data)
      setLeads([response.data, ...leads])
      setShowCreateForm(false)
      if (response.data._warning) {
        toast(response.data._warning, { icon: '⚠️', duration: 5000 })
      }
      toast.success('ליד נוסף בהצלחה!')
    } catch {
      toast.error('שגיאה ביצירת ליד')
    }
  }

  const handleUpdateLead = async (data: unknown) => {
    if (!editingLead) return
    try {
      const response = await api.put(`/leads/${editingLead.id}`, data)
      setLeads(leads.map(lead => lead.id === editingLead.id ? response.data : lead))
      setEditingLead(null)
      toast.success('ליד עודכן בהצלחה')
    } catch {
      toast.error('שגיאה בעדכון ליד')
    }
  }
  
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    try {
      const response = await api.put(`/leads/${leadId}`, { status: newStatus })
      setLeads(leads.map(lead => 
        lead.id === leadId ? response.data : lead
      ))
      toast.success('סטטוס עודכן בהצלחה')
    } catch {
      toast.error('שגיאה בעדכון סטטוס')
    }
  }
  
  const handleConvertToClient = async (leadId: string) => {
    try {
      const response = await api.post(`/leads/${leadId}/convert`)
      setLeads(leads.map(lead => 
        lead.id === leadId ? response.data.lead : lead
      ))
      toast.success('הליד הומר ללקוח בהצלחה!')
    } catch {
      toast.error('שגיאה בהמרת הליד ללקוח')
    }
  }
  
  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק ליד זה?')) return
    
    try {
      await api.delete(`/leads/${leadId}`)
      setLeads(leads.filter(lead => lead.id !== leadId))
      toast.success('ליד נמחק בהצלחה')
    } catch {
      toast.error('שגיאה במחיקת ליד')
    }
  }
  
  // Group leads by status
  const leadsByStatus = leads.reduce((acc: Record<string, typeof leads>, lead) => {
    if (!acc[lead.status]) acc[lead.status] = []
    acc[lead.status].push(lead)
    return acc
  }, {})
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-6 h-full">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">ניהול לידים</h1>
          <p className="text-gray-600 mt-1">
            {leads.length} לידים סה&quot;כ • {leadsByStatus.NEW?.length || 0} חדשים
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 ml-2" />
          ליד חדש
        </Button>
      </div>
      
      {/* Leads Pipeline - Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 px-1 -mx-1" style={{ scrollbarWidth: 'thin' }}>
        {Object.entries(statusLabels).map(([status, label]) => (
          <div key={status} className="min-w-[350px] flex-shrink-0">
            <div className="bg-gray-100 rounded-t-lg p-3 border-b-2 border-gray-300">
              <h3 className="font-bold text-sm">
                {label}
                {leadsByStatus[status] && (
                  <Badge variant="secondary" className="mr-2">
                    {leadsByStatus[status].length}
                  </Badge>
                )}
              </h3>
            </div>
            <div className="bg-gray-50 min-h-[500px] max-h-[700px] overflow-y-auto p-3 space-y-3 rounded-b-lg">
              {leadsByStatus[status]?.map((lead) => (
                <Card 
                  key={lead.id} 
                  className={`hover:shadow-md transition-shadow border-r-4 ${statusColors[lead.status as keyof typeof statusColors]}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold flex-1 break-words">{lead.name}</h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {status === 'NEW' && (
                            <Badge variant="destructive" className="text-xs">
                              חדש!
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* Edit Lead */}
                              <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                                <Edit className="ml-2 h-4 w-4" />
                                ערוך ליד
                              </DropdownMenuItem>

                              {/* Status Update */}
                              {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
                                <>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <ChevronRight className="ml-2 h-4 w-4" />
                                      שנה סטטוס
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {Object.entries(statusLabels)
                                        .filter(([key]) => key !== lead.status)
                                        .map(([key, label]) => (
                                          <DropdownMenuItem
                                            key={key}
                                            onClick={() => handleUpdateStatus(lead.id, key)}
                                          >
                                            {label}
                                          </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  
                                  {/* Convert to Client */}
                                  <DropdownMenuItem
                                    onClick={() => handleConvertToClient(lead.id)}
                                    className="text-green-600"
                                  >
                                    <UserPlus className="ml-2 h-4 w-4" />
                                    המר ללקוח
                                  </DropdownMenuItem>

                                  {/* Set Reminder */}
                                  <DropdownMenuItem onClick={() => setReminderLead({ id: lead.id, name: lead.name })}>
                                    <Clock className="ml-2 h-4 w-4" />
                                    תזכורת מעקב
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />
                                </>
                              )}
                              
                              {/* Delete Lead */}
                              {lead.status !== 'CONVERTED' && (
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="text-red-600"
                                >
                                  <Trash className="ml-2 h-4 w-4" />
                                  מחק ליד
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {lead.company && (
                        <p className="text-sm text-gray-600">{lead.company}</p>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />
                        <span>{lead.phone}</span>
                      </div>
                      
                      {lead.email && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="w-3 h-3" />
                          <span>{lead.email}</span>
                        </div>
                      )}
                      
                      {lead.projectType && (
                        <Badge variant="outline" className="text-xs">
                          {lead.projectType}
                        </Badge>
                      )}
                      
                      {lead.notes && (
                        <p className="text-xs text-gray-600 italic line-clamp-2">
                          &quot;{lead.notes}&quot;
                        </p>
                      )}
                      
                      <div className="flex gap-1 pt-2 border-t">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${lead.phone}`;
                          }}
                        >
                          <Phone className="w-3 h-3 ml-1" />
                          התקשר
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank');
                          }}
                        >
                          <MessageSquare className="w-3 h-3 ml-1" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {(!leadsByStatus[status] || leadsByStatus[status].length === 0) && (
                <div className="text-center text-gray-400 text-sm py-8">
                  אין לידים בסטטוס זה
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ליד חדש</DialogTitle>
          </DialogHeader>
          <LeadForm
            onSubmit={handleCreateLead}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>עריכת ליד</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <LeadForm
              onSubmit={handleUpdateLead}
              onCancel={() => setEditingLead(null)}
              initialData={{
                name: editingLead.name,
                email: editingLead.email,
                phone: editingLead.phone,
                company: editingLead.company || '',
                source: editingLead.source,
                projectType: editingLead.projectType || '',
                estimatedBudget: editingLead.estimatedBudget?.toString() || '',
                notes: editingLead.notes || '',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      {reminderLead && (
        <ReminderDialog
          open={!!reminderLead}
          onOpenChange={(open) => !open && setReminderLead(null)}
          entityType="Lead"
          entityId={reminderLead.id}
          entityName={reminderLead.name}
        />
      )}
    </div>
  )
}