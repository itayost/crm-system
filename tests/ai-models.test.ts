import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The model registry: one place that answers "which model does this job use".
 * The behaviour worth pinning is that overrides resolve at call time, because
 * the old per-service constants read the environment once at import and could
 * not be changed afterwards.
 */

const { models } = await import('@/lib/ai/models')

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the model registry', () => {
  it('falls back to the declared default when no override is set', () => {
    vi.stubEnv('SUPPORT_CHAT_MODEL', '')

    expect(models.supportChat()).toBe('anthropic/claude-sonnet-4.6')
  })

  it('uses the override when one is set', () => {
    vi.stubEnv('SUPPORT_CHAT_MODEL', 'zai/glm-5.2')

    expect(models.supportChat()).toBe('zai/glm-5.2')
  })

  it('ignores a blank override instead of asking the gateway for an empty model', () => {
    vi.stubEnv('PRODUCT_CARD_MODEL', '   ')

    expect(models.productCard()).toBe('anthropic/claude-sonnet-4.6')
  })

  it('reads the environment at call time rather than pinning it at import', () => {
    vi.stubEnv('INTAKE_MODEL', 'first/model')
    expect(models.intake()).toBe('first/model')

    vi.stubEnv('INTAKE_MODEL', 'second/model')
    expect(models.intake()).toBe('second/model')
  })

  it('keeps media off the shared text default, which cannot see images', () => {
    expect(models.media()).not.toBe(models.supportChat())
    expect(models.media()).toBe('google/gemini-2.5-flash')
  })

  it('names the local tier with an Ollama model rather than a gateway id', () => {
    expect(models.local()).toBe('gemma4:e4b')
    expect(models.local()).not.toContain('/')
  })
})
