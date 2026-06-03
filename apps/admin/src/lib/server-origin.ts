/** Absolute API origin for server-side (SSR) fetches — bypasses the client proxy. */
export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";
export const API_SSR_URL = `${API_ORIGIN}/api`;
