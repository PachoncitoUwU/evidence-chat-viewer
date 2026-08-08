/**
 * whatsappParser.ts — Parser completo de exportaciones WhatsApp
 * Formato latinoamericano e internacional (Android/iOS, 12h/24h)
 */

import JSZip from 'jszip';
import type {
	ChatMessage, ChatMeta, DaySummary,
	MediaAttachment, MediaKind, ParsedChat, ParserWarning, CallInfo
} from './types/chat.types';

function detectCallInfo(text: string): CallInfo | null {
	if (!text) return null;
	const lower = text.toLowerCase();
	const isCall = /llamada|videollamada|call|video call|voice call/i.test(lower);
	if (!isCall) return null;

	const isVideo = /video|videollamada/i.test(lower);
	const type: 'voice' | 'video' = isVideo ? 'video' : 'voice';

	let status: 'missed' | 'declined' | 'answered' | 'completed' = 'completed';
	if (/perdida|missed/i.test(lower)) {
		status = 'missed';
	} else if (/rechazada|declined|cancelada|canceled|cancelled/i.test(lower)) {
		status = 'declined';
	} else if (/entrante|saliente|incoming|outgoing|contestada|answered/i.test(lower)) {
		status = 'answered';
	}

	const durMatch = text.match(/\(([^)]+)\)/);
	const duration = durMatch ? durMatch[1] : undefined;

	return { type, status, duration };
}


// ── Regex ──────────────────────────────────────────────────────────

// Línea de mensaje con remitente (soporta Android e iPhone / iOS, corchetes [], segundos, AM/PM, tilde ~ en nombres, coma opcional, guion opcional)
const LINE_RE = /^\[?(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([\u202f\u00a0\s]*(?:a\.\s*m\.|p\.\s*m\.|am|pm|a\.m\.|p\.m\.))?\]?(?:\s*[-\u2013]\s*|\s+)(~?\s*[^:]+?):\s+([\s\S]*)$/i;

// Línea de sistema (sin remitente)
const SYSTEM_RE = /^\[?(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([\u202f\u00a0\s]*(?:a\.\s*m\.|p\.\s*m\.|am|pm|a\.m\.|p\.m\.))?\]?\s*(?:[-\u2013]\s*)?(.+)$/i;

// Multimedia omitido
const OMITTED_RE = /<Multimedia omitido>|<Media omitted>|<adjunto omitido>|<attached omitted>/i;

// Texto que acompaña adjuntos en WhatsApp iOS/Android: "(archivo adjunto)", "(file attached)", "<adjunto: ...>", "<attached: ...>", etc.
const ATTACHED_LABEL_RE = /\(archivo adjunto\)|\(file attached\)|<adjunto:.*?>|<attached:.*?>/gi;

// Extensiones reconocidas
const FILE_EXT_PATTERN = '(?:jpg|jpeg|png|gif|webp|bmp|svg|mp4|mov|avi|webm|3gp|mkv|flv|opus|mp3|ogg|aac|m4a|wav|flac|wma|pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z|vcf|psc)';

// Regex para extraer nombres de archivo multimedia de cualquier línea (Android e iOS)
const MEDIA_EXTRACT_RE = new RegExp(
	'(?:<adjunto:\\s*([^>]+)>|<attached:\\s*([^>]+)>|<[a-z]+:\\s*([^>]+)>|((?:IMG|VID|PTT|AUD|DOC|STK|VIDEO|AUDIO|GIF|VOICE|PHOTO)-[\\w\\-.]+\\.\\w+|[0-9a-fA-F\\-_.]+\\.' + FILE_EXT_PATTERN + '|[\\w\\-. \\u00c0-\\u024f]+\\.' + FILE_EXT_PATTERN + '))',
	'i'
);

const STICKER_RE = /STK-[\w\-.]+\.webp$/i;

// ── Helpers ────────────────────────────────────────────────────────

function stripInvisible(s: string): string {
	if (!s) return '';
	return s
		.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]/g, '')
		.replace(/[\u202f\u00a0]/g, ' ')
		.trim();
}

function normalizeAMPM(hour: number, minute: number, ampm: string | undefined): { h: number; m: number } {
	if (!ampm) return { h: hour, m: minute };
	const lower = ampm.replace(/\s/g, '').toLowerCase();
	if (lower === 'p.m.' || lower === 'pm') return { h: hour === 12 ? 12 : hour + 12, m: minute };
	if (lower === 'a.m.' || lower === 'am') return { h: hour === 12 ? 0 : hour, m: minute };
	return { h: hour, m: minute };
}

