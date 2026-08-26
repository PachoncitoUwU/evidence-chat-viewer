/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.7 Cloud';
export const BUILD_COMMIT = 'fix-persistent-chat-roles-and-video-fallback-player';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Persistencia automática del cambio de lados (owner/counterpart) en base de datos local y Supabase, más reproductor de video mejorado con soporte de formatos y botón de descarga directa si el códec no es nativo.';
