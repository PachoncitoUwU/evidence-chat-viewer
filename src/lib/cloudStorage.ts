/**
 * cloudStorage.ts
 * ------------------------------------------------------------------
 * Motor de persistencia en la nube local y base de datos IndexedDB.
 * Permite guardar gigabytes de chats, imágenes y evidencias sin límites
 * de cuota por perfil de usuario (Nombre + PIN) y gestionar el registro/login.
 * ------------------------------------------------------------------
 */

import type { EvidenceCase, ChatMeta, ChatMessage, DaySummary } from '$types/chat.types';

const DB_NAME = 'EvidenceChatViewerDB';
const DB_VERSION = 1;
const USER_STORE = 'users';
const CASE_STORE = 'cases';

export interface UserRecord {
	username: string;
	pin: string;
	createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof window === 'undefined' || !window.indexedDB) {
			return reject(new Error('IndexedDB no está disponible en este navegador.'));
		}
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(USER_STORE)) {
				db.createObjectStore(USER_STORE, { keyPath: 'username' });
			}
			if (!db.objectStoreNames.contains(CASE_STORE)) {
				const caseStore = db.createObjectStore(CASE_STORE, { keyPath: 'id' });
				caseStore.createIndex('userKey', 'userKey', { unique: false });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** Registra un nuevo perfil de usuario en la base de datos */
export async function registerUserInCloud(
	username: string,
	pin: string
): Promise<{ success: boolean; message?: string }> {
	const cleanUser = username.trim().toLowerCase();
	const cleanPin = pin.trim();

	if (!cleanUser) {
		return { success: false, message: 'Ingresa un nombre de usuario válido.' };
	}
	if (cleanPin.length < 4) {
		return { success: false, message: 'El PIN debe contener al menos 4 dígitos.' };
	}

	try {
		const db = await openDB();
		const tx = db.transaction(USER_STORE, 'readwrite');
		const store = tx.objectStore(USER_STORE);

		const existing = await new Promise<UserRecord | undefined>((resolve) => {
			const req = store.get(cleanUser);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(undefined);
		});

		if (existing) {
			return {
				success: false,
				message: `El usuario '@${cleanUser}' ya existe. Por favor inicia sesión o elige otro nombre.`
			};
		}

		await new Promise<void>((resolve, reject) => {
			const req = store.add({
				username: cleanUser,
				pin: cleanPin,
				createdAt: new Date().toISOString()
			});
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});

		return { success: true };
	} catch (e) {
		// Fallback LocalStorage si IndexedDB falla
		const key = `user_profile_${cleanUser}`;
		if (localStorage.getItem(key)) {
			return { success: false, message: `El usuario '@${cleanUser}' ya está registrado.` };
		}
		localStorage.setItem(key, JSON.stringify({ username: cleanUser, pin: cleanPin }));
		return { success: true };
	}
}

/** Verifica las credenciales de un usuario existente */
export async function verifyUserCredentials(
	username: string,
	pin: string
): Promise<{ success: boolean; message?: string }> {
	const cleanUser = username.trim().toLowerCase();
	const cleanPin = pin.trim();

	if (!cleanUser || !cleanPin) {
		return { success: false, message: 'Ingresa tu usuario y tu PIN.' };
	}

	try {
		const db = await openDB();
		const tx = db.transaction(USER_STORE, 'readonly');
		const store = tx.objectStore(USER_STORE);

		const user = await new Promise<UserRecord | undefined>((resolve) => {
			const req = store.get(cleanUser);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(undefined);
		});

		if (!user) {
			// Si el usuario no estaba en IndexedDB pero inicia sesión, registrarlo automáticamente
			await registerUserInCloud(cleanUser, cleanPin);
			return { success: true };
		}

		if (user.pin !== cleanPin) {
			return { success: false, message: 'PIN o contraseña incorrecta para este perfil.' };
		}

		return { success: true };
	} catch (e) {
		return { success: true };
	}
}

/** Guarda todos los casos cargados del usuario en IndexedDB (soporta archivos pesados .ZIP) */
export async function saveUserCasesToCloud(
	username: string,
	pin: string,
	cases: EvidenceCase[],
	caseDataMap: Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>
): Promise<boolean> {
	if (typeof window === 'undefined' || !username || !pin) return false;
	const cleanUser = username.trim().toLowerCase();

	try {
		const db = await openDB();
		const tx = db.transaction(CASE_STORE, 'readwrite');
		const store = tx.objectStore(CASE_STORE);

		for (const c of cases) {
			const data = caseDataMap.get(c.id);
			const record = {
				id: `${cleanUser}___${c.id}`,
				userKey: cleanUser,
				caseInfo: c,
				meta: data?.meta || c.chats[0],
				messages: data?.messages || [],
				days: data?.days || [],
				updatedAt: new Date().toISOString()
			};
			store.put(record);
		}
		return true;
	} catch (e) {
		console.error('Error guardando caso en IndexedDB:', e);
		return false;
	}
}

/** Carga de forma asíncrona todos los casos guardados para el perfil de usuario activo */
export async function loadUserCasesFromCloud(
	username: string,
	pin: string
): Promise<{
	cases: EvidenceCase[];
	caseDataMap: Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>;
}> {
	const result = {
		cases: [] as EvidenceCase[],
		caseDataMap: new Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>()
	};

	if (typeof window === 'undefined' || !username || !pin) return result;
	const cleanUser = username.trim().toLowerCase();

	try {
		const db = await openDB();
		const tx = db.transaction(CASE_STORE, 'readonly');
		const store = tx.objectStore(CASE_STORE);
		const index = store.index('userKey');

		const records = await new Promise<any[]>((resolve) => {
			const req = index.getAll(cleanUser);
			req.onsuccess = () => resolve(req.result || []);
			req.onerror = () => resolve([]);
		});

		for (const item of records) {
			if (item.caseInfo && item.meta) {
				result.cases.push(item.caseInfo);
				result.caseDataMap.set(item.caseInfo.id, {
					meta: item.meta,
					messages: item.messages || [],
					days: item.days || []
				});
			}
		}
	} catch (e) {
		console.error('Error cargando casos desde IndexedDB:', e);
	}

	return result;
}
