/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.7.2 Cloud';
export const BUILD_COMMIT = '9e4a1b0';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'PDF: optimización de memoria de imágenes (JPEG 80% + cache) que soluciona Invalid string length';
