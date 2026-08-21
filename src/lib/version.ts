/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.4 Cloud';
export const BUILD_COMMIT = 'fix-year-cap-definitive';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Corrección definitiva: cap de año al año actual cuando todos los componentes de fecha son de 2 dígitos. Ningún chat exportado en 2026 puede mostrar fechas futuras de 2027 o 2028.';
