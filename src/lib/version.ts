/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.3 Cloud';
export const BUILD_COMMIT = 'fix-date-2027-2028';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Corrección definitiva del bug de fechas 2027/2028: se eliminó la heurística YMD errónea y la corrección de seguridad que generaba años incorrectos en fechas ambiguas.';
