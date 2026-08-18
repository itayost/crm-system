import { defineTool } from 'eve/tools'
import { createSupportTools } from '@/lib/services/support-tools'
import { supportRuntime } from '../lib/support-runtime'
import { SUPPORT_SPECS, execOptions } from '../lib/support-tool-specs'
import { NOT_A_SUPPORT_TURN } from '../lib/support-tool-result'

/**
 * The filename is the model-facing name, and the Hebrew system prompt names this
 * tool directly, so it must stay `listMyProjects`.
 *
 * The body is not reimplemented here. The same factory the AI SDK path uses is
 * built with this turn's context and its executor called, so both runtimes share
 * one implementation and one set of scoping rules.
 */
export default defineTool({
  description: SUPPORT_SPECS.listMyProjects.description,
  inputSchema: SUPPORT_SPECS.listMyProjects.inputSchema,
  execute: async (input, ctx) => {
    const runtime = await supportRuntime(ctx)
    if (!runtime) return NOT_A_SUPPORT_TURN

    return createSupportTools(runtime.context).listMyProjects.execute!(
      input,
      execOptions(ctx.callId)
    )
  },
})
