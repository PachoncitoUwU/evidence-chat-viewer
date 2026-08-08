/**
 * hiddenMediaStore.ts
 * ------------------------------------------------------------------
 * Store de elementos ocultos (mensajes de texto, fotos, videos, audios, stickers).
 * Vinculado al perfil del usuario activo para que todo lo oculto
 * quede guardado permanentemente en su cuenta.
 * ------------------------------------------------------------------
 */

import { writable } from 'svelte/store';

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
	const initial = loadHiddenForUser();
	const { subscribe, update, set } = writable<Set<string>>(initial);

	function persist(setVal: Set<string>) {
		if (typeof window !== 'undefined') {
			try {
				const key = getStorageKey(currentUsername);
				localStorage.setItem(key, JSON.stringify(Array.from(setVal)));
			} catch {
				/* noop */
			}
		}
	}

	return {
		subscribe,
		setUser(username: string) {
			currentUsername = username || '';
			const loaded = loadHiddenForUser(currentUsername);
			set(loaded);
		},
		hide(id: string) {
			update((s) => {
				const next = new Set(s);
				next.add(id);
				persist(next);
				return next;
			});
		},
		unhide(id: string) {
			update((s) => {
				const next = new Set(s);
				next.delete(id);
				persist(next);
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
				persist(next);
				return next;
			});
		},
		clear() {
			const next = new Set<string>();
			persist(next);
			set(next);
		},
		isHidden(id: string, hiddenSet: Set<string>): boolean {
			return hiddenSet.has(id);
		}
	};
}

export const hiddenMediaStore = createHiddenMediaStore();
