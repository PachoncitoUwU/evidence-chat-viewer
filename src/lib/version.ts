/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.1.1 Cloud';
export const BUILD_COMMIT = 'fix-layout-spacing-and-instant-timeline-scroll-targeting';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Ajuste estético de paneles sin espacios vacíos y salto garantizado por scroll animado a la fecha elegida en la cronología.';
