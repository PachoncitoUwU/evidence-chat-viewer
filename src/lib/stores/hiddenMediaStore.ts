/**
 * hiddenMediaStore.ts
 * ------------------------------------------------------------------
 * Store reactivo de elementos ocultos (mensajes de texto, fotos, videos, audios, stickers).
 * Sincronizado automáticamente en tiempo real con Supabase (en la nube) y
 * respaldado en LocalStorage para disponibilidad en cualquier dispositivo o navegador.
 * ------------------------------------------------------------------
 */

import { writable } from 'svelte/store';
import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
import { syncUserHiddenIdsToSupabase, fetchUserHiddenIdsFromSupabase } from '$lib/services/syncService';

const BASE_KEY = 'chatviewer-hidden-media';

function getStorageKey(username?: string): string {
	if (username && username.trim()) {
		return `chatviewer-hidden-user-${username.trim().toLowerCase()}`;
	}
	return BASE_KEY;
}

function loadHiddenForUser(username?: string): Set<string> {
	if (typeof window === 'undefined') return new Set();
	try {
		const key = getStorageKey(username);
		const raw = localStorage.getItem(key);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return new Set(parsed);
			}
		}
	} catch {
		/* noop */
	}
	return new Set();
}

function createHiddenMediaStore() {
	let currentUsername: string = '';
	let syncTimeout: any = null;
	let realtimeChannel: any = null;

	const initial = loadHiddenForUser();
	const { subscribe, update, set } = writable<Set<string>>(initial);

	// Persistir localmente y sincronizar en la nube con Supabase (debounced)
	function persistAndSync(setVal: Set<string>) {
		if (typeof window !== 'undefined') {
			try {
				const key = getStorageKey(currentUsername);
				localStorage.setItem(key, JSON.stringify(Array.from(setVal)));
			} catch {
				/* noop */
			}
		}

		// Sincronizar con Supabase Cloud en segundo plano
		if (currentUsername && isSupabaseConfigured()) {
			if (syncTimeout) clearTimeout(syncTimeout);
			syncTimeout = setTimeout(() => {
				syncUserHiddenIdsToSupabase(currentUsername, Array.from(setVal));
			}, 350);
		}
	}

	function setupRealtimeListener(username: string) {
		if (typeof window === 'undefined' || !isSupabaseConfigured() || !username) return;

		// Limpiar canal anterior si existe
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
			realtimeChannel = null;
		}

		try {
			const cleanUser = username.trim().toLowerCase();
			realtimeChannel = supabase
				.channel(`realtime_hidden_${cleanUser}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'user_settings',
						filter: `user_id=eq.${cleanUser}`
					},
					(payload: any) => {
						if (payload.new && Array.isArray(payload.new.hidden_ids)) {
							const cloudIds = payload.new.hidden_ids as string[];
							update((current) => {
								const merged = new Set([...current, ...cloudIds]);
								if (typeof window !== 'undefined') {
									try {
										const key = getStorageKey(currentUsername);
										localStorage.setItem(key, JSON.stringify(Array.from(merged)));
									} catch {
										/* noop */
									}
								}
								return merged;
							});
						}
					}
				)
				.subscribe();
		} catch (e) {
			console.warn('No se pudo inicializar listener en tiempo real:', e);
		}
	}

	return {
		subscribe,
		async setUser(username: string) {
			currentUsername = username ? username.trim().toLowerCase() : '';
			const loadedLocal = loadHiddenForUser(currentUsername);
			set(loadedLocal);

			if (currentUsername) {
				setupRealtimeListener(currentUsername);

				// Recuperar desde Supabase Cloud y combinar con los locales
				try {
					const cloudHiddenIds = await fetchUserHiddenIdsFromSupabase(currentUsername);
					if (cloudHiddenIds && cloudHiddenIds.length > 0) {
						update((current) => {
							const merged = new Set([...current, ...cloudHiddenIds]);
							if (typeof window !== 'undefined') {
								try {
									const key = getStorageKey(currentUsername);
									localStorage.setItem(key, JSON.stringify(Array.from(merged)));
								} catch {
									/* noop */
								}
							}
							return merged;
						});
					} else if (loadedLocal.size > 0) {
						// Si el usuario tenía ocultos locales que no estaban en la nube, subirlos
						syncUserHiddenIdsToSupabase(currentUsername, Array.from(loadedLocal));
					}
				} catch (err) {
					console.warn('Error sincronizando elementos ocultos de la nube:', err);
				}
			} else {
				if (realtimeChannel) {
					supabase.removeChannel(realtimeChannel);
					realtimeChannel = null;
				}
			}
		},
		hide(id: string) {
			update((s) => {
				const next = new Set(s);
				next.add(id);
				persistAndSync(next);
				return next;
			});
		},
		unhide(id: string) {
			update((s) => {
				const next = new Set(s);
				next.delete(id);
				persistAndSync(next);
				return next;
			});
		},
		toggle(id: string) {
			update((s) => {
				const next = new Set(s);
				if (next.has(id)) {
					next.delete(id);
				} else {
					next.add(id);
				}
				persistAndSync(next);
				return next;
			});
		},
		mergeIds(ids: string[]) {
			if (!ids || ids.length === 0) return;
			update((s) => {
				const next = new Set([...s, ...ids]);
				persistAndSync(next);
				return next;
			});
		},
		clear() {
			const next = new Set<string>();
			persistAndSync(next);
			set(next);
		},
		isHidden(id: string, hiddenSet: Set<string>): boolean {
			return hiddenSet.has(id);
		}
	};
}

export const hiddenMediaStore = createHiddenMediaStore();
