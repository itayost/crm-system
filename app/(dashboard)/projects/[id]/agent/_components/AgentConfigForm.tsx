'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentProjectConfig } from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  projectId: string
  initial: AgentProjectConfig | null
}

interface FormValues {
  status: 'ACTIVE' | 'PAUSED' | 'DISABLED'
  agentSlug: string
  githubOwner: string
  githubRepo: string
  githubBranch: string
  vercelTeamId: string
  vercelProjectId: string
  supabaseProjectRef: string
  smokeUrl: string
  domains: string
  morningReportInclude: boolean
  safetyConfig: string
  ingestionConfig: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFormValues(cfg: AgentProjectConfig): FormValues {
  return {
    status: cfg.status as 'ACTIVE' | 'PAUSED' | 'DISABLED',
    agentSlug: cfg.agentSlug,
    githubOwner: cfg.githubOwner,
    githubRepo: cfg.githubRepo,
    githubBranch: cfg.githubBranch,
    vercelTeamId: cfg.vercelTeamId,
    vercelProjectId: cfg.vercelProjectId,
    supabaseProjectRef: cfg.supabaseProjectRef ?? '',
    smokeUrl: cfg.smokeUrl ?? '',
    domains: cfg.domains.join(', '),
    morningReportInclude: cfg.morningReportInclude,
    safetyConfig: JSON.stringify(cfg.safetyConfig, null, 2),
    ingestionConfig:
      cfg.ingestionConfig != null ? JSON.stringify(cfg.ingestionConfig, null, 2) : '',
  }
}

const DEFAULT_VALUES: FormValues = {
  status: 'ACTIVE',
  agentSlug: '',
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  vercelTeamId: '',
  vercelProjectId: '',
  supabaseProjectRef: '',
  smokeUrl: '',
  domains: '',
  morningReportInclude: true,
  safetyConfig: '{}',
  ingestionConfig: '',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
      className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        readOnly
          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
          : 'bg-white border-gray-300'
      }`}
    />
  )
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {saving ? 'Saving...' : 'Save'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// FormBody — shared form fields for both create and edit
// ---------------------------------------------------------------------------

function FormBody({
  values,
  isNew,
  onChange,
}: {
  values: FormValues
  isNew: boolean
  onChange: (patch: Partial<FormValues>) => void
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* Status */}
      <Field label="Status">
        <div className="flex gap-4">
          {(['ACTIVE', 'PAUSED', 'DISABLED'] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s}
                checked={values.status === s}
                onChange={() => onChange({ status: s })}
                className="accent-blue-600"
              />
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </Field>

      {/* Agent slug */}
      <Field
        label="Agent slug"
        hint={!isNew ? '⚠ immutable once saved' : 'lowercase, digits, hyphens'}
      >
        <TextInput
          value={values.agentSlug}
          readOnly={!isNew}
          placeholder="my-project-slug"
          onChange={(v) => onChange({ agentSlug: v })}
        />
      </Field>

      {/* GitHub fieldset */}
      <fieldset className="border border-gray-200 rounded p-4 flex flex-col gap-4">
        <legend className="text-sm font-semibold text-gray-600 px-1">GitHub</legend>
        <Field label="Owner">
          <TextInput
            value={values.githubOwner}
            placeholder="acme-corp"
            onChange={(v) => onChange({ githubOwner: v })}
          />
        </Field>
        <Field label="Repo">
          <TextInput
            value={values.githubRepo}
            placeholder="my-repo"
            onChange={(v) => onChange({ githubRepo: v })}
          />
        </Field>
        <Field label="Branch">
          <TextInput
            value={values.githubBranch}
            placeholder="main"
            onChange={(v) => onChange({ githubBranch: v })}
          />
        </Field>
      </fieldset>

      {/* Vercel fieldset */}
      <fieldset className="border border-gray-200 rounded p-4 flex flex-col gap-4">
        <legend className="text-sm font-semibold text-gray-600 px-1">Vercel</legend>
        <Field label="Team ID">
          <TextInput
            value={values.vercelTeamId}
            placeholder="team_xxxxxxxxxxxx"
            onChange={(v) => onChange({ vercelTeamId: v })}
          />
        </Field>
        <Field label="Project ID">
          <TextInput
            value={values.vercelProjectId}
            placeholder="prj_xxxxxxxxxxxx"
            onChange={(v) => onChange({ vercelProjectId: v })}
          />
        </Field>
      </fieldset>

      {/* Supabase */}
      <Field label="Supabase project ref" hint="Optional">
        <TextInput
          value={values.supabaseProjectRef}
          placeholder="abcdefghijklmnop"
          onChange={(v) => onChange({ supabaseProjectRef: v })}
        />
      </Field>

      {/* Smoke URL */}
      <Field label="Smoke URL" hint="Optional — health-check endpoint">
        <TextInput
          value={values.smokeUrl}
          placeholder="https://example.com/api/health"
          onChange={(v) => onChange({ smokeUrl: v })}
        />
      </Field>

      {/* Domains */}
      <Field label="Domains" hint="Comma-separated">
        <TextInput
          value={values.domains}
          placeholder="example.com, www.example.com"
          onChange={(v) => onChange({ domains: v })}
        />
      </Field>

      {/* Morning report */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={values.morningReportInclude}
          onChange={(e) => onChange({ morningReportInclude: e.target.checked })}
          className="accent-blue-600 h-4 w-4"
        />
        Include in morning report
      </label>

      {/* Advanced toggle */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="text-sm text-blue-600 hover:underline"
        >
          {advancedOpen ? 'Hide advanced' : 'Show advanced'}
        </button>

        {advancedOpen && (
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Safety config (JSON)">
              <textarea
                value={values.safetyConfig}
                onChange={(e) => onChange({ safetyConfig: e.target.value })}
                rows={6}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Ingestion config (JSON)" hint="Leave blank to clear">
              <textarea
                value={values.ingestionConfig}
                onChange={(e) => onChange({ ingestionConfig: e.target.value })}
                rows={6}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentConfigForm({ projectId, initial }: Props) {
  const router = useRouter()
  const isNew = initial === null

  const [showForm, setShowForm] = useState(!isNew)
  const [values, setValues] = useState<FormValues>(
    isNew ? DEFAULT_VALUES : toFormValues(initial)
  )
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function patch(updates: Partial<FormValues>) {
    setValues((prev) => ({ ...prev, ...updates }))
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMsg(null)
    setErrorMsg(null)

    // Validate JSON fields BEFORE sending the request
    let parsedSafety: unknown
    try {
      parsedSafety = JSON.parse(values.safetyConfig)
    } catch {
      setErrorMsg('safetyConfig: invalid JSON')
      return
    }

    let parsedIngestion: unknown = null
    if (values.ingestionConfig.trim() !== '') {
      try {
        parsedIngestion = JSON.parse(values.ingestionConfig)
      } catch {
        setErrorMsg('ingestionConfig: invalid JSON')
        return
      }
    }

    const domains = values.domains
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)

    const body = {
      agentSlug: values.agentSlug,
      status: values.status,
      githubOwner: values.githubOwner,
      githubRepo: values.githubRepo,
      githubBranch: values.githubBranch,
      vercelTeamId: values.vercelTeamId,
      vercelProjectId: values.vercelProjectId,
      supabaseProjectRef: values.supabaseProjectRef || null,
      smokeUrl: values.smokeUrl || null,
      domains,
      morningReportInclude: values.morningReportInclude,
      safetyConfig: parsedSafety,
      ingestionConfig: parsedIngestion,
    }

    setSaving(true)
    try {
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(`/api/projects/${projectId}/agent-config`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let msg = `Request failed (${res.status})`
        try {
          const data = (await res.json()) as { error?: string }
          if (typeof data?.error === 'string') msg = data.error
        } catch {
          // ignore parse error — use status-based message
        }
        setErrorMsg(`❌ ${msg}`)
        return
      }

      setSuccessMsg('Saved. Agent will pick up changes within 5 min.')
      router.refresh()
    } catch (err) {
      setErrorMsg(`❌ ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setSaving(false)
    }
  }

  // Empty state — config doesn't exist yet and form hasn't been revealed
  if (isNew && !showForm) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
        <p className="text-gray-500 mb-4">
          This project isn&apos;t being monitored yet.
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Enable agent monitoring
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormBody values={values} isNew={isNew} onChange={patch} />

      {successMsg && (
        <p className="rounded bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {successMsg}
        </p>
      )}
      {errorMsg && (
        <p className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center gap-4">
        <SaveButton saving={saving} />
      </div>
    </form>
  )
}
