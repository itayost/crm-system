/** Where the app under test lives. Override with E2E_PORT when 3000 is taken. */
export const E2E_PORT = process.env.E2E_PORT ?? '3000'
export const BASE_URL = `http://localhost:${E2E_PORT}`
