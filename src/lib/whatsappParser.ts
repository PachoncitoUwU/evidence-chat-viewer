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
const LINE_RE = /^\[?(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([\u202f\u00a0\s]*(?:a\.\s*m\.|p\.\s*m\.|am|pm|a\.m\.|p\.m\.))?\]?(?:\s*[-\u2013]\s*|\s+)(~?\s*[^:]+?):\s*([\s\S]*)$/i;

// Línea de sistema (sin remitente)
const SYSTEM_RE = /^\[?(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([\u202f\u00a0\s]*(?:a\.\s*m\.|p\.\s*m\.|am|pm|a\.m\.|p\.m\.))?\]?\s*(?:[-\u2013]\s*)?(.+)$/i;

// Multimedia omitido (Android e iPhone / iOS en español e inglés)
const OMITTED_RE = /<Multimedia omitido>|<Media omitted>|<adjunto omitido>|<attached omitted>|video omitido|imagen omitida|foto omitida|audio omitido|sticker omitido|documento omitido|contacto omitido|video omitted|image omitted|photo omitted|audio omitted|sticker omitted|document omitted/i;

// Texto que acompaña adjuntos en WhatsApp iOS/Android: "(archivo adjunto)", "(file attached)", "<adjunto: ...>", "<attached: ...>", etc.
const ATTACHED_LABEL_RE = /\(archivo adjunto\)|\(file attached\)|<adjunto:.*?>|<attached:.*?>/gi;

// Extensiones reconocidas
const FILE_EXT_PATTERN = '(?:jpg|jpeg|png|gif|webp|bmp|svg|mp4|mov|avi|webm|3gp|mkv|flv|opus|mp3|ogg|aac|m4a|wav|flac|wma|pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z|vcf|psc)';

// Regex para extraer nombres de archivo multimedia de cualquier línea (Android e iOS)
const MEDIA_EXTRACT_RE = new RegExp(
	'(?:<adjunto:\\s*([^>]+)>|<attached:\\s*([^>]+)>|<[a-z]+:\\s*([^>]+)>|((?:IMG|VID|PTT|AUD|DOC|STK|VIDEO|AUDIO|GIF|VOICE|PHOTO)-[\\w\\-.]+\\.\\w+|[0-9a-fA-F\\-_.]+\\.' + FILE_EXT_PATTERN + '|[\\w\\-. \\u00c0-\\u024f]+\\.' + FILE_EXT_PATTERN + '))',
	'i'
);

const STICKER_RE = /(?:STK-[\w\-.]+\.webp$|[\w\-. ]*sticker[\w\-. ]*\.webp$|[\w\-. ]*-sticker[\w\-. ]*)/i;

// ── Helpers ────────────────────────────────────────────────────────

function stripInvisible(s: string): string {
	if (!s) return '';
	return s
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
		.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u200b]/g, '')
		.replace(/[\u202f\u00a0]/g, ' ')
		.trim();
}

function decodeTxtBuffer(buf: Uint8Array): string {
	if (!buf || buf.length === 0) return '';
	// Detectar BOM UTF-16LE (0xFF 0xFE)
	if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
		return new TextDecoder('utf-16le').decode(buf);
	}
	// Detectar BOM UTF-16BE (0xFE 0xFF)
	if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
		return new TextDecoder('utf-16be').decode(buf);
	}
	// Detectar UTF-16LE sin BOM (común en exportaciones iPhone/Windows):
	// Cada segundo byte es un caracter nulo 0x00
	let nullsInOdd = 0;
	const sample = Math.min(buf.length, 1000);
	for (let i = 1; i < sample; i += 2) {
		if (buf[i] === 0x00) nullsInOdd++;
	}
	if (nullsInOdd > sample / 4) {
		return new TextDecoder('utf-16le').decode(buf);
	}

	// Decodificación UTF-8 por defecto, eliminando nulos
	const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buf);
	return decoded.replace(/\x00/g, '');
}

function normalizeAMPM(hour: number, minute: number, ampm: string | undefined): { h: number; m: number } {
	if (!ampm) return { h: hour, m: minute };
	const lower = ampm.replace(/\s/g, '').toLowerCase();
	if (lower === 'p.m.' || lower === 'pm') return { h: hour === 12 ? 12 : hour + 12, m: minute };
	if (lower === 'a.m.' || lower === 'am') return { h: hour === 12 ? 0 : hour, m: minute };
	return { h: hour, m: minute };
}

