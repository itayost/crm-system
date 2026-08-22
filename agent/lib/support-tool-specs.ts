import { createSupportTools, type SupportToolContext } from '@/lib/services/support-tools'
import { createRepoTools } from '@/lib/services/support-repo-tools'

/**
 * Descriptions and input schemas, taken from the definitions the AI SDK path
 * already uses rather than copied.
 *
 * Copying them would let the two runtimes drift, and these strings are
 * load-bearing twice over: the Hebrew system prompt instructs the model by tool
 * name, and a changed description invalidates the gateway's prefix cache.
 *
 * Building the tools needs no database - the factories only assemble objects,
 * and every query happens inside `execute` - so a placeholder context is enough
 * to read the shapes at module scope. The real context is supplied per call.
 */
const SHAPE_ONLY: SupportToolContext = {
  userId: '',
  clientId: '',
  clientName: '',
  contactId: '',
  contactName: '',
  chatId: '',
  sourceMessageId: null,
}

const SUPPORT_TOOLS = createSupportTools(SHAPE_ONLY)
const REPO_TOOLS = createRepoTools(SHAPE_ONLY, [])

/** What eve's `defineTool` asks for, narrowed from what the AI SDK's `tool()` returns. */
export interface ToolShape {
  description: string
  inputSchema: never
}

/**
 * `tool()` widens its own fields - `description` to include a function form, and
 * `inputSchema` to the AI SDK's FlexibleSchema wrapper - while eve wants a plain
 * string and a Zod schema. The runtime values here are exactly the string and
 * the Zod object passed in at the definition site, so only the static types need
 * reconciling.
 */
function shapeOf(definition: { description?: unknown; inputSchema: unknown }): ToolShape {
  return {
    description: typeof definition.description === 'string' ? definition.description : '',
    inputSchema: definition.inputSchema as never,
  }
}

export const SUPPORT_SPECS = {
  listMyProjects: shapeOf(SUPPORT_TOOLS.listMyProjects),
  getMyRequests: shapeOf(SUPPORT_TOOLS.getMyRequests),
  addGlossaryEntry: shapeOf(SUPPORT_TOOLS.addGlossaryEntry),
  proposeSummary: shapeOf(SUPPORT_TOOLS.proposeSummary),
  fileRequest: shapeOf(SUPPORT_TOOLS.fileRequest),
} as const

/**
 * The second argument an AI SDK executor expects.
 *
 * These implementations read only their input and the context they were built
 * with; none of them touches `messages`, and the test suite calls them with no
 * options at all. This supplies the shape so the call typechecks.
 */
export function execOptions(toolCallId: string) {
  return { toolCallId, messages: [], context: undefined } as never
}

export const REPO_SPECS = {
  listProjectFiles: shapeOf(REPO_TOOLS.listProjectFiles),
  searchProjectCode: shapeOf(REPO_TOOLS.searchProjectCode),
  readProjectFile: shapeOf(REPO_TOOLS.readProjectFile),
} as const
