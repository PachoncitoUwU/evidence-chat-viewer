/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.7.2 Cloud';
export const BUILD_COMMIT = '1a3b5c7';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Sincronización en la nube con Supabase optimizada para esquema TEXT y eliminación de restricciones UUID.';
