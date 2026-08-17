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
        // Injected by next/font in app/layout.tsx, so the family carries
        // size-adjust fallback metrics and cannot shift layout on first paint.
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      /**
       * The console type scale, added alongside Tailwind's defaults rather
       * than over them. Overwriting `text-sm` would restyle every one of the
       * ~400 call sites in this repo in a commit whose stated purpose is
       * "add scales", and there would be no way to tell a deliberate change
       * from an accidental one in the baseline diff. Components opt in.
       *
       * Body is `ui-sm` (13px). Page titles are `ui-lg` (18px) - today a page
       * h1 and a KPI value are both 24px bold, so the two most different
       * things on the dashboard are typographically identical.
       */
      fontSize: {
        'ui-2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        'ui-xs': ['0.75rem', { lineHeight: '1.05rem' }],
        'ui-sm': ['0.8125rem', { lineHeight: '1.15rem' }],
        'ui-md': ['0.9375rem', { lineHeight: '1.35rem' }],
        'ui-lg': ['1.125rem', { lineHeight: '1.4rem', letterSpacing: '-0.015em' }],
        'ui-xl': ['1.375rem', { lineHeight: '1.6rem', letterSpacing: '-0.02em' }],
        'ui-2xl': ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },

      boxShadow: {
        e0: 'var(--elevation-0)',
        e1: 'var(--elevation-1)',
        e2: 'var(--elevation-2)',
      },

      spacing: {
        row: 'var(--row-height)',
        'row-compact': 'var(--row-height-compact)',
        control: 'var(--control-height)',
        gutter: 'var(--page-gutter)',
        'shell-header': 'var(--shell-header-height)',
        'shell-sidebar': 'var(--shell-sidebar-width)',
        'shell-rail': 'var(--shell-rail-width)',
      },

      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
      },

      transitionTimingFunction: {
        'out-expo': 'var(--ease-out)',
      },

      zIndex: {
        nav: '10',
        sticky: '20',
        overlay: '40',
        modal: '50',
        toast: '60',
      },
    },
  },
  // Radix popovers, selects, dialogs and dropdowns all ship `animate-in` /
  // `fade-in-0` / `zoom-in-95` classes that this plugin defines. It was a
  // dependency but never registered, so those classes resolved to nothing.
  plugins: [require('tailwindcss-animate')],
}
module.exports = config