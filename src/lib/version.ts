/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v3.0.0 Cloud';
export const BUILD_COMMIT = 'feat-gallery-fullscreen-group-duplicate-stickers';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Galería con botón para expandir a pantalla completa (100vw), vista en mosaico reparada con cuadrícula HD, y agrupación inteligente de stickers duplicados para ocultar/gestionar todas sus repeticiones en 1 solo clic.';
