/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.6 Cloud';
export const BUILD_COMMIT = 'feat-photos-videos-only-zip-export';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Botón inteligente para seleccionar y descargar en ZIP exclusivamente Imágenes y Videos con fechas de envío de WhatsApp (excluye audios, documentos y stickers automáticamente).';
