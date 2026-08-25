/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.7 Cloud';
export const BUILD_COMMIT = 'fix-pdf-text-wrap-calls-stickers-sizing';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Corrección de desborde y corte de texto en PDF, filtros para incluir/excluir llamadas contestadas y rechazadas, stickers más compactos e imágenes de mayor resolución y escala en el reporte.';
