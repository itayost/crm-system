import { NextRequest } from 'next/server'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { WhatsAppService } from '@/lib/services/whatsapp.service'

// GET /api/whatsapp/webhook - Verify webhook (required by Meta)
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Check if this is a webhook verification request
    if (mode && token) {
      // Check the mode and token sent are correct
      if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
        // Respond with the challenge token from the request
        console.log('WhatsApp webhook verified successfully')
        return new Response(challenge, { status: 200 })
      } else {
        // Respond with '403 Forbidden' if verify tokens do not match
        console.error('WhatsApp webhook verification failed')
        return new Response('Forbidden', { status: 403 })
      }
    }

    return errorResponse('Invalid webhook verification request', 400)
  } catch (error) {
    console.error('Webhook verification error:', error)
    return errorResponse('Webhook verification failed', 500)
  }
}

// POST /api/whatsapp/webhook - Receive WhatsApp events
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-hub-signature-256') || ''

    // Verify the webhook signature
    if (!WhatsAppService.verifyWebhook(signature, body)) {
      console.error('Invalid webhook signature')
      return errorResponse('Invalid signature', 401)
    }

    const data = JSON.parse(body)

    // Process webhook events
    if (data.entry && data.entry.length > 0) {
      for (const entry of data.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            const value = change.value

            // Handle message status updates
            if (value.statuses && value.statuses.length > 0) {
              for (const status of value.statuses) {
                console.log('Message status update:', {
                  id: status.id,
                  status: status.status,
                  timestamp: status.timestamp,
                  recipient: status.recipient_id,
                })

                // You can add database logging here
                // Example: Track delivery status, read receipts, etc.
              }
            }

            // Handle incoming messages
            if (value.messages && value.messages.length > 0) {
              for (const message of value.messages) {
                console.log('Incoming WhatsApp message:', {
                  from: message.from,
                  type: message.type,
                  text: message.text?.body,
                  timestamp: message.timestamp,
                })

                // You can add auto-reply logic here
                // Example: Send confirmation, forward to support, etc.
              }
            }
          }
        }
      }
    }

    // Always return 200 OK to acknowledge receipt
    return createResponse({ success: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    // Still return 200 to prevent webhook retries
    return createResponse({ success: true })
  }
}