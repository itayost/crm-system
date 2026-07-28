'use client'

import { useForm } from 'react-hook-form'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  INTAKE_FIELD_LABELS,
  INTAKE_FREQUENCY_LABELS,
  readIntake,
  type Intake,
} from '@/lib/validations/intake'
import { REQUEST_TYPE_LABELS } from '@/lib/design/labels'
import type { RequestRecord } from '@/lib/types/request'

// Radix Select cannot hold an empty string, so "not known" gets a sentinel
// that is mapped back to null on submit.
const UNKNOWN = 'UNKNOWN'
const YES = 'YES'
const NO = 'NO'

interface IntakeFormValues {
  where: string
  whatHappened: string
  expected: string
  frequency: string
  workedBefore: string
  blocking: string
  goal: string
  today: string
  suggestedType: string
}

function toFormValues(intake: Intake): IntakeFormValues {
  const bool = (value: boolean | null) => (value === null ? UNKNOWN : value ? YES : NO)

  return {
    where: intake.where ?? '',
    whatHappened: intake.whatHappened ?? '',
    expected: intake.expected ?? '',
    frequency: intake.frequency ?? UNKNOWN,
    workedBefore: bool(intake.workedBefore),
    blocking: bool(intake.blocking),
    goal: intake.goal ?? '',
    today: intake.today ?? '',
    suggestedType: intake.suggestedType ?? UNKNOWN,
  }
}

function toIntake(values: IntakeFormValues): Intake {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  const bool = (value: string) => (value === UNKNOWN ? null : value === YES)

  return {
    where: text(values.where),
    whatHappened: text(values.whatHappened),
    expected: text(values.expected),
    frequency: values.frequency === UNKNOWN ? null : (values.frequency as Intake['frequency']),
    workedBefore: bool(values.workedBefore),
    blocking: bool(values.blocking),
    goal: text(values.goal),
    today: text(values.today),
    suggestedType:
      values.suggestedType === UNKNOWN ? null : (values.suggestedType as Intake['suggestedType']),
  }
}

/**
 * The intake as an editable form. The agent fills these fields over WhatsApp;
 * here Itay can correct or complete them after the fact. The whole object is
 * sent on save - the update schema deliberately has no partial-intake mode.
 */
export function IntakeEditForm({
  requestId,
  intake,
  onSaved,
  onCancel,
}: {
  requestId: string
  intake: Intake | null
  onSaved: (updated: RequestRecord) => void
  onCancel: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<IntakeFormValues>({
    defaultValues: toFormValues(readIntake(intake)),
  })

  const handleSubmit = async (values: IntakeFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await api.put(`/requests/${requestId}`, { intake: toIntake(values) })
      toast.success('פרטי הפניה נשמרו')
      onSaved(response.data)
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת פרטי הפניה')
    } finally {
      setIsSubmitting(false)
    }
  }

  const textField = (name: 'where' | 'whatHappened' | 'expected', placeholder: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{INTAKE_FIELD_LABELS[name]}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
        </FormItem>
      )}
    />
  )

  const yesNoField = (name: 'workedBefore' | 'blocking') => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{INTAKE_FIELD_LABELS[name]}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={UNKNOWN}>לא ידוע</SelectItem>
              <SelectItem value={YES}>כן</SelectItem>
              <SelectItem value={NO}>לא</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {textField('where', 'מסך, עמוד או אזור')}
        {textField('whatHappened', 'מה הלקוח ראה')}
        {textField('expected', 'מה היה אמור לקרות')}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{INTAKE_FIELD_LABELS.frequency}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={UNKNOWN}>לא ידוע</SelectItem>
                    {Object.entries(INTAKE_FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {yesNoField('workedBefore')}
          {yesNoField('blocking')}
        </div>

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{INTAKE_FIELD_LABELS.goal}</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="התוצאה שהלקוח רוצה" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="today"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{INTAKE_FIELD_LABELS.today}</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="איך הלקוח מסתדר בינתיים" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="suggestedType"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>{INTAKE_FIELD_LABELS.suggestedType}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={UNKNOWN}>ללא הצעה</SelectItem>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'שומר...' : 'שמור'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </form>
    </Form>
  )
}
