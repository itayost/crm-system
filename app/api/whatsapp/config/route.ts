import { NextRequest } from 'next/server'
import { createResponse } from '@/lib/api/api-handler'

// GET /api/whatsapp/config - Check WhatsApp configuration status
export async function GET(req: NextRequest) {
  const config = {
    hasToken: !!process.env.WHATSAPP_API_TOKEN,
    tokenLength: process.env.WHATSAPP_API_TOKEN?.length || 0,
    hasPhoneId: !!process.env.WHATSAPP_PHONE_ID,
    phoneId: process.env.WHATSAPP_PHONE_ID || 'not set',
    hasBusinessId: !!process.env.WHATSAPP_BUSINESS_ID,
    businessId: process.env.WHATSAPP_BUSINESS_ID || 'not set',
    hasOwnerPhone: !!process.env.OWNER_PHONE,
    ownerPhone: process.env.OWNER_PHONE || 'not set',
    nodeEnv: process.env.NODE_ENV,
  }

  console.log('WhatsApp Configuration Status:', config)

  return createResponse({
    configured: config.hasToken && config.hasPhoneId,
    config: {
      ...config,
      // Mask the token for security
      tokenPreview: config.hasToken ?
        `${process.env.WHATSAPP_API_TOKEN?.substring(0, 10)}...${process.env.WHATSAPP_API_TOKEN?.slice(-10)}` :
        'not set'
    }
  })
}