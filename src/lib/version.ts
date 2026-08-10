/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.8.1 Cloud';
export const BUILD_COMMIT = '1c2b3a4';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Sincronización automática de chats al iniciar sesión, aviso claro para móviles y botón ☁️ de respaldo manual.';
