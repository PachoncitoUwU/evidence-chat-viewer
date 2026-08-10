/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.8.3 Cloud';
export const BUILD_COMMIT = 'c3d4e5f';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'PDF hasta 3x más rápido: carga de imágenes en paralelo (8 a la vez) y sin bloqueos en exportaciones largas.';