function detectChatDateFormat(lines: string[]): 'MDY' | 'DMY' | 'YMD' {
	let ymdVotes = 0;
	let dmyVotes = 0;
	let mdyVotes = 0;

	for (const rawLine of lines) {
		if (!rawLine) continue;
		const stripped = stripInvisible(rawLine);
		const m = LINE_RE.exec(stripped) || SYSTEM_RE.exec(stripped);
		if (!m) continue;
		const dateStr = m[1];
		if (!dateStr) continue;
		const cleanDate = dateStr.replace(/[^\d/.-]/g, '');
		const parts = cleanDate.split(/[/.-]/).map(Number);
		if (parts.length !== 3 || parts.some(isNaN)) continue;
		const [p1, p2, p3] = parts;

		// 4 dígitos en p1 -> YMD
		if (p1 > 1000) return 'YMD';
		// 4 dígitos en p3 -> DMY o MDY
		if (p3 > 1000) {
			if (p2 > 12 && p1 <= 12) mdyVotes += 5;
			else if (p1 > 12 && p2 <= 12) dmyVotes += 5;
			continue;
		}

		// 2 dígitos en todos: solo usamos las claves inequívocas (p1 > 12 = día DMY, p2 > 12 = día MDY)
		// Si p1 > 12 y p2 <= 12 -> p1 es día, p3 es año (DD/MM/YY)
		if (p1 > 12 && p2 <= 12) {
			dmyVotes += 3;
		}
		// Si p2 > 12 y p1 <= 12 -> p2 es día, p1 es mes (MM/DD/YY)
		if (p2 > 12 && p1 <= 12) {
			mdyVotes += 3;
		}
	}

	if (ymdVotes > dmyVotes && ymdVotes > mdyVotes) return 'YMD';
	if (mdyVotes > dmyVotes) return 'MDY';
	return 'DMY';
}

