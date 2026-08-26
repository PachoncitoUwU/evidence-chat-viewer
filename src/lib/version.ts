/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.3 Cloud';
export const BUILD_COMMIT = 'fix-pdf-url-strict-wrap-and-compact-photos';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'División estricta por caracteres para links y URLs largas que previene cualquier desbordamiento de la burbuja, y reducción del tamaño máximo de fotos a 38mm para optimizar páginas y tinta.';
