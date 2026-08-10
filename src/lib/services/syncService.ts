/**
 * syncService.ts
 * ------------------------------------------------------------------
 * Servicio de sincronización automática en la nube (Supabase Database & Storage).
 * Optimizado para cargas masivas de chats pesados (>600MB ZIPs) sin caídas.
 * ------------------------------------------------------------------
 */

import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
import type { EvidenceCase, ChatMeta, ChatMessage, DaySummary, MediaAttachment, MediaKind } from '$types/chat.types';

export interface CloudChatSummary {
	id: string;
	userKey: string;
	title: string;
	exportFileName: string;
	parsedDate: string;
	totalMessages: number;
	totalMedia: number;
	startDate: string | null;
	endDate: string | null;
	createdAt: string;
}

function safeIsoDate(val: any): string | null {
	if (!val) return null;
	try {
		const d = new Date(val);
		if (isNaN(d.getTime())) return null;
		return d.toISOString();
	} catch {
		return null;
	}
}

function safeTimestamp(msg: ChatMessage): number {
	if (typeof msg.timestampMs === 'number' && !isNaN(msg.timestampMs) && msg.timestampMs > 0) {
		return Math.floor(msg.timestampMs);
	}
	if (msg.date) {
		try {
			const parsed = new Date(msg.date).getTime();
			if (!isNaN(parsed) && parsed > 0) return Math.floor(parsed);
		} catch {
			// ignore
		}
	}
	return Date.now();
}

/**
 * Suba un caso completo con sus mensajes y archivos multimedia extraídos del ZIP a Supabase.
 * Procesa en lotes paralelos (8 archivos simultáneos) y bloques de 500 filas para PostgreSQL REST.
 */