function parseDate(dateStr: string, timeStr: string, ampm: string | undefined) {
	const cleanDate = dateStr.replace(/[^\d/.-]/g, '');
	const parts = cleanDate.split(/[/.-]/);
	if (parts.length !== 3) return null;
	let [d, mo, y] = parts.map(Number);
	if (isNaN(d) || isNaN(mo) || isNaN(y)) return null;
	if (y < 100) y += 2000;
	const timeParts = timeStr.split(':');
	let hour = Number(timeParts[0]);
	const minute = Number(timeParts[1]);
	if (isNaN(hour) || isNaN(minute)) return null;
	const norm = normalizeAMPM(hour, minute, ampm);
	hour = norm.h;
	const isoDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	const isoTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
	const tsMs = new Date(`${isoDate}T${isoTime}:00`).getTime();
	return { iso: isoDate, timeIso: isoTime, tsMs };
}

function detectMediaKind(fileName: string): MediaKind {
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
	if (['mp4','mov','avi','webm','3gp','mkv','flv'].includes(ext)) return 'video';
	if (['opus','mp3','ogg','aac','m4a','wav','flac','wma'].includes(ext)) return 'audio';
	if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','rar','7z','vcf','psc'].includes(ext)) return 'document';
	return 'unknown';
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash).toString(16).padStart(8, '0');
}

async function sha256(text: string): Promise<string> {
	try {
		const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
		return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
	} catch { return simpleHash(text); }
}

function guessMime(fileName: string): string {
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	const m: Record<string,string> = {
		jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp',
		bmp:'image/bmp', svg:'image/svg+xml',
		mp4:'video/mp4', mov:'video/quicktime', avi:'video/x-msvideo', webm:'video/webm',
		'3gp':'video/3gpp', mkv:'video/x-matroska', flv:'video/x-flv',
		opus:'audio/ogg', mp3:'audio/mpeg', ogg:'audio/ogg', aac:'audio/aac', 
		m4a:'audio/mp4', wav:'audio/wav', flac:'audio/flac', wma:'audio/x-ms-wma',
		pdf:'application/pdf',
		doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		ppt:'application/vnd.ms-powerpoint', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		txt:'text/plain', csv:'text/csv', 
		zip:'application/zip', rar:'application/x-rar-compressed', '7z':'application/x-7z-compressed',
		vcf:'text/vcard', psc:'text/plain'
	};
	return m[ext] ?? 'application/octet-stream';
}

// ── Core parser ────────────────────────────────────────────────────

