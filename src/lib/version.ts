/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.2 Cloud';
export const BUILD_COMMIT = 'sync-cloud-2026';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Sincronización en tiempo real de mensajes ocultos con Supabase (multi-dispositivo) y corrección de detección de fechas y años de 2 dígitos.';
