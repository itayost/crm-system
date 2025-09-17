// components/forms/project-form.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

interface Client {
  id: string
  name: string
  company?: string
  type: string
}

interface ProjectFormProps {
  onSubmit: (data: unknown) => void
  onCancel: () => void
}

export function ProjectForm({ onSubmit, onCancel }: ProjectFormProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'WEBSITE',
    clientId: '',
    budget: '',
    estimatedHours: '',
    deadline: '',
    priority: 'MEDIUM',
    startDate: new Date().toISOString().split('T')[0], // Today's date
  })
  
  useEffect(() => {
    fetchClients()
  }, [])
  
  const fetchClients = async () => {
    try {
      const response = await api.get('/clients?status=ACTIVE')
      setClients(response.data)
      // If only one client, auto-select it
      if (response.data.length === 1) {
        setFormData(prev => ({ ...prev, clientId: response.data[0].id }))
      }
    } catch (error) {
      toast.error('שגיאה בטעינת לקוחות')
    } finally {
      setLoadingClients(false)
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clientId) {
      toast.error('יש לבחור לקוח')
      return
    }
    
    if (!formData.name) {
      toast.error('שם הפרויקט חובה')
      return
    }
    
    onSubmit({
      ...formData,
      budget: formData.budget ? Number(formData.budget) : undefined,
      estimatedHours: formData.estimatedHours ? Number(formData.estimatedHours) : undefined,
    })
  }
  
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Selection - First and most important */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="client">לקוח *</Label>
          <Select 
            value={formData.clientId} 
            onValueChange={(value) => handleChange('clientId', value)}
            disabled={loadingClients}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingClients ? "טוען לקוחות..." : "בחר לקוח"} />
            </SelectTrigger>
            <SelectContent>
              {clients.length === 0 ? (
                <SelectItem value="none" disabled>
                  אין לקוחות פעילים במערכת
                </SelectItem>
              ) : (
                clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.company && `(${client.company})`}
                    {client.type === 'VIP' && ' ⭐'}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {clients.length === 0 && !loadingClients && (
            <p className="text-sm text-amber-600">
              יש להוסיף לקוחות למערכת לפני יצירת פרויקט
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="name">שם הפרויקט *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            placeholder="אתר תדמית לחברה"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="type">סוג פרויקט *</Label>
          <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LANDING_PAGE">דף נחיתה</SelectItem>
              <SelectItem value="WEBSITE">אתר תדמית</SelectItem>
              <SelectItem value="ECOMMERCE">חנות אונליין</SelectItem>
              <SelectItem value="WEB_APP">אפליקציית ווב</SelectItem>
              <SelectItem value="MOBILE_APP">אפליקציה</SelectItem>
              <SelectItem value="MANAGEMENT_SYSTEM">מערכת ניהול</SelectItem>
              <SelectItem value="CONSULTATION">ייעוץ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="budget">תקציב</Label>
          <Input
            id="budget"
            type="number"
            value={formData.budget}
            onChange={(e) => handleChange('budget', e.target.value)}
            placeholder="₪"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="estimatedHours">שעות משוערות</Label>
          <Input
            id="estimatedHours"
            type="number"
            value={formData.estimatedHours}
            onChange={(e) => handleChange('estimatedHours', e.target.value)}
            placeholder="40"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="startDate">תאריך התחלה</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="deadline">דדליין</Label>
          <Input
            id="deadline"
            type="date"
            value={formData.deadline}
            onChange={(e) => handleChange('deadline', e.target.value)}
            min={formData.startDate} // Deadline must be after start date
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="priority">עדיפות</Label>
          <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">נמוכה</SelectItem>
              <SelectItem value="MEDIUM">בינונית</SelectItem>
              <SelectItem value="HIGH">גבוהה</SelectItem>
              <SelectItem value="URGENT">דחוף</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">תיאור</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="תיאור הפרויקט..."
          rows={3}
        />
      </div>
      
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button 
          type="submit" 
          disabled={clients.length === 0 || loadingClients}
        >
          {loadingClients ? 'טוען...' : 'צור פרויקט'}
        </Button>
      </div>
    </form>
  )
}