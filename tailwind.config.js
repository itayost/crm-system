const TONES = [
  'neutral',
  'info',
  'success',
  'warning',
  'caution',
  'danger',
  'accent',
  'progress',
]

/**
 * The tone scale as utilities, for the status signals that are not pills - a
 * completed-task checkbox, an overdue date, a KPI tile. Those used to reach for
 * whatever raw palette shade looked right, which is how the app ended up with
 * four greens and three reds all meaning "done" and "late".
 *
 * Keep this mirroring lib/design/tones.ts. The pills themselves do not use it;
 * they use the .tone-* classes, which bind all five roles in one decision.
 */
const toneScale = Object.fromEntries(
  TONES.map((name) => [
    name,
    {
      surface: `hsl(var(--tone-${name}-surface))`,
      foreground: `hsl(var(--tone-${name}-foreground))`,
      mark: `hsl(var(--tone-${name}-mark))`,
      solid: `hsl(var(--tone-${name}-solid))`,
    },
  ]),
)

/** @type {import('tailwindcss').Config} */
const config = {
  // `lib` is in here because lib/design/tones.ts is where class-name strings
  // are chosen. Leaving it out silently purged the whole tone layer.
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic layer only. Components never name a primitive, and the
        // primitives themselves stay in globals.css where they cannot be
        // reached by a utility class.
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        link: "hsl(var(--link))",
        surface: {
          app: "hsl(var(--surface-app))",
          subtle: "hsl(var(--surface-subtle))",
          muted: "hsl(var(--surface-muted))",
        },
        content: {
          strong: "hsl(var(--foreground-strong))",
          body: "hsl(var(--foreground-body))",
          muted: "hsl(var(--foreground-muted))",
          subtle: "hsl(var(--foreground-subtle))",
          faint: "hsl(var(--foreground-faint))",
        },
        tone: toneScale,
        // Money reads as money everywhere, instead of a green and an amber
        // picked separately at each call site.
        figure: {
          paid: "hsl(var(--figure-paid))",
          due: "hsl(var(--figure-due))",
        },
        marker: {
          vip: "hsl(var(--marker-vip))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
      },
    },
  },
  // Radix popovers, selects, dialogs and dropdowns all ship `animate-in` /
  // `fade-in-0` / `zoom-in-95` classes that this plugin defines. It was a
  // dependency but never registered, so those classes resolved to nothing.
  plugins: [require('tailwindcss-animate')],
}
module.exports = config