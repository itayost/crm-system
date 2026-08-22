import { defineTool } from 'eve/tools'
import { configuredProjects, createRepoTools } from '@/lib/services/support-repo-tools'
import { markRepoSearched, supportRuntime } from '../lib/support-runtime'
import { REPO_SPECS, execOptions } from '../lib/support-tool-specs'
import { NOT_A_SUPPORT_TURN } from '../lib/support-tool-result'

/**
 * Repo access for the writing client's own projects, named `listProjectFiles` because
 * the Hebrew system prompt refers to it by that name.
 *
 * The configured projects are read per turn rather than carried, because they
 * decide which repositories this client may reach at all. An empty list means
 * the tool refuses by name, which is what the shared implementation already does.
 */
export default defineTool({
  description: REPO_SPECS.listProjectFiles.description,
  inputSchema: REPO_SPECS.listProjectFiles.inputSchema,
  execute: async (input, ctx) => {
    const runtime = await supportRuntime(ctx)
    if (!runtime) return NOT_A_SUPPORT_TURN

    const projects = await configuredProjects(runtime.context)
    const activity = { fired: false }
    const result = await createRepoTools(runtime.context, projects, activity).listProjectFiles.execute!(
      input,
      execOptions(ctx.callId)
    )

    // The findings GC after the turn needs to know the repo was touched, and
    // the flag has to outlive this module's stack frame to be readable there.
    if (activity.fired) markRepoSearched()

    return result
  },
})
