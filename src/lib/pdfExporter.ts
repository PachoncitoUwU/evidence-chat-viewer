/**
 * pdfExporter.ts
 * ------------------------------------------------------------------
 * Generador pericial de PDF de alta calidad para evidencias de WhatsApp.
 * Optimizado para lectura digital e impresión física:
 * - Esquinas cuadradas en imágenes con ajuste exacto de la burbuja al ancho de la foto.
 * - Burbujas dinámicas que se reducen al tamaño exacto de textos cortos ("2", "Hola").
 * - Tipografía aumentada a 10.5pt (13-14px) para lectura e impresión perfectas.
 * - Tarjetas de audio fluidas (sin caja dentro de otra caja).
 * - Protección estricta contra cortes de página.
 * ------------------------------------------------------------------
 */

import jsPDF from 'jspdf';
import { get } from 'svelte/store';
import { hiddenMediaStore } from '$lib/stores/hiddenMediaStore';
import type { ChatMessage, ChatMeta, PdfExportOptions } from './types/chat.types';
export type { PdfExportOptions };

export interface PageLayout {
	pageW: number;
	pageH: number;
	margin: number;
	contentW: number;
	format: string | [number, number];
}

export function getPageLayout(options?: PdfExportOptions): PageLayout {
	const paper = options?.paperSize || 'legal';
	// Márgenes mínimos configurables: 6mm si compactMargins es true (o por defecto para ahorrar papel), o 10mm estándar
	const margin = options?.compactMargins !== false ? 6 : 10;

	let pageW = 210;
	let pageH = 297;
	let format: string | [number, number] = 'a4';

	if (paper === 'legal') {
		// Tamaño Oficio / Legal: 215.9 mm x 355.6 mm (8.5 x 14 pulgadas)
		pageW = 215.9;
		pageH = 355.6;
		format = [215.9, 355.6];
	} else if (paper === 'letter') {
		// Tamaño Carta / Letter: 215.9 mm x 279.4 mm (8.5 x 11 pulgadas)
		pageW = 215.9;
		pageH = 279.4;
		format = 'letter';
	} else {
		// A4: 210 mm x 297 mm
		pageW = 210;
		pageH = 297;
		format = 'a4';
	}

	const contentW = pageW - margin * 2;
	return { pageW, pageH, margin, contentW, format };
}

// ── Helpers de color ───────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const bigint = parseInt(h, 16);
	return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function setFill(pdf: jsPDF, hex: string) {
	const [r, g, b] = hexToRgb(hex);
	pdf.setFillColor(r, g, b);
}

function setStroke(pdf: jsPDF, hex: string) {
	const [r, g, b] = hexToRgb(hex);
	pdf.setDrawColor(r, g, b);
}

function setTextRgb(pdf: jsPDF, r: number, g: number, b: number) {
	pdf.setTextColor(r, g, b);
}

function setTexHex(pdf: jsPDF, hex: string) {
	const [r, g, b] = hexToRgb(hex);
	pdf.setTextColor(r, g, b);
}

export interface ProcessedImage {
	dataUrl: string;
	width: number;
	height: number;
	format: 'JPEG' | 'PNG' | 'WEBP';
}

const imgCache = new Map<string, ProcessedImage>();
const callIconCache = new Map<string, string>();

/** Genera un PNG HD perfecto con el ícono oficial de llamada de WhatsApp (voz o vídeo) */
function getCallIconCanvasUrl(isMissed: boolean, isVideo: boolean): string {
	const key = `${isMissed ? 'missed' : 'ok'}_${isVideo ? 'video' : 'voice'}`;
	if (callIconCache.has(key)) return callIconCache.get(key)!;

	const size = 96;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	// Círculo de fondo (verde o rojo)
	ctx.fillStyle = isMissed ? '#dc2626' : '#00a884';
	ctx.beginPath();
	ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
	ctx.fill();

	// Dibujar ícono blanco de teléfono o videocámara
	ctx.fillStyle = '#ffffff';
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 6;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (isVideo) {
		ctx.save();
		ctx.translate(24, 24);
		ctx.scale(2, 2);
		const p = new Path2D("M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z");
		ctx.fill(p);
		ctx.restore();
	} else {
		ctx.save();
		ctx.translate(24, 24);
		ctx.scale(2, 2);
		const p = new Path2D("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z");
		ctx.fill(p);
		ctx.restore();
	}

	const dataUrl = canvas.toDataURL('image/png');
	callIconCache.set(key, dataUrl);
	return dataUrl;
}

/** Obtiene dimensiones y metadatos de la imagen de forma ultra-rápida sin re-codificación en canvas */
async function loadAndProcessImage(
	url: string,
	isSticker: boolean = false
): Promise<ProcessedImage | null> {
	if (!url) return null;
	if (imgCache.has(url)) return imgCache.get(url)!;
	try {
		const result = await new Promise<ProcessedImage | null>((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				const naturalW = img.naturalWidth || 300;
				const naturalH = img.naturalHeight || 200;

				let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
				if (isSticker || url.startsWith('data:image/png') || url.toLowerCase().endsWith('.png')) {
					format = 'PNG';
				} else if (url.startsWith('data:image/webp') || url.toLowerCase().endsWith('.webp')) {
					format = 'WEBP';
				}

				resolve({
					dataUrl: url,
					width: naturalW,
					height: naturalH,
					format
				});
			};
			img.onerror = () => resolve(null);
			img.src = url;
		});
		if (result) imgCache.set(url, result);
		return result;
	} catch {
		return null;
	}
}

