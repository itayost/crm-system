'use client'

import { useState } from 'react'

interface LeadCaptureFormProps {
  apiUrl?: string
  onSuccess?: () => void
  className?: string
}

export default function LeadCaptureForm({
  apiUrl = '/api/public/leads',
  onSuccess,
  className = ''
}: LeadCaptureFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    projectType: '',
    estimatedBudget: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const dataToSend = {
        ...formData,
        estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
        source: 'WEBSITE'
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({
          type: 'success',
          text: result.message || 'הטופס נשלח בהצלחה! ניצור איתך קשר בקרוב.'
        })
        setFormData({
          name: '',
          phone: '',
          email: '',
          company: '',
          projectType: '',
          estimatedBudget: '',
          notes: ''
        })
        onSuccess?.()
      } else {
        setMessage({
          type: 'error',
          text: result.message || 'אירעה שגיאה. נסה שוב מאוחר יותר.'
        })
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'אירעה שגיאה בשליחת הטופס. נסה שוב מאוחר יותר.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className={`max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg ${className}`}>
      <h2 className="text-2xl font-semibold mb-6 text-center">צור קשר</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            <span className="text-red-500">*</span> שם מלא
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            <span className="text-red-500">*</span> טלפון
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            pattern="[0-9]{9,10}"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            אימייל
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium mb-1">
            שם החברה
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="projectType" className="block text-sm font-medium mb-1">
            סוג הפרויקט
          </label>
          <select
            id="projectType"
            name="projectType"
            value={formData.projectType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">בחר סוג פרויקט</option>
            <option value="דף נחיתה">דף נחיתה</option>
            <option value="אתר תדמית">אתר תדמית</option>
            <option value="חנות אונליין">חנות אונליין</option>
            <option value="אפליקציית ווב">אפליקציית ווב</option>
            <option value="אפליקציה נייטיב">אפליקציה נייטיב</option>
            <option value="מערכת ניהול">מערכת ניהול</option>
            <option value="ייעוץ">ייעוץ</option>
            <option value="אחר">אחר</option>
          </select>
        </div>

        <div>
          <label htmlFor="estimatedBudget" className="block text-sm font-medium mb-1">
            תקציב משוער (₪)
          </label>
          <input
            type="number"
            id="estimatedBudget"
            name="estimatedBudget"
            value={formData.estimatedBudget}
            onChange={handleChange}
            min="0"
            step="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            הערות נוספות
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            placeholder="ספר לנו עוד על הפרויקט שלך..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'שולח...' : 'שלח'}
        </button>
      </form>
    </div>
  )
}