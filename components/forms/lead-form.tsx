// components/forms/lead-form.tsx
'use client'

import { useState } from 'react'
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

interface LeadFormData {
  name: string
  email: string
  phone: string
  company: string
  source: string
  projectType: string
  estimatedBudget: string
  notes: string
}

interface LeadFormProps {
  onSubmit: (data: unknown) => void
  onCancel: () => void
  initialData?: Partial<LeadFormData>
}

const defaults: LeadFormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  source: 'WEBSITE',
  projectType: '',
  estimatedBudget: '',
  notes: '',
}

export function LeadForm({ onSubmit, onCancel, initialData }: LeadFormProps) {
  const [formData, setFormData] = useState<LeadFormData>({
    ...defaults,
    ...initialData,
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      estimatedBudget: formData.estimatedBudget ? Number(formData.estimatedBudget) : undefined,
    })
  }
  
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">שם מלא *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            placeholder="ישראל ישראלי"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">טלפון *</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            required
            placeholder="050-1234567"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="company">חברה</Label>
          <Input
            id="company"
            value={formData.company}
            onChange={(e) => handleChange('company', e.target.value)}
            placeholder="שם החברה"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="source">מקור הליד *</Label>
          <Select value={formData.source} onValueChange={(value) => handleChange('source', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEBSITE">אתר</SelectItem>
              <SelectItem value="PHONE">טלפון</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="REFERRAL">המלצה</SelectItem>
              <SelectItem value="OTHER">אחר</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="projectType">סוג פרויקט</Label>
          <Select value={formData.projectType} onValueChange={(value) => handleChange('projectType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="בחר סוג פרויקט" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="אתר תדמית">אתר תדמית</SelectItem>
              <SelectItem value="חנות אונליין">חנות אונליין</SelectItem>
              <SelectItem value="אפליקציה">אפליקציה</SelectItem>
              <SelectItem value="מערכת ניהול">מערכת ניהול</SelectItem>
              <SelectItem value="דף נחיתה">דף נחיתה</SelectItem>
              <SelectItem value="ייעוץ">ייעוץ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="estimatedBudget">תקציב משוער</Label>
          <Input
            id="estimatedBudget"
            type="number"
            value={formData.estimatedBudget}
            onChange={(e) => handleChange('estimatedBudget', e.target.value)}
            placeholder="₪"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">הערות</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="פרטים נוספים על הליד..."
          rows={3}
        />
      </div>
      
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit">
          {initialData ? 'עדכן ליד' : 'שמור ליד'}
        </Button>
      </div>
    </form>
  )
}