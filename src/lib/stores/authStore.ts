import { writable } from 'svelte/store';

export interface UserSession {
	username: string;
	pin: string;
	isLoggedIn: boolean;
}

const STORAGE_KEY = 'chatviewer-user-session';

function loadInitialSession(): UserSession {
	if (typeof window === 'undefined') return { username: '', pin: '', isLoggedIn: false };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && parsed.username && parsed.pin) {
				return { ...parsed, isLoggedIn: true };
			}
		}
	} catch {
		/* noop */
	}
	return { username: '', pin: '', isLoggedIn: false };
}

function createAuthStore() {
	const { subscribe, set, update } = writable<UserSession>(loadInitialSession());

	return {
		subscribe,
		login: (username: string, pin: string) => {
			const cleanUser = username.trim().toLowerCase();
			const cleanPin = pin.trim();
			const session: UserSession = { username: cleanUser, pin: cleanPin, isLoggedIn: true };
			if (typeof window !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
			}
			set(session);
		},
		logout: () => {
			if (typeof window !== 'undefined') {
				localStorage.removeItem(STORAGE_KEY);
			}
			set({ username: '', pin: '', isLoggedIn: false });
		}
	};
}

export const authStore = createAuthStore();
