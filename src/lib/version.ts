/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.4 Cloud';
export const BUILD_COMMIT = 'fix-chat-bubble-sides-and-roles';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Corrección de roles en vista y PDF: remitente titular a la derecha en verde y contraparte a la izquierda en blanco, más selector e inversor dinámico de lados.';
