/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.1.5 Cloud';
export const BUILD_COMMIT = 'fix-collapsed-timeline-empty-space-flex-layout';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Solución definitiva al espacio vacío: migración del contenedor principal a flexbox dinámico para que el chat siempre ocupe el 100% del ancho libre al colapsar la cronología o la barra lateral.';
