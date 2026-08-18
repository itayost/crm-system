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
      "crm-agent/**",
    ],
  },
];

export default eslintConfig;
