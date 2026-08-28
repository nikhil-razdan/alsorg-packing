const configuredApiBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

/*
 * Local development keeps the historical backend default. Production should
 * continue supplying VITE_API_BASE_URL in the Render frontend environment.
 */
export const API_BASE_URL =
  configuredApiBaseUrl ||
  "http://localhost:8080";
