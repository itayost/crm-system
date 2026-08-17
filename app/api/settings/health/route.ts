import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { isBotPaused } from '@/lib/config/bot-pause'

/**
 * Which integrations are wired, as booleans.
 *
 * This is the page you open when the bot has gone quiet, so it reports
 * *presence* and never a value. Nothing here can leak a key: every field is the
 * result of a truthiness check performed on the server, and the response body
 * contains no secret-shaped string at all.
 */
const present = (name: string) => Boolean((process.env[name] ?? '').trim())

export const GET = withAuth(async (_req: NextRequest) => {
  return createResponse({
    botPaused: isBotPaused(),
    waha: present('WAHA_API_URL') && present('WAHA_API_KEY'),
    whatsappWebhook: present('WHATSAPP_WEBHOOK_SECRET'),
    ownerPhone: present('OWNER_PHONE'),
    github: present('GITHUB_TOKEN'),
    publicLeads: present('PUBLIC_LEAD_SECRET'),
    ollama: present('OLLAMA_BASE_URL'),
  })
})
