/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.8.2 Cloud';
export const BUILD_COMMIT = 'b2c3d4e';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Fix crítico: fechas WhatsApp en formato YYYY-DD-MM ya no rompen el guardado en Supabase.';
