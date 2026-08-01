import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The lifeline plumbing: env-gated local model, two-tier fallback runner, and
 * the degraded reply that stands in for the support agent during an outage.
 */

const generateTextSpy = vi.fn()

vi.mock('ai', () => ({
  generateText: (args: unknown) => generateTextSpy(args),
}))

const createProviderSpy = vi.fn()
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: (config: unknown) => {
    createProviderSpy(config)
    return (modelId: string) => `ollama:${modelId}`
  },
}))

vi.mock('@ai-sdk/gateway', () => ({
  GatewayError: { isInstance: () => false },
}))

const { degradedSupportReply, ollamaModel, withModelFallback } = await import(
  '@/lib/ai/resilient-model'
)

const CLIENT = {
  contactName: 'דנה',
  clientName: 'מסעדת הגן',
  projectNames: ['אתר הזמנות'],
  lastMessage: 'הכפתור לא עובד',
}

describe('the local model tier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('OLLAMA_BASE_URL', 'https://ollama.example.com/v1')
    vi.stubEnv('OLLAMA_API_KEY', 'test-key')
    vi.stubEnv('OLLAMA_MODEL', 'gemma-test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('steps aside when the endpoint is not configured', async () => {
    vi.stubEnv('OLLAMA_BASE_URL', '')

    expect(ollamaModel()).toBeNull()
    expect(await degradedSupportReply(CLIENT)).toBeNull()
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it('wires the provider from the env', () => {
    expect(ollamaModel()).toBe('ollama:gemma-test')
    expect(createProviderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://ollama.example.com/v1',
        apiKey: 'test-key',
      })
    )
  })

  it('writes a short bounded acknowledgement that must not claim a ticket', async () => {
    generateTextSpy.mockResolvedValue({ text: ' קיבלתי, איתי יחזור אליך. ' })

    const reply = await degradedSupportReply(CLIENT)

    expect(reply).toBe('קיבלתי, איתי יחזור אליך.')
    const args = generateTextSpy.mock.calls[0][0]
    expect(args.maxOutputTokens).toBe(200)
    expect(args.abortSignal).toBeInstanceOf(AbortSignal)
    expect(args.system).toContain('דנה')
    expect(args.system).toContain('מסעדת הגן')
    expect(args.system).toContain('אתר הזמנות')
    expect(args.system).toContain('אסור לומר שנפתחה פנייה')
    expect(args.prompt).toContain('הכפתור לא עובד')
  })

  it('returns null instead of throwing when the local model fails or goes empty', async () => {
    generateTextSpy.mockRejectedValueOnce(new Error('timeout'))
    expect(await degradedSupportReply(CLIENT)).toBeNull()

    generateTextSpy.mockResolvedValueOnce({ text: '   ' })
    expect(await degradedSupportReply(CLIENT)).toBeNull()
  })
})

describe('withModelFallback', () => {
  it('returns the primary result without touching the fallback', async () => {
    const fallback = vi.fn()

    const result = await withModelFallback(async () => 'primary', fallback)

    expect(result).toBe('primary')
    expect(fallback).not.toHaveBeenCalled()
  })

  it('falls back on any primary failure and reports it', async () => {
    const onFallback = vi.fn()

    const result = await withModelFallback(
      async () => {
        throw new Error('insufficient_funds')
      },
      async () => 'fallback',
      onFallback
    )

    expect(result).toBe('fallback')
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error))
  })

  it('rethrows the fallback error when both tiers fail', async () => {
    await expect(
      withModelFallback(
        async () => {
          throw new Error('primary down')
        },
        async () => {
          throw new Error('fallback down')
        }
      )
    ).rejects.toThrow('fallback down')
  })
})
