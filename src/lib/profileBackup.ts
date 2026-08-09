/**
 * profileBackup.ts
 * ------------------------------------------------------------------
 * Generador y cargador de copias de seguridad de perfil (.chatpack).
 * Permite transferir todos los chats guardados, evidencias y elementos ocultos
 * entre computadores y celulares en 3 segundos sin costo.
 * ------------------------------------------------------------------
 */

import type { EvidenceCase, ChatMeta, ChatMessage, DaySummary } from '$types/chat.types';

export interface ProfileBackupBundle {
	version: string;
	username: string;
	exportedAt: string;
	cases: EvidenceCase[];
	caseDataList: Array<{
		caseId: string;
		meta: ChatMeta;
		messages: ChatMessage[];
		days: DaySummary[];
	}>;
	hiddenItems: string[];
}

export function exportProfileBackup(
	username: string,
	cases: EvidenceCase[],
	caseDataMap: Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>,
	hiddenSet: Set<string>
) {
	const dataList = [];
	for (const c of cases) {
		const data = caseDataMap.get(c.id);
		if (data) {
			dataList.push({
				caseId: c.id,
				meta: data.meta,
				messages: data.messages,
				days: data.days
			});
		}
	}

	const bundle: ProfileBackupBundle = {
		version: '1.4.7',
		username: username || 'usuario',
		exportedAt: new Date().toISOString(),
		cases,
		caseDataList: dataList,
		hiddenItems: Array.from(hiddenSet)
	};

	const json = JSON.stringify(bundle);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = `respaldo_perfil_${username || 'perito'}_${new Date().toISOString().slice(0, 10)}.chatpack`;
	a.click();
	URL.revokeObjectURL(url);
}

export async function parseProfileBackupFile(file: File): Promise<ProfileBackupBundle> {
	const text = await file.text();
	const parsed = JSON.parse(text) as ProfileBackupBundle;

	if (!parsed || !Array.isArray(parsed.cases) || !Array.isArray(parsed.caseDataList)) {
		throw new Error('El archivo de respaldo seleccionado no tiene un formato .chatpack válido.');
	}

	return parsed;
}