/** Yields to the event loop so the browser doesn't freeze during long PDF builds */
function yieldToUI(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function cleanPdfText(str: string): string {
	if (!str) return '';
	return str
		.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u202f\u00a0]/g, '')
		.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
		.replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑ¿¡üÜ\n\r]/g, '')
		.replace(/[ \t]+/g, ' ')
		.trim();
}

function drawSingleLineText(pdf: jsPDF, text: string, x: number, y: number, maxW: number) {
	const cleaned = cleanPdfText(text);
	let display = cleaned;
	if (pdf.getTextWidth(display) > maxW) {
		while (display.length > 3 && pdf.getTextWidth(display + '...') > maxW) {
			display = display.slice(0, -1);
		}
		display += '...';
	}
	pdf.text(display, x, y);
}

function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
	const cleaned = cleanPdfText(text);
	if (!cleaned) return [];
	
	// Si hay palabras ultra-largas (como URLs o enlaces sin espacios que exceden maxWidth),
	// dividir esas palabras largas caracter a caracter para que nunca desborden maxWidth
	const rawLines = pdf.splitTextToSize(cleaned, maxWidth);
	const safeLines: string[] = [];

	for (const rawLine of rawLines) {
		if (pdf.getTextWidth(rawLine) <= maxWidth) {
			safeLines.push(rawLine);
		} else {
			// Si una línea individual aún excede maxWidth por un string sin espacios
			let cur = '';
			for (let i = 0; i < rawLine.length; i++) {
				const char = rawLine[i];
				if (pdf.getTextWidth(cur + char) > maxWidth) {
					if (cur) safeLines.push(cur);
					cur = char;
				} else {
					cur += char;
				}
			}
			if (cur) safeLines.push(cur);
		}
	}

	return safeLines;
}

function roundedRect(
	pdf: jsPDF,
	x: number, y: number, w: number, h: number,
	r: number,
	style: 'F' | 'S' | 'FD' = 'F'
) {
	pdf.roundedRect(x, y, w, h, r, r, style);
}

/** Dibuja el doble check azul vectorial oficial de WhatsApp (✓✓) sin utilizar texto "vv" */
function drawVectorDoubleCheck(pdf: jsPDF, x: number, y: number, colorHex: string = '#53bdeb') {
	setStroke(pdf, colorHex);
	pdf.setLineWidth(0.35);
	// Primer check
	pdf.line(x, y + 1.2, x + 0.9, y + 2.1);
	pdf.line(x + 0.9, y + 2.1, x + 2.4, y);
	// Segundo check
	pdf.line(x + 1.3, y + 1.2, x + 2.2, y + 2.1);
	pdf.line(x + 2.2, y + 2.1, x + 3.7, y);
}

// ── Paletas de colores ─────────────────────────────────────────────

interface PdfThemeColors {
	name: string;
	pageBg: string;
	bubbleOutBg: string;
	bubbleOutText: string;
	bubbleInBg: string;
	bubbleInText: string;
	senderColor: string;
	metaColor: string;
	pillBg: string;
	pillText: string;
	borderColor?: string;
}

function getThemeColors(theme?: 'dark' | 'light' | 'legal'): PdfThemeColors {
	if (theme === 'light') {
		return {
			name: 'light',
			pageBg: '#efeae2',
			bubbleOutBg: '#d9fdd3',
			bubbleOutText: '#111b21',
			bubbleInBg: '#ffffff',
			bubbleInText: '#111b21',
			senderColor: '#00a884',
			metaColor: '#667781',
			pillBg: '#ffffff',
			pillText: '#54656f',
			borderColor: '#e2e8f0'
		};
	}
	if (theme === 'legal') {
		return {
			name: 'legal',
			pageBg: '#ffffff',
			bubbleOutBg: '#f3f4f6',
			bubbleOutText: '#111827',
			bubbleInBg: '#ffffff',
			bubbleInText: '#111827',
			senderColor: '#1e3a8a',
			metaColor: '#4b5563',
			pillBg: '#f3f4f6',
			pillText: '#374151',
			borderColor: '#d1d5db'
		};
	}
	// Dark (default oficial WhatsApp Dark)
	return {
		name: 'dark',
		pageBg: '#0d1418',
		bubbleOutBg: '#005c4b',
		bubbleOutText: '#e9edef',
		bubbleInBg: '#1f2c33',
		bubbleInText: '#e9edef',
		senderColor: '#00a884',
		metaColor: '#8696a0',
		pillBg: '#182229',
		pillText: '#cdd6db'
	};
}

// ── Renderizado de mensaje individual ─────────────────────────────

interface DrawResult {
	heightUsed: number;
}

