/**
 * Morning (Green Invoice) API Service
 * Israeli invoicing system integration
 * API Documentation: https://www.greeninvoice.co.il/api-docs
 */

import { BaseService } from './base.service'

// Environment configuration
const MORNING_API_URL = process.env.MORNING_API_URL || 'https://api.greeninvoice.co.il/api/v1'
const MORNING_API_KEY = process.env.MORNING_API_KEY
const MORNING_API_SECRET = process.env.MORNING_API_SECRET
const ENABLE_MORNING = process.env.ENABLE_MORNING_INTEGRATION === 'true'

// Document types in Morning system
export const MORNING_DOCUMENT_TYPES = {
  PRICE_QUOTE: 10,           // הצעת מחיר
  ORDER: 100,                // הזמנה
  DELIVERY_NOTE: 200,        // תעודת משלוח
  RETURN_NOTE: 210,          // תעודת החזרה
  INVOICE: 300,              // חשבונית עסקה
  TAX_INVOICE: 305,          // חשבונית מס
  TAX_INVOICE_RECEIPT: 320,  // חשבונית מס קבלה
  RECEIPT: 400,              // קבלה
  CREDIT_NOTE: 330,          // חשבונית זיכוי
  DONATION_RECEIPT: 405      // קבלה על תרומה
} as const

// Payment types
export const MORNING_PAYMENT_TYPES = {
  CASH: 1,
  CHECK: 2,
  CREDIT_CARD: 3,
  EFT: 4,                    // העברה בנקאית
  PAYPAL: 5,
  PAYMENT_APP: 10,
  OTHER: 11
} as const

// Document statuses
export const MORNING_DOC_STATUS = {
  OPEN: 0,
  CLOSED: 1,
  CLOSED_MANUALLY: 2
} as const

// Retainer (recurring) frequencies
export const MORNING_RETAINER_FREQUENCY = {
  MONTHLY: 1,      // חודשי
  BI_MONTHLY: 2,   // דו-חודשי
  QUARTERLY: 3,    // רבעוני
  SEMI_ANNUAL: 6,  // חצי שנתי
  ANNUAL: 12       // שנתי
} as const

// Retainer statuses
export const MORNING_RETAINER_STATUS = {
  ACTIVE: 0,
  PAUSED: 1,
  COMPLETED: 2,
  CANCELLED: 3
} as const

interface MorningAuthResponse {
  token: string
  expiresAt: number
}

interface MorningClient {
  id?: string
  name: string
  emails?: string[]
  phone?: string
  mobile?: string
  taxId?: string          // ח.פ / ע.מ
  address?: string
  city?: string
  country?: string        // ISO code (e.g., "IL")
  accountingKey?: string
  paymentTerms?: number   // Days until payment due
  add?: boolean           // Add to client list
}

interface MorningDocumentItem {
  description: string
  quantity: number
  price: number
  currency?: string       // Default: ILS
  vatType?: number        // 0=exempt, 1=included, 2=excluded
}

interface MorningPayment {
  type: number            // MORNING_PAYMENT_TYPES
  amount: number
  currency?: string
  date?: string           // ISO date
  bankName?: string
  bankBranch?: string
  bankAccount?: string
  checkNum?: string
  cardType?: number
  cardNum?: string
  dealType?: number
  numPayments?: number
}

interface CreateDocumentInput {
  type: number
  client: MorningClient
  income: MorningDocumentItem[]
  payment?: MorningPayment[]
  currency?: string
  lang?: 'he' | 'en'
  vatType?: number
  dueDate?: string
  remarks?: string
  footer?: string
  emailContent?: string
  attachment?: boolean
  signed?: boolean
}

interface MorningDocument {
  id: string
  number: number
  type: number
  status: number
  date: string
  dueDate: string
  amount: number
  amountBeforeVat: number
  vat: number
  client: MorningClient
  url?: {
    origin: string
    he: string
    en: string
  }
}

interface MorningRetainer {
  id?: string
  clientId: string
  client?: MorningClient
  type: number              // Document type to generate
  income: MorningDocumentItem[]
  frequency: number         // MORNING_RETAINER_FREQUENCY
  startDate: string         // ISO date
  endDate?: string          // ISO date (optional - infinite if not set)
  status?: number           // MORNING_RETAINER_STATUS
  nextDate?: string         // Next invoice date
  occurrences?: number      // Number of invoices generated
  remarks?: string
}

interface CreateRetainerInput {
  clientName: string
  clientEmail?: string
  clientPhone?: string
  clientTaxId?: string
  description: string
  amount: number
  frequency: number         // MORNING_RETAINER_FREQUENCY value
  startDate: string         // ISO date
  endDate?: string          // ISO date
  remarks?: string
}

// Token cache
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

