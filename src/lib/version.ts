/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.1.2 Cloud';
export const BUILD_COMMIT = 'fix-seamless-full-window-layout-and-dynamic-chunk-jump-to-date';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Diseño 100% de pantalla completa estilo WhatsApp Web sin ningún espacio vacío o margen blanco, y corrección del cálculo de chunks en memoria para saltar instantáneamente a cualquier fecha de la cronología.';
