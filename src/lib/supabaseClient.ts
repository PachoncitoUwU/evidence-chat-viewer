/**
 * supabaseClient.ts
 * ------------------------------------------------------------------
 * Conexión oficial a Supabase Cloud Storage & Database (whatsappviwer).
 * Permite sincronizar chats, audios, fotos y perfiles de usuario
 * de forma 100% online entre cualquier computador y celular.
 * ------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://yzvdxjfjonjeidmwncqt.supabase.co';
// Clave anon pública de Supabase
export const SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dmR4amZqb25qZWlkbXduY3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODg4MDAsImV4cCI6MjA2NjY2NDgwMH0.placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
