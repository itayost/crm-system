import { NextRequest } from 'next/server'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { WhatsAppService } from '@/lib/services/whatsapp.service'
import { withAuth } from '@/lib/api/auth-handler'

// POST /api/whatsapp/test - Test WhatsApp integration
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const { phone } = await req.json()

    if (!phone) {
      return errorResponse('Phone number is required', 400)
    }

    // Send a test message
    const testMessage = `🧪 בדיקת מערכת CRM

זוהי הודעת בדיקה מהמערכת.
אם קיבלת הודעה זו, האינטגרציה עם WhatsApp פועלת כראוי!

✅ המערכת מוכנה לשליחת התראות
📱 מספר: ${phone}
🕐 זמן: ${new Date().toLocaleString('he-IL')}

בהצלחה!`

    const result = await WhatsAppService.sendTextMessage(phone, testMessage)

    return createResponse({
      success: true,
      message: 'Test message sent successfully',
      messageId: result.messages[0]?.id,
      to: result.contacts[0]?.wa_id,
    })
  } catch (error) {
    console.error('Test message error:', error)

    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }

    return errorResponse('Failed to send test message', 500)
  }
})