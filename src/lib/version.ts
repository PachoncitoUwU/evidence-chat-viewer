/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.9.9 Cloud';
export const BUILD_COMMIT = 'feat-pdf-legal-letter-paper-minimal-margins';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Soporte oficial para exportar PDF en hojas Tamaño Oficio (Legal), Carta (Letter) y A4, con márgenes mínimos ultra-compactos (6mm) para máximo ahorro de papel en impresión.';
