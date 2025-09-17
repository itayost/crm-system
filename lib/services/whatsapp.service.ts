import axios, { AxiosError } from 'axios'
import { BaseService } from './base.service'
import * as crypto from 'crypto'

const WHATSAPP_API_VERSION = 'v17.0'
const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`

// WhatsAppMessage interface for future use
/*
interface WhatsAppMessage {
  to: string
  message: string
  template?: string
  templateParams?: Record<string, string>
}
*/

interface WhatsAppResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

export interface MessageTemplate {
  name: string
  language: string
  category: string
  components: Array<{
    type: string
    parameters?: Array<{
      type: string
      text?: string
    }>
  }>
}

export class WhatsAppService extends BaseService {
  private static get API_TOKEN() {
    return process.env.WHATSAPP_API_TOKEN
  }

  private static get PHONE_ID() {
    return process.env.WHATSAPP_PHONE_ID
  }

  private static get BUSINESS_ID() {
    return process.env.WHATSAPP_BUSINESS_ID
  }

  /**
   * Hebrew message templates
   */
  static readonly TEMPLATES = {
    NEW_LEAD: 'new_lead_alert',
    PAYMENT_REMINDER: 'payment_reminder',
    DAILY_SUMMARY: 'daily_summary',
    PROJECT_DEADLINE: 'project_deadline',
    LEAD_FOLLOWUP: 'lead_followup',
    PAYMENT_OVERDUE: 'payment_overdue',
  }

  /**
   * Send a text message via WhatsApp
   */
  static async sendTextMessage(to: string, message: string): Promise<WhatsAppResponse> {
    const token = this.API_TOKEN
    const phoneId = this.PHONE_ID

    console.log('WhatsApp Config Check:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      hasPhoneId: !!phoneId,
      phoneId: phoneId
    })

    if (!token || !phoneId) {
      throw new Error(`WhatsApp configuration missing - Token: ${!!token}, PhoneID: ${!!phoneId}`)
    }

    try {
      const response = await axios.post<WhatsAppResponse>(
        `${WHATSAPP_API_URL}/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('WhatsApp message sent successfully:', response.data)
      return response.data
    } catch (error) {
      this.handleWhatsAppError(error)
      throw error
    }
  }

  /**
   * Send a template message via WhatsApp
   */
  static async sendTemplateMessage(
    to: string,
    templateName: string,
    params: Record<string, string> = {}
  ): Promise<WhatsAppResponse> {
    const token = this.API_TOKEN
    const phoneId = this.PHONE_ID

    if (!token || !phoneId) {
      throw new Error(`WhatsApp configuration missing - Token: ${!!token}, PhoneID: ${!!phoneId}`)
    }

    try {
      // Convert params to WhatsApp format
      const components = Object.keys(params).length > 0 ? [
        {
          type: 'body',
          parameters: Object.values(params).map(value => ({
            type: 'text',
            text: value
          }))
        }
      ] : []

      const response = await axios.post<WhatsAppResponse>(
        `${WHATSAPP_API_URL}/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.formatPhoneNumber(to),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'he' }, // Hebrew
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('WhatsApp template message sent:', response.data)
      return response.data
    } catch (error) {
      this.handleWhatsAppError(error)
      throw error
    }
  }

  /**
   * Send new lead notification
   */
  static async sendNewLeadNotification(leadData: {
    name: string
    phone: string
    source: string
    estimatedBudget?: number
  }) {
    const message = `🆕 לקוח חדש התקבל!

שם: ${leadData.name}
טלפון: ${leadData.phone}
מקור: ${this.translateSource(leadData.source)}
${leadData.estimatedBudget ? `תקציב משוער: ₪${leadData.estimatedBudget}` : ''}

⏰ יש להתקשר תוך שעתיים!`

    // Send to business owner number (you can make this configurable)
    const ownerPhone = process.env.OWNER_PHONE || '972501234567' // Replace with your number

    return this.sendTextMessage(ownerPhone, message)
  }

  /**
   * Send payment reminder
   */
  static async sendPaymentReminder(paymentData: {
    clientName: string
    amount: number
    dueDate: string
    daysUntilDue: number
  }) {
    let urgency = '💰'
    if (paymentData.daysUntilDue <= 0) {
      urgency = '🚨 דחוף!'
    } else if (paymentData.daysUntilDue <= 3) {
      urgency = '⚠️ תזכורת'
    }

    const message = `${urgency} תשלום ממתין

לקוח: ${paymentData.clientName}
סכום: ₪${paymentData.amount}
תאריך: ${paymentData.dueDate}
${paymentData.daysUntilDue > 0 ? `נותרו ${paymentData.daysUntilDue} ימים` : 'התשלום באיחור!'}

לחץ כאן לפרטים נוספים`

    const ownerPhone = process.env.OWNER_PHONE || '972501234567'
    return this.sendTextMessage(ownerPhone, message)
  }

  /**
   * Send daily summary
   */
  static async sendDailySummary(summary: {
    newLeads: number
    pendingTasks: number
    overduePayments: number
    todayRevenue: number
  }) {
    const message = `📊 סיכום יומי - ${new Date().toLocaleDateString('he-IL')}

🎯 ${summary.newLeads} לידים חדשים
📋 ${summary.pendingTasks} משימות ממתינות
${summary.overduePayments > 0 ? `⚠️ ${summary.overduePayments} תשלומים באיחור` : '✅ אין תשלומים באיחור'}
💰 הכנסות היום: ₪${summary.todayRevenue}

יום פרודוקטיבי! 🚀`

    const ownerPhone = process.env.OWNER_PHONE || '972501234567'
    return this.sendTextMessage(ownerPhone, message)
  }

  /**
   * Send project deadline warning
   */
  static async sendProjectDeadlineWarning(project: {
    name: string
    clientName: string
    daysUntilDeadline: number
    stage: string
  }) {
    const urgency = project.daysUntilDeadline <= 1 ? '🚨' : '⏰'

    const message = `${urgency} דדליין מתקרב!

פרויקט: ${project.name}
לקוח: ${project.clientName}
שלב נוכחי: ${this.translateStage(project.stage)}
נותרו: ${project.daysUntilDeadline} ימים

זמן לפעולה! 💪`

    const ownerPhone = process.env.OWNER_PHONE || '972501234567'
    return this.sendTextMessage(ownerPhone, message)
  }

  /**
   * Format phone number to WhatsApp format
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')

    // Handle Israeli numbers
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.substring(1)
    }

    // Add country code if missing
    if (!cleaned.startsWith('972')) {
      cleaned = '972' + cleaned
    }

    return cleaned
  }

  /**
   * Handle WhatsApp API errors
   */
  private static handleWhatsAppError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError

      if (axiosError.response) {
        console.error('WhatsApp API Error:', {
          status: axiosError.response.status,
          data: axiosError.response.data
        })

        if (axiosError.response.status === 401) {
          throw new Error('אימות WhatsApp נכשל - בדוק את ה-Token')
        } else if (axiosError.response.status === 404) {
          throw new Error('מספר WhatsApp לא נמצא')
        } else if (axiosError.response.status === 429) {
          throw new Error('יותר מדי הודעות - נסה שוב מאוחר יותר')
        }
      }
    }

    console.error('WhatsApp Error:', error)
    throw new Error('שליחת הודעת WhatsApp נכשלה')
  }

  /**
   * Translate lead source to Hebrew
   */
  private static translateSource(source: string): string {
    const translations: Record<string, string> = {
      'WEBSITE': 'אתר אינטרנט',
      'PHONE': 'טלפון',
      'WHATSAPP': 'וואטסאפ',
      'REFERRAL': 'המלצה',
      'OTHER': 'אחר'
    }
    return translations[source] || source
  }

  /**
   * Translate project stage to Hebrew
   */
  private static translateStage(stage: string): string {
    const translations: Record<string, string> = {
      'PLANNING': 'תכנון',
      'DEVELOPMENT': 'פיתוח',
      'TESTING': 'בדיקות',
      'REVIEW': 'סקירה',
      'DELIVERY': 'מסירה',
      'MAINTENANCE': 'תחזוקה'
    }
    return translations[stage] || stage
  }

  /**
   * Verify webhook signature from Meta
   */
  static verifyWebhook(signature: string, body: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET || '')
      .update(body)
      .digest('hex')

    return signature === `sha256=${expectedSignature}`
  }
}