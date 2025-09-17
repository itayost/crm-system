import { NextRequest } from 'next/server'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import axios from 'axios'

// POST /api/whatsapp/debug - Debug WhatsApp setup
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()

    const WHATSAPP_API_VERSION = 'v17.0'
    const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`
    const token = process.env.WHATSAPP_API_TOKEN
    const phoneId = process.env.WHATSAPP_PHONE_ID

    // Step 1: Check phone number format
    const formattedPhone = phone.replace(/\D/g, '')

    // Step 2: Try to check if number is on WhatsApp
    try {
      const checkResponse = await axios.get(
        `${WHATSAPP_API_URL}/${phoneId}/phone_numbers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      )

      console.log('Business phone numbers:', checkResponse.data)
    } catch (error) {
      console.error('Error checking phone numbers:', error)
    }

    // Step 3: Try sending with different parameters
    const messagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: 'Test message from CRM system - Debug mode'
      }
    }

    console.log('Sending message with payload:', JSON.stringify(messagePayload, null, 2))

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneId}/messages`,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    // Step 4: Get message status
    const messageId = response.data.messages?.[0]?.id
    if (messageId) {
      // Try to get message status
      try {
        const statusResponse = await axios.get(
          `${WHATSAPP_API_URL}/${messageId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }
        )
        console.log('Message status:', statusResponse.data)
      } catch {
        console.log('Could not fetch message status')
      }
    }

    return createResponse({
      success: true,
      formatted_phone: formattedPhone,
      message_id: messageId,
      response: response.data,
      troubleshooting: {
        phone_format_ok: formattedPhone.length >= 10,
        api_response_ok: response.status === 200,
        message_id_received: !!messageId,
        tips: [
          '1. Make sure the number is registered on WhatsApp',
          '2. Add the number to your Meta App test numbers',
          '3. The recipient may need to message your business first',
          '4. Check WhatsApp Business Manager for message status'
        ]
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = (error as unknown as { response?: { data?: unknown } })?.response?.data || null

    console.error('Debug error:', errorDetails || errorMessage)

    return errorResponse(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        tips: [
          'Check if number is in your test numbers',
          'Verify the number has WhatsApp',
          'Check Meta Business Manager for errors'
        ]
      }, null, 2),
      400
    )
  }
}