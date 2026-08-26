/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.6 Cloud';
export const BUILD_COMMIT = 'adjust-stickers-size-10mm-and-clean-pdf-footer';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Ajuste de stickers a tamaño óptimo (~10mm) y limpieza del pie de página del PDF mostrando únicamente numeración oficial centrada.';