async function parseTxt(
	rawText: string,
	mediaFiles: Map<string, Blob>,
	sourceFileName: string
): Promise<ParsedChat> {
	const lines = rawText.split(/\r?\n/);
	const messages: ChatMessage[] = [];
	const warnings: ParserWarning[] = [];
	const participantSet = new Set<string>();
	let idx = 0;
	let lineNum = 0;

	// Mapa normalizado en minúsculas de mediaFiles para búsqueda rápida
	const normalizedMediaMap = new Map<string, Blob>();
	for (const [key, blob] of mediaFiles.entries()) {
		const cleanKey = stripInvisible(key).toLowerCase();
		normalizedMediaMap.set(cleanKey, blob);
		normalizedMediaMap.set(key.toLowerCase(), blob);
	}

	while (lineNum < lines.length) {
		const raw = lines[lineNum];
		lineNum++;
		if (!raw.trim()) continue;

		const match = LINE_RE.exec(raw);
		if (match) {
			const [, dateStr, timeStr, ampmRaw, senderName, msgText] = match;
			const parsed = parseDate(dateStr, timeStr, ampmRaw?.trim());
			if (!parsed) {
				warnings.push({ lineNumber: lineNum, rawLine: raw, reason: 'unparseable-date' });
				continue;
			}

			// Acumular líneas de continuación
			let fullText = msgText;
			while (lineNum < lines.length) {
				const next = lines[lineNum];
				if (LINE_RE.test(next) || SYSTEM_RE.test(next)) break;
				fullText += '\n' + next;
				lineNum++;
			}

			const cleanSender = senderName.replace(/^~\s*/, '').trim();
			participantSet.add(cleanSender);

			// ── Detectar adjunto ──
			let attachment: MediaAttachment | null = null;
			let textClean = fullText;

			const cleanFullText = stripInvisible(fullText);

			if (OMITTED_RE.test(cleanFullText)) {
				attachment = { fileName:'', kind:'unknown', previewUrl:null, sizeBytes:null, durationSeconds:null, status:'omitted', isSticker:false };
				textClean = '';
			} else {
				// Buscar patrón de archivo multimedia en el texto del mensaje
				const fileMatch = MEDIA_EXTRACT_RE.exec(cleanFullText);
				if (fileMatch) {
					const rawMatchedFile = fileMatch.slice(1).find((g) => g && typeof g === 'string' && g.trim().length > 0);
					if (rawMatchedFile) {
						const fileName = rawMatchedFile.trim();
						const cleanName = stripInvisible(fileName);
						const kind = detectMediaKind(cleanName);
						const isSticker = STICKER_RE.test(cleanName) || cleanName.toLowerCase().startsWith('stk-');

						// Buscar blob en la colección extraída del ZIP
						const blob = normalizedMediaMap.get(cleanName.toLowerCase())
							?? normalizedMediaMap.get(fileName.toLowerCase());

						let previewUrl: string | null = null;
						let sizeBytes: number | null = null;

						if (blob) {
							sizeBytes = blob.size;
							previewUrl = await new Promise<string>((resolve) => {
								const reader = new FileReader();
								reader.onloadend = () => resolve((reader.result as string) || '');
								reader.onerror = () => resolve('');
								reader.readAsDataURL(blob);
							});
						}

						attachment = {
							fileName: cleanName,
							kind,
							previewUrl,
							sizeBytes,
							durationSeconds: null,
							status: blob ? 'linked' : 'missing',
							isSticker
						};

						// Limpiar el texto eliminado el nombre del archivo y la etiqueta de adjunto
						textClean = fullText
							.replace(MEDIA_EXTRACT_RE, '')
							.replace(ATTACHED_LABEL_RE, '')
							.trim();
					}
				}
			}

			// Limpiar texto residual
			textClean = stripInvisible(textClean)
				.replace(/<Este mensaje fue editado>|<This message was edited>/g, '')
				.trim();
			const wasEdited = fullText.includes('<Este mensaje fue editado>') || fullText.includes('<This message was edited>');

			// Detectar llamadas de WhatsApp
			const callInfo = detectCallInfo(textClean || fullText);

			messages.push({
				id: `msg-${idx++}-${parsed.tsMs}`,
				date: parsed.iso, time: parsed.timeIso, timestampMs: parsed.tsMs,
				senderName: cleanSender, senderRole: 'counterpart',
				text: textClean, isSystemEvent: false, wasEdited,
				attachment, callInfo, sourceLine: raw, sourceLineNumber: lineNum
			});
			continue;
		}

		// Evento de sistema
		const sysMatch = SYSTEM_RE.exec(raw);
		if (sysMatch) {
			const [, dateStr, timeStr, ampmRaw, sysText] = sysMatch;
			const parsed = parseDate(dateStr, timeStr, ampmRaw?.trim());
			if (parsed) {
				messages.push({
					id: `sys-${idx++}`, date: parsed.iso, time: parsed.timeIso, timestampMs: parsed.tsMs,
					senderName: 'Sistema', senderRole: 'system',
					text: stripInvisible(sysText), isSystemEvent: true, wasEdited: false,
					attachment: null, sourceLine: raw, sourceLineNumber: lineNum
				});
			}
			continue;
		}

		// Continuación de mensaje anterior
		if (messages.length > 0) {
			const last = messages[messages.length - 1];
			if (!last.isSystemEvent) {
				last.text += '\n' + raw;
			}
		}
	}

	// ── Inferir owner ──
	const countByName = new Map<string, number>();
	for (const msg of messages) {
		if (!msg.isSystemEvent) countByName.set(msg.senderName, (countByName.get(msg.senderName) ?? 0) + 1);
	}

	let inferredOwner: string | null = null;
	const contactMatch = sourceFileName.match(/con\s+(.+?)(?:\.txt|\.zip)?$/i);
	if (contactMatch) {
		const contactName = contactMatch[1].trim().toLowerCase();
		for (const name of participantSet) {
			if (!name.toLowerCase().includes(contactName) && name !== 'Sistema') {
				inferredOwner = name; break;
			}
		}
	}
	if (!inferredOwner) {
		let maxCount = 0;
		for (const [name, count] of countByName) {
			if (count > maxCount && name !== 'Sistema') { maxCount = count; inferredOwner = name; }
		}
	}

	for (const msg of messages) {
		if (msg.isSystemEvent) msg.senderRole = 'system';
		else if (inferredOwner && msg.senderName === inferredOwner) msg.senderRole = 'owner';
		else msg.senderRole = 'counterpart';
	}

	// ── Días ──
	const dayMap = new Map<string, DaySummary>();
	for (const msg of messages) {
		if (msg.isSystemEvent) continue;
		const ex = dayMap.get(msg.date);
		if (ex) {
			ex.messageCount++;
			if (msg.attachment?.status === 'linked') ex.mediaCount++;
			ex.lastTimestampMs = Math.max(ex.lastTimestampMs, msg.timestampMs);
		} else {
			dayMap.set(msg.date, {
				date: msg.date, messageCount: 1,
				mediaCount: msg.attachment?.status === 'linked' ? 1 : 0,
				firstTimestampMs: msg.timestampMs, lastTimestampMs: msg.timestampMs
			});
		}
	}
	const days = [...dayMap.values()].sort((a,b) => a.firstTimestampMs - b.firstTimestampMs);

	const nonSys = messages.filter(m => !m.isSystemEvent);
	const totalMediaLinked = messages.filter(m => m.attachment?.status === 'linked').length;
	const totalMediaMissing = messages.filter(m => m.attachment?.status === 'missing').length;
	const sourceHash = await sha256(rawText.slice(0, 50000));

	let title = sourceFileName.replace(/\.zip|\.txt/gi,'').replace(/Chat de WhatsApp con\s*/i,'').trim();
	if (!title) title = [...participantSet].filter(n => n !== inferredOwner && n !== 'Sistema').join(', ') || 'Chat';

	const meta: ChatMeta = {
		title, participants: [...participantSet],
		totalMessages: nonSys.length, totalMediaLinked, totalMediaMissing,
		dateRangeStart: days[0]?.date ?? null, dateRangeEnd: days[days.length-1]?.date ?? null,
		sourceFileName, sourceHash, parsedAt: new Date().toISOString()
	};

	return { meta, messages, days, warnings };
}

