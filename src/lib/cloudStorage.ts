import type { EvidenceCase, ChatMeta, ChatMessage, DaySummary } from '$types/chat.types';

export interface StoredCaseData {
	caseId: string;
	meta: ChatMeta;
	messages: ChatMessage[];
	days: DaySummary[];
}

function getStorageKey(username: string, pin: string): string {
	const cleanUser = username.trim().toLowerCase();
	const cleanPin = pin.trim();
	return `chatviewer_cloud_${cleanUser}_${cleanPin}`;
}

export function saveUserCasesToCloud(
	username: string,
	pin: string,
	cases: EvidenceCase[],
	caseDataMap: Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>
): boolean {
	if (typeof window === 'undefined' || !username || !pin) return false;

	try {
		const key = getStorageKey(username, pin);
		const fullData = cases.map(c => {
			const data = caseDataMap.get(c.id);
			return {
				caseInfo: c,
				meta: data?.meta || c.chats[0],
				messages: data?.messages || [],
				days: data?.days || []
			};
		});

		localStorage.setItem(key, JSON.stringify(fullData));
		return true;
	} catch (e) {
		console.error('Error guardando casos en almacenamiento:', e);
		return false;
	}
}

export function loadUserCasesFromCloud(
	username: string,
	pin: string
): {
	cases: EvidenceCase[];
	caseDataMap: Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>;
} {
	const result = {
		cases: [] as EvidenceCase[],
		caseDataMap: new Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>()
	};

	if (typeof window === 'undefined' || !username || !pin) return result;

	try {
		const key = getStorageKey(username, pin);
		const raw = localStorage.getItem(key);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					if (item.caseInfo && item.meta) {
						result.cases.push(item.caseInfo);
						result.caseDataMap.set(item.caseInfo.id, {
							meta: item.meta,
							messages: item.messages || [],
							days: item.days || []
						});
					}
				}
			}
		}
	} catch (e) {
		console.error('Error cargando casos desde almacenamiento:', e);
	}

	return result;
}