async function drawMessage(
	pdf: jsPDF,
	msg: ChatMessage,
	y: number,
	theme: PdfThemeColors,
	layout: PageLayout,
	isGroup: boolean = false,
	fontSize: number = 8.5
): Promise<DrawResult> {
	const isOwner = msg.senderRole === 'owner';
	const time = msg.time.slice(0, 5);

	const bubbleBg = isOwner ? theme.bubbleOutBg : theme.bubbleInBg;
	const textColor = isOwner ? theme.bubbleOutText : theme.bubbleInText;

	const maxBubbleW = layout.contentW * 0.72;
	const bubblePadX = 3.2;
	const bubblePadY = 2.5;

	const bodyFontSize = fontSize || 8.5;
	const lineH = Math.max(3.8, bodyFontSize * 0.52);

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(bodyFontSize);

	const innerMaxW = maxBubbleW - bubblePadX * 2 - 2;

	// Remitente (solo en chats grupales)
	const senderNameStr = (isGroup && !isOwner && msg.senderName) ? cleanPdfText(msg.senderName) : '';
	const senderH = senderNameStr ? 4.8 : 0;

	// Detección de mensajes eliminados
	const isDeleted = msg.text.toLowerCase().includes('se eliminó este mensaje') ||
	                  msg.text.toLowerCase().includes('este mensaje fue eliminado');

	// Texto del mensaje
	const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
	const textH = textLines.length * lineH;

	// Llamadas
	const callH = msg.callInfo ? 15.0 : 0;

	// Adjuntos
	let attachmentH = 0;
	let imgDataUrl: string | null = null;
	let imgDrawW = 0;
	let imgDrawH = 0;

	if (msg.attachment) {
		const att = msg.attachment;
		if (att.status === 'omitted' || att.status === 'missing') {
			attachmentH = 7.0;
		} else if ((att.kind === 'image' || att.isSticker) && att.previewUrl) {
			const imgInfo = await loadAndProcessImage(att.previewUrl, att.isSticker);
			if (imgInfo) {
				imgDataUrl = imgInfo.dataUrl;
				const naturalW = imgInfo.width;
				const naturalH = imgInfo.height;

				// Stickers compactos (máx 12mm) e Imágenes de fotos (máx 45mm de alto)
				const maxH = att.isSticker ? 12 : 45;
				const maxW = att.isSticker ? 12 : innerMaxW;

				// Preservar la proporción exacta de la imagen (aspect ratio) sin compresión ni estiramiento
				imgDrawW = maxW;
				imgDrawH = (naturalH * imgDrawW) / naturalW;

				if (imgDrawH > maxH) {
					imgDrawH = maxH;
					imgDrawW = (naturalW * imgDrawH) / naturalH;
				}

				if (imgDrawW > maxW) {
					imgDrawW = maxW;
					imgDrawH = (naturalH * imgDrawW) / naturalW;
				}

				attachmentH = imgDrawH + 2.0;
			} else {
				attachmentH = 8.0;
			}
		} else if (att.kind === 'video') {
			attachmentH = 44.0;
		} else if (att.kind === 'audio') {
			attachmentH = 14.0;
		} else if (att.kind === 'document') {
			attachmentH = 14.0;
		} else {
			attachmentH = 7.0;
		}
	}

	const metaH = (textLines.length === 1 && !msg.attachment && !msg.callInfo) ? 0 : 3.8;
	const bubbleH = senderH + callH + attachmentH + textH + metaH + bubblePadY * 2;

	let maxLineWidth = 0;
	if (senderNameStr) {
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8.5);
		maxLineWidth = Math.max(maxLineWidth, pdf.getTextWidth(senderNameStr));
	}

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(bodyFontSize);
	textLines.forEach((line) => {
		maxLineWidth = Math.max(maxLineWidth, pdf.getTextWidth(line));
	});

	// Ancho dinámico apretado para textos cortos ("2", "Hola")
	const timeStrW = pdf.getTextWidth(time) + (isOwner ? 5.5 : 1.5);
	let calculatedW = maxLineWidth + timeStrW + bubblePadX * 2 + 4;

	if (textLines.length === 1 && !msg.attachment && !msg.callInfo) {
		const singleLineW = pdf.getTextWidth(textLines[0]);
		calculatedW = singleLineW + timeStrW + bubblePadX * 2 + 5;
	}

	// Para imágenes/stickers, ajustar la burbuja al ancho del recurso
	if (imgDrawW > 0) {
		if (textLines.length > 0) {
			calculatedW = Math.max(imgDrawW + bubblePadX * 2, maxLineWidth + bubblePadX * 2 + 10);
		} else {
			calculatedW = imgDrawW + bubblePadX * 2 + 3;
		}
	} else if (msg.attachment?.kind === 'video') {
		calculatedW = maxBubbleW; // Videos ocupan todo el ancho disponible
	} else if (msg.attachment?.kind === 'audio') {
		calculatedW = Math.max(calculatedW, 68); // Ancho mínimo para waveform visible
	} else if (msg.attachment || msg.callInfo) {
		calculatedW = Math.max(calculatedW, 58);
	}

	// Reducción dinámica: mínimo 22mm para textos muy cortos ("2")
	const bubbleW = Math.max(22, Math.min(maxBubbleW, calculatedW));

	const bubbleX = isOwner
		? layout.margin + layout.contentW - bubbleW
		: layout.margin + 2.0;

	// ── Fondo de burbuja ──
	setFill(pdf, bubbleBg);
	if (theme.borderColor) {
		setStroke(pdf, theme.borderColor);
		pdf.setLineWidth(0.2);
		roundedRect(pdf, bubbleX, y, bubbleW, bubbleH, 2.2, 'FD');
	} else {
		roundedRect(pdf, bubbleX, y, bubbleW, bubbleH, 2.2, 'F');
	}

	// ── Cola de burbuja (Triangulito limpio) ──
	setFill(pdf, bubbleBg);
	if (isOwner) {
		pdf.triangle(
			bubbleX + bubbleW, y + 0.5,
			bubbleX + bubbleW + 2.2, y,
			bubbleX + bubbleW, y + 3.5,
			'F'
		);
	} else {
		pdf.triangle(
			bubbleX, y + 0.5,
			bubbleX - 2.2, y,
			bubbleX, y + 3.5,
			'F'
		);
	}

	let drawY = y + bubblePadY;

	// ── Remitente (Grupales) ──
	if (senderNameStr) {
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8.5);
		setTexHex(pdf, theme.senderColor);
		pdf.text(senderNameStr, bubbleX + bubblePadX + 0.5, drawY + 2.8);
		drawY += senderH;
	}

	// ── Llamadas de WhatsApp (hiperrealista) ──
	if (msg.callInfo) {
		const call = msg.callInfo;
		const isMissed = call.status === 'missed' || call.status === 'declined';
		const isVideo = call.type === 'video';

		const callIconData = getCallIconCanvasUrl(isMissed, isVideo);
		const icDim = 10.4;
		const icX = bubbleX + bubblePadX + 1.0;
		const icY = drawY + 2.0;

		if (callIconData) {
			try {
				pdf.addImage(callIconData, 'PNG', icX, icY, icDim, icDim);
			} catch {
				setFill(pdf, isMissed ? '#dc2626' : '#00a884');
				pdf.circle(icX + icDim / 2, icY + icDim / 2, icDim / 2, 'F');
			}
		}

		const textLeft = icX + icDim + 3.5;
		const title = isMissed
			? (isVideo ? 'Videollamada perdida' : 'Llamada de voz perdida')
			: (isVideo ? 'Videollamada' : 'Llamada de voz');

		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(9.5);
		setTexHex(pdf, textColor);
		drawSingleLineText(pdf, title, textLeft, drawY + 6.2, bubbleW - bubblePadX * 2 - icDim - 5);

		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(7.8);
		setTexHex(pdf, theme.metaColor);
		const callSubtitle = call.duration ? `Duraci\u00f3n: ${call.duration}` : 'Toca para volver a llamar.';
		pdf.text(callSubtitle, textLeft, drawY + 11.2);

		drawY += callH;
	}

	// ── Adjuntos ──
	if (msg.attachment) {
		const att = msg.attachment;
		const attX = bubbleX + bubblePadX;

		if (att.status === 'omitted') {
			pdf.setFont('helvetica', 'italic');
			pdf.setFontSize(8);
			setTexHex(pdf, theme.metaColor);
			pdf.text('📷 [Multimedia omitido]', bubbleX + bubblePadX + 0.5, drawY + 3.8);
			drawY += attachmentH;
		} else if (att.status === 'missing') {
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(8);
			setTextRgb(pdf, 220, 38, 38);
			drawSingleLineText(
				pdf,
				att.fileName ? `⚠️ ${att.fileName} (no encontrado)` : '⚠️ Archivo no encontrado',
				bubbleX + bubblePadX + 0.5,
				drawY + 3.8,
				bubbleW - bubblePadX * 2 - 1
			);
			drawY += attachmentH;
		} else if (att.kind === 'image' || att.isSticker) {
			if (imgDataUrl) {
				try {
					const format = imgDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
					// Foto con esquinas ajustadas exactas al contenedor
					pdf.addImage(imgDataUrl, format, attX, drawY, imgDrawW, imgDrawH);
				} catch {
					setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#2a3942');
					pdf.rect(attX, drawY, imgDrawW, imgDrawH, 'F');
					pdf.setFontSize(7.5);
					setTexHex(pdf, theme.metaColor);
					drawSingleLineText(pdf, att.fileName || 'Imagen', attX + 2, drawY + imgDrawH / 2, imgDrawW - 4);
				}
				drawY += imgDrawH + 2.0;
			} else {
				// Tarjeta elegante de foto sin blob local
				const boxH = 11.0;
				setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#182229');
				roundedRect(pdf, attX, drawY, bubbleW - bubblePadX * 2, boxH, 1.8, 'F');
				pdf.setFont('helvetica', 'normal');
				pdf.setFontSize(8.5);
				setTexHex(pdf, textColor);
				drawSingleLineText(pdf, `📷 ${att.fileName || 'Imagen de WhatsApp'}`, attX + 3, drawY + 6.5, bubbleW - bubblePadX * 2 - 6);
				drawY += boxH + 2.0;
			}
		} else if (att.kind === 'video') {
			// ── VIDEO: Thumbnail oscuro realista tipo WhatsApp ──
			const vidW = bubbleW - bubblePadX * 2;
			const vidH = 42.0;
			setFill(pdf, '#1c1c1e');
			roundedRect(pdf, attX, drawY, vidW, vidH, 2.5, 'F');

			// Botón de reproducción grande y centrado
			const vcx = attX + vidW / 2;
			const vcy = drawY + vidH / 2;
			setFill(pdf, '#444444');
			pdf.circle(vcx, vcy, 9.0, 'F');
			setFill(pdf, '#ffffff');
			pdf.triangle(vcx - 3.0, vcy - 5.0, vcx - 3.0, vcy + 5.0, vcx + 5.5, vcy, 'F');

			// Badge de duración esquina inferior izquierda
			const vidDur = att.durationSeconds
				? `${Math.floor(att.durationSeconds / 60)}:${Math.floor(att.durationSeconds % 60).toString().padStart(2, '0')}`
				: '';
			if (vidDur) {
				setFill(pdf, '#000000');
				roundedRect(pdf, attX + 2, drawY + vidH - 9, vidDur.length * 2.5 + 10, 7, 1.5, 'F');
				pdf.setFont('helvetica', 'bold');
				pdf.setFontSize(7);
				setTextRgb(pdf, 255, 255, 255);
				pdf.text(vidDur, attX + 5, drawY + vidH - 4.5);
			} else {
				// Nombre del archivo si no hay duración
				pdf.setFont('helvetica', 'normal');
				pdf.setFontSize(7.5);
				setTextRgb(pdf, 180, 180, 180);
				drawSingleLineText(pdf, att.fileName || 'Video', attX + 2.5, drawY + vidH - 4, vidW - 5);
			}
			drawY += vidH + 2.0;

		// ── NOTA DE VOZ REALISTA (Exactamente como WhatsApp) ──
		} else if (att.kind === 'audio') {
			// Botón de reproducir (círculo verde) a la izquierda
			const playR = 5.2;
			const playX = bubbleX + bubblePadX + playR + 1.5;
			const playY = drawY + 7.0;
			setFill(pdf, '#00a884');
			pdf.circle(playX, playY, playR, 'F');
			setFill(pdf, '#ffffff');
			pdf.triangle(playX - 1.8, playY - 2.8, playX - 1.8, playY + 2.8, playX + 3.0, playY, 'F');

			// Waveform: 24 barras verticales de alturas variadas
			const wfBars = [2.5, 4.8, 2.0, 6.2, 3.5, 7.0, 2.8, 5.5, 4.2, 2.0, 6.5, 3.2, 7.2, 2.5, 5.8, 3.8, 6.8, 2.2, 5.2, 3.5, 4.8, 2.8, 5.5, 2.0];
			const wfCount = wfBars.length;
			const wfStartX = bubbleX + bubblePadX + playR * 2 + 4.5;
			const wfZone = bubbleW - bubblePadX * 2 - playR * 2 - 14;
			const wfBarW = Math.max(0.8, wfZone / wfCount - 0.5);
			const wfMidY = drawY + 7.0;

			for (let i = 0; i < wfCount; i++) {
				const bh = wfBars[i];
				const bx = wfStartX + i * (wfBarW + 0.6);
				const by = wfMidY - bh / 2;
				const isPlayed = i < Math.floor(wfCount * 0.40);
				setFill(pdf, isPlayed ? '#00a884' : (theme.name === 'light' ? '#b8c9d0' : '#4a5d66'));
				roundedRect(pdf, bx, by, wfBarW, bh, 0.3, 'F');
			}

			// Duración debajo de la waveform (alineada con el inicio de las barras)
			const audDur = att.durationSeconds
				? `${Math.floor(att.durationSeconds / 60)}:${Math.floor(att.durationSeconds % 60).toString().padStart(2, '0')}`
				: '0:00';
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(7.5);
			setTexHex(pdf, theme.metaColor);
			pdf.text(audDur, wfStartX, drawY + 13.5);

			drawY += attachmentH;

		// ── DOCUMENTO: Card tipo WhatsApp con ícono de archivo coloreado ──
		} else if (att.kind === 'document') {
			const docW = bubbleW - bubblePadX * 2;
			const docH = 14.0;
			setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#182229');
			roundedRect(pdf, attX, drawY, docW, docH, 2.2, 'F');

			// Ícono de archivo con color según extensión
			const fileExt = (att.fileName || '').split('.').pop()?.toUpperCase() ?? 'DOC';
			const fileColor = fileExt === 'PDF' ? '#dc2626' :
				(fileExt === 'XLS' || fileExt === 'XLSX' || fileExt === 'CSV') ? '#16a34a' :
				(fileExt === 'ZIP' || fileExt === 'RAR' || fileExt === '7Z') ? '#7c3aed' :
				(fileExt === 'DOC' || fileExt === 'DOCX') ? '#2563eb' : '#4f46e5';
			setFill(pdf, fileColor);
			roundedRect(pdf, attX + 2.5, drawY + 2.5, 6.0, 8.0, 1.0, 'F');
			// Esquina doblada simulada
			setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#182229');
			pdf.triangle(attX + 7.0, drawY + 2.5, attX + 8.5, drawY + 2.5, attX + 8.5, drawY + 4.5, 'F');
			// Extensión dentro del ícono (texto blanco)
			pdf.setFont('helvetica', 'bold');
			pdf.setFontSize(4.2);
			setTextRgb(pdf, 255, 255, 255);
			pdf.text(fileExt.slice(0, 3), attX + 3.0, drawY + 8.8);

			// Nombre del archivo
			pdf.setFont('helvetica', 'bold');
			pdf.setFontSize(8.5);
			setTexHex(pdf, textColor);
			drawSingleLineText(pdf, att.fileName || 'Documento', attX + 11.0, drawY + 7.5, docW - 13);

			// Tipo y tamaño
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(7.5);
			setTexHex(pdf, theme.metaColor);
			const sizeLabel = att.sizeBytes
				? (att.sizeBytes < 1024 * 1024
					? `${(att.sizeBytes / 1024).toFixed(0)} KB`
					: `${(att.sizeBytes / 1024 / 1024).toFixed(1)} MB`)
				: '';
			pdf.text(sizeLabel ? `${fileExt} \u2022 ${sizeLabel}` : fileExt, attX + 11.0, drawY + 12.0);

			drawY += docH;
		} else {
			drawY += attachmentH;
		}
	}

	// ── Texto del mensaje ──
	if (textLines.length > 0) {
		pdf.setFont('helvetica', isDeleted ? 'italic' : 'normal');
		pdf.setFontSize(bodyFontSize);
		const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

		for (let i = 0; i < textLines.length; i++) {
			const line = textLines[i];
			const startX = bubbleX + bubblePadX + 0.5;
			const startY = drawY + 3.6;

			if (isDeleted) {
				setTexHex(pdf, theme.metaColor);
				pdf.text('🚫 ' + line, startX, startY);
			} else if (urlRegex.test(line)) {
				urlRegex.lastIndex = 0;
				// Dibujar el texto completo de la línea y colocar el enlace
				const isEntireLineUrl = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i.test(line.trim());
				if (isEntireLineUrl) {
					pdf.setFont('helvetica', 'bold');
					setTextRgb(pdf, 83, 189, 235);
					pdf.text(line, startX, startY);
					const href = line.startsWith('http') ? line : `https://${line}`;
					pdf.link(startX, startY - 3, pdf.getTextWidth(line), 4, { url: href });
				} else {
					// Línea mixta con texto y link
					const parts = line.split(/(\s+)/);
					let currentX = startX;
					for (const part of parts) {
						const isUrl = /(https?:\/\/[^\s]+|www\.[^\s]+)/i.test(part);
						if (isUrl) {
							pdf.setFont('helvetica', 'bold');
							setTextRgb(pdf, 83, 189, 235);
							const partW = pdf.getTextWidth(part);
							pdf.text(part, currentX, startY);
							const href = part.startsWith('http') ? part : `https://${part}`;
							pdf.link(currentX, startY - 3, partW, 4, { url: href });
							currentX += partW;
						} else {
							pdf.setFont('helvetica', 'normal');
							setTexHex(pdf, textColor);
							const partW = pdf.getTextWidth(part);
							pdf.text(part, currentX, startY);
							currentX += partW;
						}
					}
				}
			} else {
				setTexHex(pdf, textColor);
				pdf.text(line, startX, startY);
			}
			drawY += lineH;
		}
	}

	// ── Hora y Vistos Azules Vectoriales (✓✓) ──
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(7.5);
	setTexHex(pdf, theme.metaColor);

	// Si el mensaje tiene solo 1 línea, alinear la hora al final de la línea
	const timeY = (textLines.length === 1 && !msg.attachment && !msg.callInfo) ? y + bubblePadY + 3.6 : drawY + 1.2;
	const timeX = bubbleX + bubbleW - bubblePadX - pdf.getTextWidth(time) - (isOwner ? 5.2 : 0.5);

	pdf.text(time, timeX, timeY);

	if (isOwner) {
		// Doble check vectorial azul oficial de WhatsApp
		drawVectorDoubleCheck(pdf, bubbleX + bubbleW - bubblePadX - 4.0, timeY - 1.8, '#53bdeb');
	}

	return { heightUsed: bubbleH + 2.5 };
}

