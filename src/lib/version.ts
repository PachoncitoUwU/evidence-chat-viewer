/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.7.4 Cloud';
export const BUILD_COMMIT = '7e6f5a4';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Fix definitivo: tabla de mensajes en Supabase con id TEXT y paginación ilimitada para chats grandes.';
