/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.1 Cloud';
export const BUILD_COMMIT = 'a1b2c3d';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Exportación a PDF ultra-rápida (1-2s) sin compresión en canvas, manteniendo la máxima calidad original y proporciones de imágenes.';
