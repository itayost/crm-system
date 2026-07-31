import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { EMPTY_INTAKE, intakeSchema, type Intake } from '@/lib/validations/intake'

/**
 * Reads the intake fields out of what the client already said.
 *
 * This is deliberately a separate pass from transcription. The transcriber is
 * told to write down exactly what was said and interpret nothing, which is what
 * makes the transcript trustworthy; pulling structure out of it is a different
 * job with a different failure mode. A client who sends a 40-second voice note
 * usually answers most of the form without being asked, and this is what turns
 * that into fields instead of into questions.
 */

const MODEL = process.env.INTAKE_MODEL ?? 'anthropic/claude-sonnet-4.6'

const SYSTEM_PROMPT = `אתה ממלא טופס פנייה של לקוח מתוך מה שהוא כתב או אמר. אתה לא מדבר עם הלקוח ולא שואל אותו כלום.

מלא רק מה שנאמר בפועל. אם משהו לא נאמר — החזר null. לעולם אל תנחש ואל תמציא.

אם מצורפת היסטוריית שיחה, היא הקשר בלבד: מלא את הטופס עבור ההודעה האחרונה של הלקוח. כשההודעה האחרונה מתקנת משהו שנאמר קודם ("לא, זה בעמוד ההזמנות") — מלא את הערך המתוקן.

הסברים לשדות:
- where: המסך, העמוד או האזור שבו זה קורה, במילים של הלקוח ("עמוד הבית", "טופס יצירת קשר"). null אם לא הוזכר.
- whatHappened: מה הלקוח ראה או חווה בפועל.
- expected: מה הוא ציפה שיקרה. מלא את זה רק כשזה ההיפך הישיר של התלונה ("התמונה לא מסודרת" -> "שהתמונה תהיה מסודרת"). אם צריך לנחש מעבר לזה — null.
- frequency: ALWAYS אם זה קורה כל פעם, SOMETIMES אם לפעמים או לסירוגין, ONCE אם קרה פעם אחת. null אם לא ברור.
- workedBefore: true אם אמר שזה עבד קודם, false אם אמר שזה מעולם לא עבד, null אם לא הוזכר.
- blocking: true אם זה חוסם אותו מלעבוד או דחוף לו, false אם אמר שזה יכול לחכות, null אם לא הוזכר.
- goal: כשמדובר בשינוי או תוספת — מה הוא מנסה להשיג.
- today: כשמדובר בשינוי או תוספת — איך הוא מסתדר עם זה היום.
- suggestedType: הקריאה שלך לסוג הפנייה. BUG כשמשהו שבור, IMPROVEMENT או REQUEST כשרוצים שינוי או תוספת, QUESTION כששואלים שאלה. זו הצעה פנימית בלבד.`

/** The handful of turns the extractor may read for context. More adds noise. */
const MAX_CONTEXT_TURNS = 6

export interface IntakeContext {
  history?: Array<{ role: string; content: string }>
}

export class IntakeExtractionService {
  /**
   * Never throws: a failed extraction means the agent asks the questions it
   * would have asked anyway, which is the pre-existing behaviour.
   *
   * The history exists so corrections work. The extractor used to see one
   * message in isolation, so "לא, זה בעמוד ההזמנות" extracted a null `where`
   * and the wrong value from two turns ago survived the merge.
   */
  static async extract(text: string, context: IntakeContext = {}): Promise<Intake> {
    if (!text.trim()) return EMPTY_INTAKE

    const recent = (context.history ?? []).slice(-MAX_CONTEXT_TURNS)
    const prompt = recent.length
      ? `היסטוריית שיחה אחרונה:\n${recent
          .map((m) => `${m.role === 'user' ? 'לקוח' : 'נציג'}: ${m.content}`)
          .join('\n')}\n\nההודעה האחרונה של הלקוח (מלא את הטופס עבורה):\n${text}`
      : text

    try {
      const result = await generateObject({
        model: gateway(MODEL),
        schema: intakeSchema,
        system: SYSTEM_PROMPT,
        prompt,
      })

      return result.object
    } catch (error) {
      console.error('Intake extraction failed:', error)
      return EMPTY_INTAKE
    }
  }
}
