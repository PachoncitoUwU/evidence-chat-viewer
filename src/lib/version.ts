/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.1.0 Cloud';
export const BUILD_COMMIT = 'feat-timeline-jump-to-date-full-scroll-and-auto-media-sync';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Navegación fluida en la cronología que salta a la fecha seleccionada manteniendo el chat completo disponible para subir y bajar, más auto-resolución de URLs de fotos/videos desde Supabase Storage para todos los navegadores.';