export class MorningService extends BaseService {
  /**
   * Check if Morning integration is enabled
   */
  static isEnabled(): boolean {
    return ENABLE_MORNING && !!MORNING_API_KEY && !!MORNING_API_SECRET
  }

  /**
   * Get JWT token for API authentication
   */
  private static async getToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (cachedToken && tokenExpiresAt > Date.now() + 300000) {
      return cachedToken
    }

    if (!MORNING_API_KEY || !MORNING_API_SECRET) {
      throw new Error('Morning API credentials not configured')
    }

    try {
      const response = await fetch(`${MORNING_API_URL}/account/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: MORNING_API_KEY,
          secret: MORNING_API_SECRET
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.errorMessage || 'Failed to authenticate with Morning API')
      }

      const data: MorningAuthResponse = await response.json()
      cachedToken = data.token
      // Token expires in 1 hour, but we refresh a bit earlier
      tokenExpiresAt = Date.now() + 55 * 60 * 1000

      return data.token
    } catch (error) {
      console.error('Morning authentication error:', error)
      throw new Error('שגיאה בהתחברות למערכת Morning')
    }
  }

  /**
   * Make authenticated API request
   */
  private static async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getToken()

    const response = await fetch(`${MORNING_API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errorMessage: 'Unknown error' }))
      console.error('Morning API error:', error)
      throw new Error(error.errorMessage || `Morning API error: ${response.status}`)
    }

    return response.json()
  }

  // ============================================
  // CLIENT OPERATIONS
  // ============================================

  /**
   * Get all clients from Morning
   */
  static async getClients(page = 0, pageSize = 100): Promise<MorningClient[]> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    const result = await this.apiRequest<{ items: MorningClient[] }>(
      '/clients/search',
      'POST',
      { page, pageSize }
    )

    return result.items
  }

  /**
   * Get a single client by ID
   */
  static async getClient(clientId: string): Promise<MorningClient> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<MorningClient>(`/clients/${clientId}`)
  }

  /**
   * Create a new client in Morning
   */
  static async createClient(client: MorningClient): Promise<MorningClient> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<MorningClient>('/clients', 'POST', client as unknown as Record<string, unknown>)
  }

  /**
   * Update an existing client
   */
  static async updateClient(clientId: string, client: Partial<MorningClient>): Promise<MorningClient> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<MorningClient>(`/clients/${clientId}`, 'PUT', client as Record<string, unknown>)
  }

  /**
   * Search clients by name, email, or tax ID
   */
  static async searchClients(query: string): Promise<MorningClient[]> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    const result = await this.apiRequest<{ items: MorningClient[] }>(
      '/clients/search',
      'POST',
      {
        name: query,
        page: 0,
        pageSize: 50
      }
    )

    return result.items
  }

  // ============================================
  // DOCUMENT OPERATIONS
  // ============================================

  /**
   * Create a new document (invoice, receipt, quote, etc.)
   */
  static async createDocument(input: CreateDocumentInput): Promise<MorningDocument> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    const documentData = {
      type: input.type,
      client: input.client,
      income: input.income,
      payment: input.payment || [],
      currency: input.currency || 'ILS',
      lang: input.lang || 'he',
      vatType: input.vatType ?? 1, // Default: VAT included
      dueDate: input.dueDate,
      remarks: input.remarks,
      footer: input.footer,
      emailContent: input.emailContent,
      attachment: input.attachment ?? true,
      signed: input.signed ?? true
    }

    return this.apiRequest<MorningDocument>('/documents', 'POST', documentData)
  }

  /**
   * Create a tax invoice (חשבונית מס)
   */
  static async createTaxInvoice(params: {
    clientName: string
    clientEmail?: string
    clientPhone?: string
    clientTaxId?: string
    items: Array<{ description: string; quantity: number; price: number }>
    dueDate?: string
    remarks?: string
  }): Promise<MorningDocument> {
    const input: CreateDocumentInput = {
      type: MORNING_DOCUMENT_TYPES.TAX_INVOICE,
      client: {
        name: params.clientName,
        emails: params.clientEmail ? [params.clientEmail] : undefined,
        phone: params.clientPhone,
        taxId: params.clientTaxId,
        add: true // Add to client list if new
      },
      income: params.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        currency: 'ILS',
        vatType: 1 // VAT included
      })),
      dueDate: params.dueDate,
      remarks: params.remarks
    }

    return this.createDocument(input)
  }

  /**
   * Create a tax invoice with receipt (חשבונית מס קבלה)
   */
  static async createTaxInvoiceReceipt(params: {
    clientName: string
    clientEmail?: string
    clientPhone?: string
    clientTaxId?: string
    items: Array<{ description: string; quantity: number; price: number }>
    paymentType: number
    remarks?: string
  }): Promise<MorningDocument> {
    const totalAmount = params.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)

    const input: CreateDocumentInput = {
      type: MORNING_DOCUMENT_TYPES.TAX_INVOICE_RECEIPT,
      client: {
        name: params.clientName,
        emails: params.clientEmail ? [params.clientEmail] : undefined,
        phone: params.clientPhone,
        taxId: params.clientTaxId,
        add: true
      },
      income: params.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        currency: 'ILS',
        vatType: 1
      })),
      payment: [{
        type: params.paymentType,
        amount: totalAmount,
        currency: 'ILS',
        date: new Date().toISOString().split('T')[0]
      }],
      remarks: params.remarks
    }

    return this.createDocument(input)
  }

  /**
   * Create a receipt (קבלה)
   */
  static async createReceipt(params: {
    clientName: string
    clientEmail?: string
    amount: number
    paymentType: number
    description: string
    remarks?: string
  }): Promise<MorningDocument> {
    const input: CreateDocumentInput = {
      type: MORNING_DOCUMENT_TYPES.RECEIPT,
      client: {
        name: params.clientName,
        emails: params.clientEmail ? [params.clientEmail] : undefined,
        add: true
      },
      income: [{
        description: params.description,
        quantity: 1,
        price: params.amount,
        currency: 'ILS',
        vatType: 0 // No VAT for receipts
      }],
      payment: [{
        type: params.paymentType,
        amount: params.amount,
        currency: 'ILS',
        date: new Date().toISOString().split('T')[0]
      }],
      remarks: params.remarks
    }

    return this.createDocument(input)
  }

  /**
   * Create a price quote (הצעת מחיר)
   */
  static async createQuote(params: {
    clientName: string
    clientEmail?: string
    clientPhone?: string
    items: Array<{ description: string; quantity: number; price: number }>
    validUntil?: string
    remarks?: string
  }): Promise<MorningDocument> {
    const input: CreateDocumentInput = {
      type: MORNING_DOCUMENT_TYPES.PRICE_QUOTE,
      client: {
        name: params.clientName,
        emails: params.clientEmail ? [params.clientEmail] : undefined,
        phone: params.clientPhone,
        add: true
      },
      income: params.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        currency: 'ILS',
        vatType: 1
      })),
      dueDate: params.validUntil,
      remarks: params.remarks
    }

    return this.createDocument(input)
  }

  /**
   * Get a document by ID
   */
  static async getDocument(documentId: string): Promise<MorningDocument> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<MorningDocument>(`/documents/${documentId}`)
  }

  /**
   * Search documents
   */
  static async searchDocuments(params: {
    type?: number
    status?: number
    fromDate?: string
    toDate?: string
    page?: number
    pageSize?: number
  }): Promise<{ items: MorningDocument[]; total: number }> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<{ items: MorningDocument[]; total: number }>(
      '/documents/search',
      'POST',
      {
        type: params.type ? [params.type] : undefined,
        status: params.status,
        fromDate: params.fromDate,
        toDate: params.toDate,
        page: params.page || 0,
        pageSize: params.pageSize || 50,
        sort: 'documentDate',
        sortType: 'desc'
      }
    )
  }

  /**
   * Get document download links
   */
  static async getDocumentLinks(documentId: string): Promise<{ origin: string; copy: string }> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<{ origin: string; copy: string }>(`/documents/${documentId}/download`)
  }

  /**
   * Close a document manually
   */
  static async closeDocument(documentId: string): Promise<MorningDocument> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<MorningDocument>(`/documents/${documentId}/close`, 'POST')
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Map CRM client to Morning client format
   */
  static mapCrmClientToMorning(crmClient: {
    name: string
    email?: string
    phone?: string
    company?: string
    taxId?: string
    address?: string
  }): MorningClient {
    return {
      name: crmClient.company || crmClient.name,
      emails: crmClient.email ? [crmClient.email] : undefined,
      phone: crmClient.phone,
      taxId: crmClient.taxId,
      address: crmClient.address,
      country: 'IL',
      add: true
    }
  }

  /**
   * Create invoice for CRM payment
   */
  static async createInvoiceForPayment(params: {
    clientName: string
    clientEmail?: string
    clientPhone?: string
    clientTaxId?: string
    projectName: string
    amount: number
    dueDate?: string
    notes?: string
  }): Promise<MorningDocument> {
    return this.createTaxInvoice({
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      clientPhone: params.clientPhone,
      clientTaxId: params.clientTaxId,
      items: [{
        description: params.projectName,
        quantity: 1,
        price: params.amount
      }],
      dueDate: params.dueDate,
      remarks: params.notes
    })
  }

  /**
   * Get business info
   */
  static async getBusinessInfo(): Promise<Record<string, unknown>> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<Record<string, unknown>>('/businesses/me')
  }

  /**
   * Test connection to Morning API
   */
  static async testConnection(): Promise<{ success: boolean; businessName?: string; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'Morning integration is not enabled' }
    }

    try {
      const business = await this.getBusinessInfo()
      return {
        success: true,
        businessName: (business as { name?: string }).name
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================
  // RETAINER (RECURRING PAYMENTS) OPERATIONS
  // ============================================

  /**
   * Create a retainer (recurring invoice schedule)
   * This will automatically generate invoices on the specified schedule
   */
  static async createRetainer(input: CreateRetainerInput): Promise<MorningRetainer> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    const retainerData = {
      type: MORNING_DOCUMENT_TYPES.TAX_INVOICE, // Generate tax invoices
      client: {
        name: input.clientName,
        emails: input.clientEmail ? [input.clientEmail] : undefined,
        phone: input.clientPhone,
        taxId: input.clientTaxId,
        add: true
      },
      income: [{
        description: input.description,
        quantity: 1,
        price: input.amount,
        currency: 'ILS',
        vatType: 1 // VAT included
      }],
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate,
      remarks: input.remarks,
      lang: 'he',
      currency: 'ILS'
    }

    return this.apiRequest<MorningRetainer>('/retainers', 'POST', retainerData)
  }

  /**
   * Create a maintenance retainer (תשלום תחזוקה חודשי)
   * Common use case for website/app maintenance contracts
   */
  static async createMaintenanceRetainer(params: {
    clientName: string
    clientEmail?: string
    clientPhone?: string
    amount: number
    serviceName: string        // e.g., "תחזוקת אתר", "תמיכה טכנית"
    frequency?: number         // Default: MONTHLY
    startDate?: string         // Default: today
    endDate?: string           // Optional end date
  }): Promise<MorningRetainer> {
    const startDate = params.startDate || new Date().toISOString().split('T')[0]

    return this.createRetainer({
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      clientPhone: params.clientPhone,
      description: params.serviceName,
      amount: params.amount,
      frequency: params.frequency || MORNING_RETAINER_FREQUENCY.MONTHLY,
      startDate,
      endDate: params.endDate,
      remarks: `תשלום חוזר: ${params.serviceName}`
    })
  }

  /**
   * Get all retainers
   */
  static async getRetainers(params?: {
    status?: number
    page?: number
    pageSize?: number
  }): Promise<{ items: MorningRetainer[]; total: number }> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<{ items: MorningRetainer[]; total: number }>(
      '/retainers/search',
      'POST',
      {
        status: params?.status,
        page: params?.page || 0,
        pageSize: params?.pageSize || 50
      }
    )
  }

  /**
   * Get a single retainer by ID
   */
  static async getRetainer(retainerId: string): Promise<MorningRetainer> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    return this.apiRequest<MorningRetainer>(`/retainers/${retainerId}`)
  }

  /**
   * Update a retainer
   */
  static async updateRetainer(
    retainerId: string,
    data: Partial<{
      amount: number
      description: string
      frequency: number
      endDate: string
      status: number
    }>
  ): Promise<MorningRetainer> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    const updateData: Record<string, unknown> = {}

    if (data.amount !== undefined) {
      updateData.income = [{
        description: data.description || 'שירות',
        quantity: 1,
        price: data.amount,
        currency: 'ILS',
        vatType: 1
      }]
    }

    if (data.frequency !== undefined) {
      updateData.frequency = data.frequency
    }

    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate
    }

    if (data.status !== undefined) {
      updateData.status = data.status
    }

    return this.apiRequest<MorningRetainer>(`/retainers/${retainerId}`, 'PUT', updateData)
  }

  /**
   * Pause a retainer
   */
  static async pauseRetainer(retainerId: string): Promise<MorningRetainer> {
    return this.updateRetainer(retainerId, { status: MORNING_RETAINER_STATUS.PAUSED })
  }

  /**
   * Resume a paused retainer
   */
  static async resumeRetainer(retainerId: string): Promise<MorningRetainer> {
    return this.updateRetainer(retainerId, { status: MORNING_RETAINER_STATUS.ACTIVE })
  }

  /**
   * Cancel a retainer
   */
  static async cancelRetainer(retainerId: string): Promise<MorningRetainer> {
    return this.updateRetainer(retainerId, { status: MORNING_RETAINER_STATUS.CANCELLED })
  }

  /**
   * Get retainer invoices (documents generated by a retainer)
   */
  static async getRetainerInvoices(retainerId: string): Promise<MorningDocument[]> {
    if (!this.isEnabled()) {
      throw new Error('Morning integration is not enabled')
    }

    const result = await this.apiRequest<{ items: MorningDocument[] }>(
      `/retainers/${retainerId}/documents`,
      'GET'
    )

    return result.items
  }
}
