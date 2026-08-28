/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.1.7 Cloud';
export const BUILD_COMMIT = 'align-outgoing-bubbles-to-right-edge-full-width-wrapper';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Alineación de burbujas salientes pegadas directamente al borde derecho del contenedor del chat mediante envoltorios de ancho completo (width 100%).';
