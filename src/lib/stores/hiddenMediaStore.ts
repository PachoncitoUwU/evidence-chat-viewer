import { writable } from 'svelte/store';

const STORAGE_KEY = 'chatviewer-hidden-media';

function loadInitialHidden(): Set<string> {
	if (typeof window === 'undefined') return new Set();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
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
	const initial = loadInitialHidden();
	const { subscribe, update, set } = writable<Set<string>>(initial);

	function persist(setVal: Set<string>) {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(setVal)));
			} catch {
				/* noop */
			}
		}
	}

	return {
		subscribe,
		hide(id: string) {
			update(s => {
				const next = new Set(s);
				next.add(id);
				persist(next);
				return next;
			});
		},
		unhide(id: string) {
			update(s => {
				const next = new Set(s);
				next.delete(id);
				persist(next);
				return next;
			});
		},
		toggle(id: string) {
			update(s => {
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
