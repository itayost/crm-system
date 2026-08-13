import { afterEach, describe, expect, it } from 'vitest'
import { isBotPaused } from '@/lib/config/bot-pause'

afterEach(() => {
  delete process.env.WHATSAPP_BOT_PAUSED
})

describe('isBotPaused', () => {
  it('runs when the switch is unset', () => {
    delete process.env.WHATSAPP_BOT_PAUSED

    expect(isBotPaused()).toBe(false)
  })

  it('runs when the switch is explicitly off', () => {
    for (const value of ['', '   ', '0', 'false', 'FALSE', 'off', 'no']) {
      process.env.WHATSAPP_BOT_PAUSED = value

      expect(isBotPaused()).toBe(false)
    }
  })

  // A pause is something someone reached for on purpose. Anything other than a
  // recognised "off" therefore pauses, so a typo leaves the bot quiet rather
  // than talking to clients while its owner believes it is stopped.
  it('pauses on any other value', () => {
    for (const value of ['1', 'true', 'TRUE', 'on', 'yes', 'paused-for-migration']) {
      process.env.WHATSAPP_BOT_PAUSED = value

      expect(isBotPaused()).toBe(true)
    }
  })
})
