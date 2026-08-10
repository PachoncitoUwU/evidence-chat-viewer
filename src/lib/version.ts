/**
 * version.ts
 * ------------------------------------------------------------------
 * Registro oficial de versión y compilación de la aplicación.
 * Permite al usuario verificar en qué actualización en vivo va en Vercel.
 * ------------------------------------------------------------------
 */

export const APP_VERSION = 'v2.5.3 Cloud';
export const BUILD_COMMIT = 'ff9e44e';
export const BUILD_DATE = new Date().toLocaleDateString('es-ES');
export const BUILD_NOTES = 'Integración oficial Supabase Cloud, auto-sync de chats pesados (+600MB), paneles colapsables y control de fuente';