function drawSystemEvent(pdf: jsPDF, text: string, y: number, theme: PdfThemeColors, layout: PageLayout): number {
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(8);
	const textW = pdf.getTextWidth(cleanPdfText(text));
	const pillW = textW + 12;
	const pillX = (layout.pageW - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 6.0, 1.8, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(cleanPdfText(text), pillX + 6, y + 4.2);
	return 7.5;
}

function drawDateSeparator(pdf: jsPDF, label: string, y: number, theme: PdfThemeColors, layout: PageLayout): number {
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(8.5);
	const textW = pdf.getTextWidth(label);
	const pillW = textW + 14;
	const pillX = (layout.pageW - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 6.5, 2, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(label, pillX + 7, y + 4.5);
	return 8.5;
}

function drawWatermark(pdf: jsPDF, text: string) {
	pdf.saveGraphicsState();
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(42);
	pdf.setTextColor(180, 180, 180);
	const width = pdf.internal.pageSize.getWidth();
	const height = pdf.internal.pageSize.getHeight();
	pdf.text(text, width / 2, height / 2, {
		align: 'center',
		angle: 45
	});
	pdf.restoreGraphicsState();
}

function drawCoverPage(pdf: jsPDF, meta: ChatMeta, layout: PageLayout, options?: PdfExportOptions) {
	const theme = getThemeColors(options?.pdfTheme);

	setFill(pdf, theme.name === 'dark' ? '#0d1418' : '#f8fafc');
	pdf.rect(0, 0, layout.pageW, layout.pageH, 'F');

	const headerY = layout.margin + 12;
	setFill(pdf, theme.name === 'dark' ? '#005c4b' : '#00a884');
	pdf.rect(layout.margin, headerY, layout.contentW, 20, 'F');

	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(14);
	setTextRgb(pdf, 255, 255, 255);
	pdf.text('INFORME DE EVIDENCIA DIGITAL — CHAT DE WHATSAPP', layout.pageW / 2, headerY + 12, { align: 'center' });

	const metaBoxY = headerY + 28;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, layout.margin, metaBoxY, layout.contentW, 36, 2.5, 'F');

	const cleanTitle = (meta.title || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u200b]/g, '').trim() || 'Chat de WhatsApp';
	const cleanSource = (meta.sourceFileName || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u200b]/g, '').trim() || 'WhatsApp_Chat.zip';

	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(12);
	setTexHex(pdf, theme.bubbleInText);
	pdf.text(cleanTitle, layout.margin + 8, metaBoxY + 10);

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9.5);
	setTexHex(pdf, theme.metaColor);
	pdf.text(`Origen: ${cleanSource}`, layout.margin + 8, metaBoxY + 18);
	pdf.text(`Fecha de procesamiento: ${new Date(meta.parsedAt).toLocaleString('es-ES')}`, layout.margin + 8, metaBoxY + 26);

	if (options?.caseNumber || options?.investigatorName || options?.courtInstitution) {
		const boxY = metaBoxY + 42;
		setFill(pdf, theme.pillBg);
		roundedRect(pdf, layout.margin, boxY, layout.contentW, 30, 2.5, 'F');

		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(9.5);
		setTexHex(pdf, theme.senderColor);
		pdf.text('DATOS DE LA INVESTIGACIÓN / CADENA DE CUSTODIA', layout.margin + 8, boxY + 8);

		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(9);
		setTexHex(pdf, theme.bubbleInText);

		let curY = boxY + 16;
		if (options.caseNumber) {
			pdf.text(`N° de Expediente / Registro:  ${options.caseNumber}`, layout.margin + 8, curY);
			curY += 6;
		}
		if (options.investigatorName) {
			pdf.text(`Perito / Investigador:        ${options.investigatorName}`, layout.margin + 8, curY);
			curY += 6;
		}
		if (options.courtInstitution) {
			pdf.text(`Juzgado / Unidad:              ${options.courtInstitution}`, layout.margin + 8, curY);
		}
	}
}