function parseDate(
	dateStr: string,
	timeStr: string,
	ampm: string | undefined,
	detectedFormat: 'MDY' | 'DMY' | 'YMD' = 'DMY'
) {
	const cleanDate = dateStr.replace(/[^\d/.-]/g, '');
	const parts = cleanDate.split(/[/.-]/).map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) return null;

	let d = 1, mo = 1, y = 2026;
	const [p1, p2, p3] = parts;

	if (p1 > 1000) {
		y = p1; mo = p2; d = p3;
	} else if (p3 > 1000) {
		y = p3;
		if (p2 > 12 && p1 <= 12) { mo = p1; d = p2; }
		else if (p1 > 12 && p2 <= 12) { d = p1; mo = p2; }
		else if (detectedFormat === 'MDY') { mo = p1; d = p2; }
		else { d = p1; mo = p2; }
	} else {
		// Todos son de 2 dígitos (ej: 27/02/26 o 02/27/26)
		// Prioridad:
		// 1. Pistas inequívocas: p2 > 12 → MDY (p1=mes, p2=día, p3=año)
		//                        p1 > 12 → DMY (p1=día, p2=mes, p3=año)
		// 2. Si ambos ≤ 12, confiar en el formato detectado
		if (p2 > 12 && p1 <= 12) {
			// Formato MM/DD/YY -> p1 es mes, p2 es día, p3 es año
			y = p3 < 100 ? (p3 < 50 ? p3 + 2000 : p3 + 1900) : p3;
			mo = p1;
			d = p2;
		} else if (p1 > 12 && p2 <= 12) {
			// Formato DD/MM/YY -> p1 es día, p2 es mes, p3 es año
			y = p3 < 100 ? (p3 < 50 ? p3 + 2000 : p3 + 1900) : p3;
			d = p1;
			mo = p2;
		} else if (detectedFormat === 'YMD') {
			// Formato YY/MM/DD -> p1 es año, p2 es mes, p3 es día
			y = p1 < 100 ? (p1 < 50 ? p1 + 2000 : p1 + 1900) : p1;
			mo = p2;
			d = p3;
		} else if (detectedFormat === 'MDY') {
			y = p3 < 100 ? (p3 < 50 ? p3 + 2000 : p3 + 1900) : p3;
			mo = p1;
			d = p2;
		} else {
			// Por defecto DMY
			y = p3 < 100 ? (p3 < 50 ? p3 + 2000 : p3 + 1900) : p3;
			d = p1;
			mo = p2;
		}
	}

	// Corrección de seguridad: si todos los componentes son de 2 dígitos y el año
	// calculado supera el año actual, es un error de interpretación (ej: el día 27
	// fue confundido con el año 2027). Corregimos al año actual como mínimo.
	const currentYear = new Date().getFullYear();
	const allShortForm = p1 < 100 && p2 < 100 && p3 < 100;
	if (allShortForm && y > currentYear) {
		y = currentYear;
	}

	mo = Math.min(12, Math.max(1, mo));
	d = Math.min(31, Math.max(1, d));

	const timeParts = timeStr.split(':');
	let hour = Number(timeParts[0]);
	const minute = Number(timeParts[1]);
	if (isNaN(hour) || isNaN(minute)) return null;

	const norm = normalizeAMPM(hour, minute, ampm);
	hour = norm.h;

	const isoDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	const isoTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

	const dt = new Date(y, mo - 1, d, hour, minute);
	const tsMs = dt.getTime();

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

	const detectedFormat = detectChatDateFormat(lines);

	// Mapa normalizado en minúsculas de mediaFiles para búsqueda rápida
	const normalizedMediaMap = new Map<string, Blob>();
	for (const [key, blob] of mediaFiles.entries()) {
		const cleanKey = stripInvisible(key).toLowerCase();
		normalizedMediaMap.set(cleanKey, blob);
		normalizedMediaMap.set(key.toLowerCase(), blob);
	}

	while (lineNum < lines.length) {
		const rawLine = lines[lineNum];
		lineNum++;
		if (!rawLine || !rawLine.trim()) continue;

		const raw = stripInvisible(rawLine);
		if (!raw) continue;

		const match = LINE_RE.exec(raw);
		if (match) {
			const [, dateStr, timeStr, ampmRaw, senderName, msgText] = match;
			const parsed = parseDate(dateStr, timeStr, ampmRaw?.trim(), detectedFormat);
			if (!parsed) {
				warnings.push({ lineNumber: lineNum, rawLine, reason: 'unparseable-date' });
				continue;
			}

			// Acumular líneas de continuación solo para mensajes de texto sin adjunto
			let fullText = msgText;
			const isAttachmentLine = MEDIA_EXTRACT_RE.test(msgText) || OMITTED_RE.test(msgText) || ATTACHED_LABEL_RE.test(msgText);

			if (!isAttachmentLine) {
				while (lineNum < lines.length) {
					const nextLine = lines[lineNum];
					if (!nextLine) { lineNum++; continue; }
					const next = stripInvisible(nextLine);
					if (LINE_RE.test(next) || SYSTEM_RE.test(next)) break;
					if (/^\[?\d{1,2}[\/.\-]\d{1,2}[\/.\-]/.test(next)) break;
					fullText += '\n' + next;
					lineNum++;
				}
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
						const isSticker = STICKER_RE.test(cleanName) ||
							cleanName.toLowerCase().includes('sticker') ||
							cleanName.toLowerCase().startsWith('stk-');

						// Buscar blob en la colección extraída del ZIP
						const blob = normalizedMediaMap.get(cleanName.toLowerCase())
							?? normalizedMediaMap.get(fileName.toLowerCase());

						let previewUrl: string | null = null;
						let sizeBytes: number | null = null;

						if (blob) {
							sizeBytes = blob.size;
							// Convertir a Data URL solo si el archivo es menor a 4MB (evita congelar con videos o ZIPs de 1.69GB)
							if (blob.size < 4 * 1024 * 1024 && (kind === 'image' || isSticker || kind === 'audio')) {
								previewUrl = await new Promise<string>((resolve) => {
									const reader = new FileReader();
									reader.onloadend = () => resolve((reader.result as string) || '');
									reader.onerror = () => resolve('');
									reader.readAsDataURL(blob);
								});
							} else {
								previewUrl = URL.createObjectURL(blob);
							}
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

			// Limpiar texto residual y detectar mensajes editados (Android e iPhone / iOS)
			const EDITED_RE = /<\s*(?:Se editó este mensaje|Se edito este mensaje|Este mensaje fue editado|This message was edited)\.?\s*>/gi;
			const wasEdited = EDITED_RE.test(fullText);

			textClean = stripInvisible(textClean)
				.replace(EDITED_RE, '')
				.trim();

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
			const parsed = parseDate(dateStr, timeStr, ampmRaw?.trim(), detectedFormat);
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
				inferredOwner = name;
				break;
			}
		}
	}
	// Si no se dedujo por el nombre del archivo o solo hay 2 participantes y no coincidió:
	// El contacto externo suele tener más o menos mensajes, pero si no se pudo determinar por archivo:
	if (!inferredOwner && participantSet.size === 2) {
		// Si el título del archivo o chat contiene a uno de los participantes, ese es el counterpart y el otro es el owner
		for (const name of participantSet) {
			if (name !== 'Sistema') {
				// Tomar el que no esté en el título
				if (title && !title.toLowerCase().includes(name.toLowerCase())) {
					inferredOwner = name;
					break;
				}
			}
		}
	}
	if (!inferredOwner) {
		let minCount = Infinity;
		let candidate: string | null = null;
		for (const [name, count] of countByName) {
			if (name !== 'Sistema') {
				if (!candidate) candidate = name;
			}
		}
		inferredOwner = candidate;
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

	return { meta, messages, days, warnings, mediaBlobs: mediaFiles };
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
				const buf = await entry.async('uint8array');
				txtContent = decodeTxtBuffer(buf);
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
		const buf = new Uint8Array(await file.arrayBuffer());
		const text = decodeTxtBuffer(buf);
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

