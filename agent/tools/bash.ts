import { disableTool } from 'eve/tools'

/**
 * Removed from eve's default tool set.
 *
 * This agent is mounted on the CRM's own domain, and once the support turn moves
 * onto it, it answers messages written by clients. eve's shell, filesystem and
 * network defaults are enabled with no import and run with the app runtime's
 * environment; `ask_question` parks a turn at `session.waiting`, which over
 * WhatsApp would hang a reply nobody can answer. None of them are in this
 * agent's brief, so the model never sees them.
 *
 * eve's own guidance: "Review these default tools before production use.
 * Disable, wrap, restrict, or require approval for any tool that can access the
 * filesystem, network, shell, or sensitive data."
 */
export default disableTool()
