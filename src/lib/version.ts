/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.8 Cloud';
export const BUILD_COMMIT = 'fix-universal-video-modal-and-persistent-chat-owner';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Reproducción de video universal con src directo para Chrome, Edge, Brave, Firefox, Safari y móviles, más persistencia garantizada de selección de lados (dueño del chat) en localStorage, IndexedDB y Supabase.';
