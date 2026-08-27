/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.1.3 Cloud';
export const BUILD_COMMIT = 'fix-pixel-perfect-full-screen-and-precise-feed-scroll-to-date';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Ajuste de pantalla completa pixel-perfect sin gaps ni desbordes, y cálculo de desplazamiento relativo en feedEl para scroll suave exacto a cualquier día o mes de la cronología.';