export async function uploadCaseToSupabase(
	userKey: string,
	caseInfo: EvidenceCase,
	meta: ChatMeta,
	messages: ChatMessage[],
	days: DaySummary[],
	mediaBlobs?: Map<string, Blob>,
	onProgress?: (stage: string, percent: number) => void
): Promise<string> {
	if (!isSupabaseConfigured()) {
		throw new Error('Supabase no está configurado correctamente.');
	}

	const cleanUser = userKey.trim().toLowerCase();
	const chatId = caseInfo.id || `case-${Date.now()}`;

	if (onProgress) onProgress('Guardando registro del chat en la nube...', 10);

	// 1. Guardar metadatos del chat en la tabla `chats`
	const { error: chatError } = await supabase
		.from('chats')
		.upsert(
			{
				id: chatId,
				user_id: cleanUser,
				title: meta.title || caseInfo.name || 'Chat WhatsApp',
				export_file_name: meta.sourceFileName || 'export.zip',
				parsed_date: new Date().toISOString(),
				total_messages: meta.totalMessages || messages.length,
				total_media: (meta.totalMediaLinked || 0) + (meta.totalMediaMissing || 0),
				start_date: safeIsoDate(meta.dateRangeStart),
				end_date: safeIsoDate(meta.dateRangeEnd),
				timeline_json: days || [],
				participants_json: meta.participants || [],
				metadata_json: {
					sourceHash: meta.sourceHash,
					parsedAt: meta.parsedAt
				},
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'id' }
		);

	if (chatError) {
		console.error('Error guardando tabla chats en Supabase:', chatError.message);
		throw new Error(`Error en Supabase (chats): ${chatError.message}`);
	}

	// 2. PASO CRÍTICO: Guardar TODOS los mensajes INMEDIATAMENTE en la base de datos (Ultra-rápido: ~3 segundos)
	// Esto garantiza que el chat completo ya sea visible desde cualquier celular o PC de inmediato.
	if (onProgress) onProgress('Sincronizando mensajes de texto en la nube...', 25);

	const totalMsgs = messages.length;
	const dbBatchSize = 500;

	for (let i = 0; i < totalMsgs; i += dbBatchSize) {
		const chunk = messages.slice(i, i + dbBatchSize);

		const messageRecords = chunk.map((msg, idx) => {
			const mediaFileName = msg.attachment?.fileName || null;
			const mediaType = msg.attachment?.kind || null;

			return {
				id: msg.id || `${chatId}_msg_${i + idx}`,
				chat_id: chatId,
				user_id: cleanUser,
				msg_index: i + idx,
				timestamp: safeTimestamp(msg),
				date_str: msg.date || '',
				time_str: msg.time || '',
				sender: msg.senderName || 'Usuario',
				is_me: msg.senderRole === 'owner',
				is_system: Boolean(msg.isSystemEvent),
				text: msg.text || '',
				media_file_name: mediaFileName,
				media_type: mediaType,
				media_url: msg.attachment?.previewUrl?.startsWith('http') ? msg.attachment.previewUrl : null,
				raw_line: msg.sourceLine || '',
				hash: '',
				bookmarked: false,
				notes: ''
			};
		});

		const { error: msgInsertError } = await supabase
			.from('messages')
			.upsert(messageRecords, { onConflict: 'id' });

		if (msgInsertError) {
			console.error('Error insertando lote de mensajes en Supabase:', msgInsertError.message);
			throw new Error(`Error en Supabase (mensajes): ${msgInsertError.message}`);
		}

		if (onProgress) {
			const currentDone = Math.min(i + dbBatchSize, totalMsgs);
			const percent = 25 + Math.round((currentDone / totalMsgs) * 35);
			onProgress(`Sincronizando mensajes (${currentDone}/${totalMsgs})...`, percent);
		}
	}

	// 3. Subir adjuntos multimedia al bucket `chat-media` (Procesamiento robusto para ZIPs pesados >600MB)
	if (mediaBlobs && mediaBlobs.size > 0) {
		if (onProgress) onProgress('Subiendo archivos multimedia y fotos...', 60);

		let uploadedCount = 0;
		const totalBlobs = mediaBlobs.size;
		const entries = Array.from(mediaBlobs.entries());
		const mediaUrlMap = new Map<string, string>();

		// Lotes de 8 descargas concurrentes optimizadas
		const batchSize = 8;
		const MAX_FILE_SIZE_BYTES = 48 * 1024 * 1024; // Límite seguro de 48MB por archivo individual para Supabase Storage

		for (let i = 0; i < entries.length; i += batchSize) {
			const chunk = entries.slice(i, i + batchSize);

			await Promise.all(
				chunk.map(async ([fileName, blob]) => {
					try {
						// Ignorar archivos excesivamente grandes (>48MB) para evitar caídas de Storage
						if (blob.size > MAX_FILE_SIZE_BYTES) {
							console.warn(`Omitiendo ${fileName} por superar el límite individual de Storage (48MB)`);
							return;
						}

						const sanitizeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
						const storagePath = `${cleanUser}/${chatId}/${sanitizeFileName}`;

						const { error: uploadError } = await supabase.storage
							.from('chat-media')
							.upload(storagePath, blob, {
								cacheControl: '3600',
								upsert: true
							});

						if (!uploadError) {
							const { data: publicUrlData } = supabase.storage
								.from('chat-media')
								.getPublicUrl(storagePath);

							if (publicUrlData?.publicUrl) {
								mediaUrlMap.set(fileName, publicUrlData.publicUrl);
								mediaUrlMap.set(fileName.toLowerCase(), publicUrlData.publicUrl);

								// Actualización asíncrona de la URL del mensaje en la base de datos
								await supabase
									.from('messages')
									.update({ media_url: publicUrlData.publicUrl })
									.eq('chat_id', chatId)
									.eq('media_file_name', fileName);
							}
						}
					} catch (err) {
						console.warn(`Error secundario al subir adjunto ${fileName}:`, err);
					}
				})
			);

			uploadedCount += chunk.length;
			if (onProgress) {
				const percent = 60 + Math.round((uploadedCount / totalBlobs) * 40);
				onProgress(`Subiendo archivos multimedia (${uploadedCount}/${totalBlobs})...`, percent);
			}
		}
	}

	if (onProgress) onProgress('¡Sincronización en la nube completa!', 100);

	return chatId;
}

/**
 * Obtiene la lista de chats guardados en la nube para un usuario.
 */
export async function fetchUserSupabaseChats(userKey: string): Promise<CloudChatSummary[]> {
	if (!isSupabaseConfigured() || !userKey) return [];
	const cleanUser = userKey.trim().toLowerCase();

	const { data, error } = await supabase
		.from('chats')
		.select('*')
		.eq('user_id', cleanUser)
		.order('updated_at', { ascending: false });

	if (error) {
		console.warn('Error al obtener chats del usuario desde Supabase:', error.message);
		return [];
	}

	return (data || []).map((row) => ({
		id: row.id,
		userKey: row.user_id,
		title: row.title,
		exportFileName: row.export_file_name,
		parsedDate: row.parsed_date,
		totalMessages: row.total_messages,
		totalMedia: row.total_media,
		startDate: row.start_date,
		endDate: row.end_date,
		createdAt: row.created_at
	}));
}

/**
 * Carga la sesión completa de un chat desde Supabase (reconstruyendo mensajes y adjuntos).
 */
