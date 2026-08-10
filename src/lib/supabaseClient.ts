/**
 * supabaseClient.ts
 * ------------------------------------------------------------------
 * Conexión oficial a Supabase Cloud Storage & Database (whatsappviwer).
 * Permite sincronizar chats, audios, fotos y perfiles de usuario
 * de forma 100% online entre cualquier computador y celular.
 * ------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return import.meta.env[key] || import.meta.env[`VITE_${key}`] || import.meta.env[`PUBLIC_${key}`] || '';
	}
	return '';
};

export const SUPABASE_URL = getEnvVar('PUBLIC_SUPABASE_URL') || getEnvVar('SUPABASE_URL') || 'https://yzvdxjfjonjeidmwncqt.supabase.co';
export const SUPABASE_ANON_KEY = getEnvVar('PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') || 'sb_publishable_9dLBGtJ0HZ7uQXU9fEkB_g_P9YtZzCJ';

export function isSupabaseConfigured(): boolean {
	return (
		SUPABASE_URL !== '' &&
		SUPABASE_URL !== 'https://placeholder-project.supabase.co' &&
		SUPABASE_ANON_KEY !== '' &&
		SUPABASE_ANON_KEY !== 'placeholder-key'
	);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true
	}
});
