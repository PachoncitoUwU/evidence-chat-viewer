/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.5 Cloud';
export const BUILD_COMMIT = 'fix-stickers-compact-size-and-footer-page-date';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Stickers reducidos a tamaño compacto (~5-6mm) para ahorro de papel y fecha del día visible en el pie de página de cada hoja del PDF.';