// ── Public API ─────────────────────────────────────────────────────

export async function parseWhatsAppFile(file: File): Promise<ParsedChat> {
	const name = file.name.toLowerCase();

	if (name.endsWith('.zip')) {
		const zip = await JSZip.loadAsync(await file.arrayBuffer());
		let txtContent: string | null = null;
		const mediaFiles = new Map<string, Blob>();

		for (const [entryName, entry] of Object.entries(zip.files)) {
			if (entry.dir) continue;
			// Obtener solo el nombre del archivo sin subcarpetas
			const rawBase = entryName.split('/').pop() ?? entryName;
			const baseName = stripInvisible(rawBase);

			if (baseName.toLowerCase().endsWith('.txt')) {
				try {
					let raw = await entry.async('text');
					if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
					txtContent = raw;
				} catch {
					const buf = await entry.async('uint8array');
					txtContent = new TextDecoder('utf-8', { fatal: false }).decode(buf);
					if (txtContent.charCodeAt(0) === 0xFEFF) txtContent = txtContent.slice(1);
				}
			} else {
				const arrayBuffer = await entry.async('arraybuffer');
				const mimeType = guessMime(baseName);
				const blob = new Blob([arrayBuffer], { type: mimeType });
				mediaFiles.set(baseName, blob);
				mediaFiles.set(baseName.toLowerCase(), blob);
				if (rawBase !== baseName) {
					mediaFiles.set(rawBase, blob);
					mediaFiles.set(rawBase.toLowerCase(), blob);
				}
			}
		}

		if (!txtContent) throw new Error('No se encontró el archivo .txt dentro del ZIP de WhatsApp.');
		return parseTxt(txtContent, mediaFiles, file.name);

	} else if (name.endsWith('.txt')) {
		const text = await file.text();
		return parseTxt(text, new Map(), file.name);
	} else {
		throw new Error('Formato no compatible. Usa un .zip o .txt exportado de WhatsApp.');
	}
}

export async function extractMediaFromZip(file: File): Promise<Map<string, { blob: Blob; kind: MediaKind; fileName: string }>> {
	const result = new Map<string, { blob: Blob; kind: MediaKind; fileName: string }>();
	if (!file.name.toLowerCase().endsWith('.zip')) return result;

	const zip = await JSZip.loadAsync(await file.arrayBuffer());
	for (const [entryName, entry] of Object.entries(zip.files)) {
		if (entry.dir) continue;
		const rawBase = entryName.split('/').pop() ?? entryName;
		const baseName = stripInvisible(rawBase);
		if (baseName.toLowerCase().endsWith('.txt')) continue;
		const arrayBuffer = await entry.async('arraybuffer');
		const mimeType = guessMime(baseName);
		const blob = new Blob([arrayBuffer], { type: mimeType });
		result.set(baseName, { blob, kind: detectMediaKind(baseName), fileName: baseName });
	}
	return result;
}

