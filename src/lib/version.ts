/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.9 Cloud';
export const BUILD_COMMIT = 'fix-browser-video-playback-autoplay-and-error-handling';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Corrección de reproducción de video en Edge, Chrome, Brave y Firefox con verificación real de decodificación y fallback de autoplay.';
