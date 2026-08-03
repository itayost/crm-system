import type { DefaultToastOptions } from 'react-hot-toast'

/**
 * What a toast looks like, decided once.
 *
 * The two layouts used to configure this separately, and only one of them
 * bothered: a failed login rendered in react-hot-toast's default white while
 * the same error inside the app rendered solid red. These are the same solid
 * tones a StatusPill uses, so "this went wrong" is one colour everywhere.
 */
export const TOAST_OPTIONS: DefaultToastOptions = {
  duration: 4000,
  style: {
    background: 'hsl(var(--tone-neutral-solid))',
    color: '#fff',
    direction: 'rtl',
  },
  success: {
    style: { background: 'hsl(var(--tone-success-solid))' },
  },
  error: {
    style: { background: 'hsl(var(--tone-danger-solid))' },
  },
}
