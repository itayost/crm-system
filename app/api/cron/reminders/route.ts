// app/api/cron/reminders/route.ts
import { NextRequest } from 'next/server'
import { createResponse } from '@/lib/api/api-handler'
import { mockDb } from '@/lib/api/mock-db'

// GET /api/cron/reminders - Send payment reminders
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const now = new Date()
  const threeDaysFromNow = new Date(now)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  
  // Find payments due in 3 days
  const upcomingPayments = mockDb.payments.filter(p => {
    if (p.status !== 'PENDING') return false
    const dueDate = new Date(p.dueDate)
    return dueDate.toDateString() === threeDaysFromNow.toDateString()
  })
  
  // Send reminders (mock)
  const reminders = upcomingPayments.map(payment => {
    const client = mockDb.clients.find(c => c.id === payment.clientId)
    return {
      type: 'PAYMENT_REMINDER',
      clientName: client?.name,
      amount: payment.amount,
      dueDate: payment.dueDate,
      message: `Payment reminder: ₪${payment.amount} due in 3 days`,
    }
  })
  
  // TODO: Send actual reminders via WhatsApp/Email
  console.log('Payment reminders:', reminders)
  
  return createResponse({
    success: true,
    remindersSent: reminders.length,
    reminders,
  })
}