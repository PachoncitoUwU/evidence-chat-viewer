/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.2 Cloud';
export const BUILD_COMMIT = 'fix-pdf-url-wrapping-and-sticker-group-sync';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Ajuste definitivo para enlaces largos en el PDF sin desbordamiento, agrupación completa de stickers para ocultar todas sus instancias en 1 clic y clarificación de roles emisor/receptor.';
