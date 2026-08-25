/**
 * chat.types.ts
 * ------------------------------------------------------------------
 * Modelo de dominio para el parser de exportaciones de WhatsApp.
 * Un archivo .txt exportado tiene líneas con el formato aproximado:
 *
 *   12/03/23, 14:05 - Juan Pérez: Hola, ¿cómo vas con el envío?
 *   12/03/23, 14:06 - Juan Pérez: IMG-20230312-WA0001.jpg (archivo adjunto)
 *   13/03/23, 09:12 - María Gómez: <Multimedia omitido>
 *
 * El formato exacto de fecha/hora varía por región/dispositivo (12h/24h,
 * separador '/' o '-', con o sin segundos), por eso WhatsAppRawLine
 * guarda también el `rawTimestamp` sin normalizar, y ParserOptions
 * permite indicarle al motor qué convención usar.
 * ------------------------------------------------------------------
 */

/** Tipo de remitente relativo al "titular" de la evidencia (quién exportó el chat). */
export type SenderRole = 'owner' | 'counterpart' | 'system';

/** Tipos de adjunto multimedia reconocidos dentro del .zip de exportación. */
export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'unknown';

/** Estado de vinculación entre un mensaje y su archivo multimedia real. */
export type MediaLinkStatus = 'linked' | 'missing' | 'omitted' | 'unlinked';

/** Un adjunto multimedia ya vinculado a un archivo físico dentro del .zip. */
export interface MediaAttachment {
	/** Nombre de archivo tal como aparece en el .zip, ej. "IMG-20230312-WA0001.jpg" */
	fileName: string;
	kind: MediaKind;
	/** Ruta / blob URL resuelta en cliente para renderizado (objectURL, no persiste). */
	previewUrl: string | null;
	/** Peso en bytes, si se pudo leer desde el .zip. */
	sizeBytes: number | null;
	/** Duración en segundos para audio/video, si es extraíble. */
	durationSeconds: number | null;
	status: MediaLinkStatus;
	/** true si el archivo es un sticker (STK-*.webp) */
	isSticker?: boolean;
}

export interface CallInfo {
	type: 'voice' | 'video';
	status: 'missed' | 'declined' | 'answered' | 'completed';
	duration?: string;
}

/** Un mensaje individual ya normalizado, listo para renderizar en el feed. */
export interface ChatMessage {
	/** Id estable derivado del índice de línea + hash de contenido (para el caso de duplicados). */
	id: string;
	/** Fecha normalizada a ISO (YYYY-MM-DD), independiente del formato regional de origen. */
	date: string;
	/** Hora normalizada a 24h HH:mm[:ss]. */
	time: string;
	/** Timestamp unix combinando date + time, para ordenar y para el timeline. */
	timestampMs: number;
	senderName: string;
	senderRole: SenderRole;
	/** Texto del mensaje ya limpio (sin el prefijo "Nombre: "). Puede ser vacío si es solo adjunto. */
	text: string;
	/** true si la línea original correspondía a un evento de sistema (cambios de grupo, cifrado, etc). */
	isSystemEvent: boolean;
	/** true si el mensaje fue editado según la marca de WhatsApp ("<This message was edited>"). */
	wasEdited: boolean;
	attachment: MediaAttachment | null;
	/** Información de llamada si es un evento/registro de llamada de WhatsApp. */
	callInfo?: CallInfo | null;
	/** Línea(s) original(es) del .txt, conservadas para trazabilidad/evidencia. */
	sourceLine: string;
	sourceLineNumber: number;
}

/** Resultado agregado por día, usado por el TimelinePanel para el conteo del calendario. */
export interface DaySummary {
	date: string; // YYYY-MM-DD
	messageCount: number;
	mediaCount: number;
	firstTimestampMs: number;
	lastTimestampMs: number;
}

/** Metadatos generales de un chat ya parseado. */
export interface ChatMeta {
	/** Nombre del contacto o grupo, inferido de los remitentes distintos al owner. */
	title: string;
	participants: string[];
	totalMessages: number;
	totalMediaLinked: number;
	totalMediaMissing: number;
	dateRangeStart: string | null; // YYYY-MM-DD
	dateRangeEnd: string | null;
	/** Nombre original del archivo .txt / .zip cargado. */
	sourceFileName: string;
	/** Hash SHA-256 del .txt original, para dejar constancia de integridad en el reporte. */
	sourceHash: string | null;
	parsedAt: string; // ISO datetime
}

/** Un "caso" o proyecto: agrupa uno o más chats guardados en el sidebar izquierdo. */
export interface EvidenceCase {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	chats: ChatMeta[];
}

/** Resultado completo devuelto por el parser para un chat. */
export interface ParsedChat {
	meta: ChatMeta;
	messages: ChatMessage[];
	days: DaySummary[];
	/** Líneas que no se pudieron interpretar (para mostrar advertencias, no bloquear el parseo). */
	warnings: ParserWarning[];
	/** Map de blobs multimedia extraídos del .zip (para subida en la nube). */
	mediaBlobs?: Map<string, Blob>;
}

export interface ParserWarning {
	lineNumber: number;
	rawLine: string;
	reason: 'unrecognized-format' | 'unparseable-date' | 'attachment-not-found-in-zip';
}

/** Convención de fecha/hora de origen, configurable porque WhatsApp varía por región. */
export interface ParserOptions {
	dateOrder: 'DMY' | 'MDY' | 'YMD';
	hourCycle: '12h' | '24h';
	/** Nombre del participante que exportó el chat (para asignar senderRole: 'owner'). */
	ownerName: string | null;
}

/** Filtros activos en la UI (timeline lateral + buscador global). */
export interface EvidenceFilter {
	year: number | null;
	month: number | null; // 1-12
	day: number | null; // 1-31
	searchQuery: string;
	onlyWithMedia: boolean;
}

/** Opciones completas para la exportación a PDF pericial/evidencia. */
export interface PdfExportOptions {
	dateFrom?: string;
	dateTo?: string;
	// Filtros de tipo de contenido
	includeText?: boolean;
	includeImages?: boolean;
	includeVideos?: boolean;
	includeAudios?: boolean;
	includeDocuments?: boolean;
	includeStickers?: boolean;
	includeAnsweredCalls?: boolean;
	includeMissedCalls?: boolean;
	includeSystemEvents?: boolean;
	includeGhostMessages?: boolean;
	// Opciones de informe pericial y diseño
	includeCoverPage?: boolean;
	caseNumber?: string;
	investigatorName?: string;
	courtInstitution?: string;
	watermarkText?: string;
	pdfTheme?: 'dark' | 'light' | 'legal';
	fontSize?: number;
}