export async function loadSupabaseChatSession(
	chatId: string
): Promise<{ caseInfo: EvidenceCase; meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] } | null> {
	if (!isSupabaseConfigured() || !chatId) return null;

	const { data: chatRow, error: chatError } = await supabase
		.from('chats')
		.select('*')
		.eq('id', chatId)
		.single();

	if (chatError || !chatRow) {
		console.warn('No se encontró el chat en Supabase:', chatError?.message);
		return null;
	}

	let msgRows: any[] = [];
	let fromIndex = 0;
	const pageSize = 1000;
	while (true) {
		const { data: chunk, error: msgError } = await supabase
			.from('messages')
			.select('*')
			.eq('chat_id', chatId)
			.order('msg_index', { ascending: true })
			.range(fromIndex, fromIndex + pageSize - 1);

		if (msgError) {
			console.warn('Error al cargar mensajes desde Supabase:', msgError.message);
			break;
		}
		if (!chunk || chunk.length === 0) break;
		msgRows.push(...chunk);
		if (chunk.length < pageSize) break;
		fromIndex += pageSize;
	}

	const messages: ChatMessage[] = (msgRows || []).map((row, idx) => {
		let attachment: MediaAttachment | null = null;
		if (row.media_file_name) {
			const isSticker = row.media_file_name.startsWith('STK-') || row.media_file_name.endsWith('.webp');
			attachment = {
				fileName: row.media_file_name,
				kind: (row.media_type as MediaKind) || 'image',
				previewUrl: row.media_url || null,
				sizeBytes: null,
				durationSeconds: null,
				status: row.media_url ? 'linked' : 'missing',
				isSticker
			};
		}

		return {
			id: row.id,
			date: row.date_str || new Date(Number(row.timestamp || Date.now())).toISOString().slice(0, 10),
			time: row.time_str || '00:00',
			timestampMs: Number(row.timestamp || Date.now()),
			senderName: row.sender || 'Usuario',
			senderRole: row.is_me ? 'owner' : (row.is_system ? 'system' : 'counterpart'),
			text: row.text || '',
			isSystemEvent: Boolean(row.is_system),
			wasEdited: false,
			attachment,
			sourceLine: row.raw_line || row.text || '',
			sourceLineNumber: row.msg_index || idx + 1
		};
	});

	const meta: ChatMeta = {
		title: chatRow.title || 'Chat recuperado',
		participants: chatRow.participants_json || [],
		totalMessages: chatRow.total_messages || messages.length,
		totalMediaLinked: messages.filter(m => m.attachment?.status === 'linked').length,
		totalMediaMissing: messages.filter(m => m.attachment?.status === 'missing').length,
		dateRangeStart: chatRow.start_date || (messages[0]?.date ?? null),
		dateRangeEnd: chatRow.end_date || (messages[messages.length - 1]?.date ?? null),
		sourceFileName: chatRow.export_file_name || 'export.zip',
		sourceHash: chatRow.metadata_json?.sourceHash || null,
		parsedAt: chatRow.parsed_date || new Date().toISOString()
	};

	const caseInfo: EvidenceCase = {
		id: chatRow.id,
		name: chatRow.title || 'Chat Nube',
		description: `${meta.totalMessages} mensajes · Nube Supabase`,
		createdAt: chatRow.created_at || new Date().toISOString(),
		chats: [meta]
	};

	return {
		caseInfo,
		meta,
		messages,
		days: chatRow.timeline_json || []
	};
}

/**
 * Guarda en segundo plano la estrella / marcador de un mensaje en Supabase.
 */
export async function autoSaveMessageBookmark(messageId: string, bookmarked: boolean): Promise<void> {
	if (!isSupabaseConfigured() || !messageId) return;
	const { error } = await supabase
		.from('messages')
		.update({ bookmarked })
		.eq('id', messageId);

	if (error) {
		console.warn('Error al actualizar marcador en Supabase:', error.message);
	}
}

/**
 * Elimina un chat y todos sus mensajes de Supabase Database y Storage con seguridad.
 */
export async function deleteCaseFromSupabase(userKey: string, chatId: string): Promise<boolean> {
	if (!isSupabaseConfigured() || !chatId) return false;
	const cleanUser = userKey.trim().toLowerCase();

	try {
		// 1. Eliminar mensajes
		await supabase.from('messages').delete().eq('chat_id', chatId);

		// 2. Eliminar chat
		await supabase.from('chats').delete().eq('id', chatId);

		// 3. Limpiar Storage
		const { data: files } = await supabase.storage.from('chat-media').list(`${cleanUser}/${chatId}`);
		if (files && files.length > 0) {
			const paths = files.map((f) => `${cleanUser}/${chatId}/${f.name}`);
			await supabase.storage.from('chat-media').remove(paths);
		}

		return true;
	} catch (e) {
		console.warn('Error al eliminar chat de Supabase:', e);
		return false;
	}
}
