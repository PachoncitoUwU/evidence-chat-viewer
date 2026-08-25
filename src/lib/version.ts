/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.1 Cloud';
export const BUILD_COMMIT = 'fix-pdf-url-wrapping-and-gallery-mosaic';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Corrección completa para que enlaces y URLs largas nunca se salgan del borde en el PDF, lista multimedia ampliada y vista en mosaico estabilizada.';