// ── Exportación a PDF principal ───────────────────────────────────

export async function exportChatToPdf(
	meta: ChatMeta,
	messages: ChatMessage[],
	options?: PdfExportOptions,
	onProgress?: (pct: number) => void
): Promise<void> {
	imgCache.clear();
	callIconCache.clear();
	const layout = getPageLayout(options);
	const pdf = new jsPDF({ unit: 'mm', format: layout.format, orientation: 'portrait' });
	const theme = getThemeColors(options?.pdfTheme);

	const hiddenSet = get(hiddenMediaStore);
	const isGroup = meta.participants.length > 2;

	let exportMessages = messages.filter((m) => {
		if (hiddenSet.has(m.id)) return false;
		if (options?.dateFrom && m.date < options.dateFrom) return false;
		if (options?.dateTo && m.date > options.dateTo) return false;
		if (m.isSystemEvent) return options?.includeSystemEvents ?? false;

		// Filtro de llamadas
		if (m.callInfo) {
			const isMissed = m.callInfo.status === 'missed' || m.callInfo.status === 'declined';
			if (isMissed && options?.includeMissedCalls === false) return false;
			if (!isMissed && options?.includeAnsweredCalls === false) return false;
			return true;
		}

		const isEmpty = !m.text && (!m.attachment || m.attachment.status === 'omitted' || m.attachment.status === 'missing') && !m.callInfo;
		if (isEmpty && !(options?.includeGhostMessages ?? false)) return false;

		if (m.text && !m.attachment && !m.callInfo) {
			if (options?.includeText === false) return false;
		}

		if (m.attachment) {
			const att = m.attachment;
			if (att.isSticker || (att.kind === 'image' && att.fileName.toLowerCase().endsWith('.gif'))) {
				if (options?.includeStickers === false) return false;
			} else if (att.kind === 'image') {
				if (options?.includeImages === false) return false;
			} else if (att.kind === 'video') {
				if (options?.includeVideos === false) return false;
			} else if (att.kind === 'audio') {
				if (options?.includeAudios === false) return false;
			} else if (att.kind === 'document') {
				if (options?.includeDocuments === false) return false;
			}
		}

		return true;
	});

	if (exportMessages.length === 0) {
		alert('No hay mensajes que coincidan con los filtros seleccionados para exportar.');
		return;
	}

	if (onProgress) onProgress(3);

	// ── PRE-CARGA PARALELA DE IMÁGENES (la mayor ganancia de velocidad) ──────────
	const imgMessages = exportMessages.filter(
		(m) => m.attachment && (m.attachment.kind === 'image' || m.attachment.isSticker) && m.attachment.previewUrl
	);
	const PARALLEL_BATCH = 50; // Pre-cargar dimensiones en lotes ultra-rápidos de 50
	for (let i = 0; i < imgMessages.length; i += PARALLEL_BATCH) {
		const chunk = imgMessages.slice(i, i + PARALLEL_BATCH);
		await Promise.all(
			chunk.map((m) => {
				if (m.attachment?.previewUrl) {
					return loadAndProcessImage(m.attachment.previewUrl, m.attachment.isSticker);
				}
				return Promise.resolve(null);
			})
		);
		// Progreso: 3% → 23%
		if (onProgress) onProgress(3 + Math.round(((i + chunk.length) / imgMessages.length) * 20));
		await yieldToUI();
	}

	if (onProgress) onProgress(23);

	if (options?.includeCoverPage !== false) {
		drawCoverPage(pdf, meta, layout, options);
		pdf.addPage();
	}

	// Fondo de página de mensajes
	setFill(pdf, theme.pageBg);
	pdf.rect(0, 0, layout.pageW, layout.pageH, 'F');

	let currentY = layout.margin + 3;
	let lastDate = '';
	const total = exportMessages.length;

	for (let i = 0; i < total; i++) {
		const msg = exportMessages[i];

		// Separador de fecha
		if (msg.date && msg.date !== lastDate) {
			lastDate = msg.date;
			const [y, mo, d] = msg.date.split('-');
			const dt = new Date(Number(y), Number(mo) - 1, Number(d));
			const label = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

			if (currentY + 12 > layout.pageH - layout.margin) {
				pdf.addPage();
				setFill(pdf, theme.pageBg);
				pdf.rect(0, 0, layout.pageW, layout.pageH, 'F');
				currentY = layout.margin + 3;
			}
			currentY += 1.5;
			const dateH = drawDateSeparator(pdf, label, currentY, theme, layout);
			currentY += dateH;
		}

		if (msg.isSystemEvent) {
			if (currentY + 9 > layout.pageH - layout.margin) {
				pdf.addPage();
				setFill(pdf, theme.pageBg);
				pdf.rect(0, 0, layout.pageW, layout.pageH, 'F');
				currentY = layout.margin + 3;
			}
			const h = drawSystemEvent(pdf, msg.text, currentY, theme, layout);
			currentY += h;
		} else {
			try {
				const innerMaxW = layout.contentW * 0.72 - 6;
				const fontSizeVal = options?.fontSize || 8.5;
				pdf.setFont('helvetica', 'normal');
				pdf.setFontSize(fontSizeVal);
				const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
				const lineHVal = Math.max(3.8, fontSizeVal * 0.52);
				const textH = textLines.length * lineHVal;
				const senderH = (isGroup && (!msg.senderRole || msg.senderRole !== 'owner')) ? 4.8 : 0;
				const callH = msg.callInfo ? 15.0 : 0;

				let attachmentH = 0;
				if (msg.attachment) {
					const att = msg.attachment;
					if ((att.kind === 'image' || att.isSticker) && att.previewUrl) {
						const cached = imgCache.get(att.previewUrl);
						if (cached) {
							const maxH = att.isSticker ? 12 : 45;
							const maxW = att.isSticker ? 12 : innerMaxW;
							const h = (cached.height * maxW) / cached.width;
							attachmentH = Math.min(maxH, h) + 2.0;
						} else {
							attachmentH = att.isSticker ? 12 : 45;
						}
					} else if (att.kind === 'video') attachmentH = 44;
					else if (att.kind === 'audio') attachmentH = 14;
					else if (att.kind === 'document') attachmentH = 14;
					else attachmentH = 7.0;
				}

				const estimatedH = senderH + callH + attachmentH + textH + 3.8 + 5.0;

				// ── Protección contra cortes de página ──
				if (currentY + estimatedH > layout.pageH - layout.margin) {
					pdf.addPage();
					setFill(pdf, theme.pageBg);
					pdf.rect(0, 0, layout.pageW, layout.pageH, 'F');
					currentY = layout.margin + 3;
				}

				const result = await drawMessage(pdf, msg, currentY, theme, layout, isGroup, fontSizeVal);
				currentY += result.heightUsed;
			} catch (err) {
				console.warn('Error al dibujar mensaje en PDF', err);
				currentY += 7;
			}
		}

		// Progreso: 23% → 95%
		if (onProgress) onProgress(23 + Math.round(((i + 1) / total) * 72));

		// Cada 80 mensajes, ceder control al navegador para que no se congele la UI
		if (i % 80 === 0 && i > 0) await yieldToUI();
	}

	if (onProgress) onProgress(95);

	const totalPages = pdf.getNumberOfPages();
	const startPage = (options?.includeCoverPage !== false) ? 2 : 1;

	for (let p = startPage; p <= totalPages; p++) {
		pdf.setPage(p);

		if (options?.watermarkText) {
			drawWatermark(pdf, options.watermarkText);
		}

		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(7.5);
		setTexHex(pdf, theme.metaColor);
		pdf.text(`Página ${p} de ${totalPages}`, layout.pageW / 2, layout.pageH - Math.max(3, layout.margin - 2), { align: 'center' });
	}

	pdf.save(`evidencia_whatsapp_${meta.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}
