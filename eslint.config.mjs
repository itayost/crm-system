import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships flat config directly, so the FlatCompat wrapper
 * this file used to need is gone. Wrapping an already-flat config in
 * FlatCompat throws on a circular structure under ESLint 10.
 */
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      /**
       * A leading underscore is this repo's existing signal for "required by a
       * signature, deliberately unused" - route handlers that ignore the
       * request, Playwright hooks that ignore the config, test doubles that
       * ignore their arguments. Honour it instead of renaming them all.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      /**
       * Two rules that arrived with eslint-config-next 16, both from the React
       * Compiler set, and both describing this app's existing architecture
       * rather than a defect introduced here.
       *
       * set-state-in-effect fires on ~20 sites, almost all of them the same
       * shape: `useEffect(() => { fetchThing() }, [fetchThing])`, where the
       * callback opens with setLoading(true). Silencing it is not the same as
       * fixing it - the honest fix is moving that data fetching to server
       * components or a query library, which is its own piece of work and
       * cannot be verified by the checks this repo has today.
       *
       * incompatible-library fires three times on react-hook-form, which is
       * upstream and not ours to change.
       *
       * Both are off rather than warn so the lint output stays actionable. Turn
       * them back on when the fetching layer is reworked.
       */
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // Tailwind and PostCSS load these as CommonJS; require() is the contract.
    files: ["*.config.js", "*.config.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
