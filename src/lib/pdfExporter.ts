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

const PDF_W_MM = 210;
const PDF_H_MM = 297;
const MARGIN = 10;
const CONTENT_W = PDF_W_MM - MARGIN * 2;

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

const imgCache = new Map<string, string>();

/** Convierte y redimensiona un objectURL/blob URL a base64 Data URL con esquinas cuadradas para PDF */
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
		// Ícono de videollamada usando Path2D (Material Design)
		ctx.save();
		ctx.translate(24, 24);
		ctx.scale(2, 2);
		const p = new Path2D("M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z");
		ctx.fill(p);
		ctx.restore();
	} else {
		// Ícono de teléfono usando Path2D (Material Design)
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

/** Convierte y redimensiona un objectURL/blob URL a base64 Data URL optimizado para PDF (JPEG para fotos, PNG para stickers) */
async function urlToPngDataUrl(
	url: string,
	maxDim: number = 450,
	isSticker: boolean = false,
	bgColor: string = '#ffffff'
): Promise<string | null> {
	if (!url) return null;
	const cacheKey = `${url}_${isSticker}_${bgColor}`;
	if (imgCache.has(cacheKey)) return imgCache.get(cacheKey)!;
	try {
		const result = await new Promise<string | null>((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				try {
					let w = img.naturalWidth || 100;
					let h = img.naturalHeight || 100;

					if (w > maxDim || h > maxDim) {
						if (w > h) {
							h = Math.round((h * maxDim) / w);
							w = maxDim;
						} else {
							w = Math.round((w * maxDim) / h);
							h = maxDim;
						}
					}

					const canvas = document.createElement('canvas');
					canvas.width = w;
					canvas.height = h;
					const ctx = canvas.getContext('2d');
					if (!ctx) return resolve(null);

					if (isSticker) {
						// Stickers conservan formato PNG transparente
						ctx.drawImage(img, 0, 0, w, h);
						resolve(canvas.toDataURL('image/png'));
					} else {
						// Para fotos normales: rellenar fondo con el color de la burbuja y redondear esquinas
						ctx.fillStyle = bgColor;
						ctx.fillRect(0, 0, w, h);

						const radius = 12; // Radio de borde fijo de 12px para fotos
						ctx.beginPath();
						if (typeof ctx.roundRect === 'function') {
							ctx.roundRect(0, 0, w, h, radius);
						} else {
							ctx.moveTo(radius, 0);
							ctx.arcTo(w, 0, w, h, radius);
							ctx.arcTo(w, h, 0, h, radius);
							ctx.arcTo(0, h, 0, 0, radius);
							ctx.arcTo(0, 0, w, 0, radius);
							ctx.closePath();
						}
						ctx.clip();
						ctx.drawImage(img, 0, 0, w, h);

						// JPEG a 0.80 ocupa ~50KB por imagen (evita RangeError: Invalid string length)
						resolve(canvas.toDataURL('image/jpeg', 0.80));
					}
				} catch {
					resolve(null);
				}
			};
			img.onerror = () => resolve(null);
			img.src = url;
		});
		if (result) imgCache.set(cacheKey, result);
		return result;
	} catch {
		return null;
	}
}

function getImgDims(dataUrl: string): { w: number; h: number } {
	// Fast sync path: decode dims from data URL using a temporary Image
	// (safe to use synchronously only when the data URL is already in memory)
	const img = new Image();
	img.src = dataUrl;
	if (img.naturalWidth > 0) return { w: img.naturalWidth, h: img.naturalHeight };
	// Fallback for browsers that don't resolve immediately
	return { w: 300, h: 200 };
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
	return pdf.splitTextToSize(cleaned, maxWidth);
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
	isGroup: boolean = false
): Promise<DrawResult> {
	const isOwner = msg.senderRole === 'owner';
	const time = msg.time.slice(0, 5);

	const bubbleBg = isOwner ? theme.bubbleOutBg : theme.bubbleInBg;
	const textColor = isOwner ? theme.bubbleOutText : theme.bubbleInText;

	const maxBubbleW = CONTENT_W * 0.72;
	const bubblePadX = 3.2;
	const bubblePadY = 2.5;
	const lineH = 4.8;

	// Tipografía 10.5pt (aprox 13-14px para impresión perfecta)
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(10.5);

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
			imgDataUrl = await urlToPngDataUrl(att.previewUrl, 450, att.isSticker, bubbleBg);
			if (imgDataUrl) {
				const dims = getImgDims(imgDataUrl);
				const maxH = att.isSticker ? 32 : 55;
				imgDrawW = innerMaxW;
				imgDrawH = (dims.h * imgDrawW) / dims.w;
				if (imgDrawH > maxH) {
					imgDrawH = maxH;
					imgDrawW = (dims.w * imgDrawH) / dims.h;
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
	pdf.setFontSize(10.5);
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

	// Para imágenes, ajustar la burbuja al ancho de la foto (o al texto si tiene pie de foto)
	if (imgDrawW > 0) {
		if (textLines.length > 0) {
			calculatedW = Math.max(imgDrawW + bubblePadX * 2, maxLineWidth + bubblePadX * 2 + 10);
		} else {
			calculatedW = imgDrawW + bubblePadX * 2;
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
		? MARGIN + CONTENT_W - bubbleW
		: MARGIN + 2.5;

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

			// Badge de duraci\u00f3n esquina inferior izquierda
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
				// Nombre del archivo si no hay duraci\u00f3n
				pdf.setFont('helvetica', 'normal');
				pdf.setFontSize(7.5);
				setTextRgb(pdf, 180, 180, 180);
				drawSingleLineText(pdf, att.fileName || 'Video', attX + 2.5, drawY + vidH - 4, vidW - 5);
			}
			drawY += vidH + 2.0;

		// ── NOTA DE VOZ REALISTA (Exacamente como WhatsApp) ──
		} else if (att.kind === 'audio') {
			// Bot\u00f3n de reproducir (c\u00edrculo verde) a la izquierda
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

			// Duraci\u00f3n debajo de la waveform (alineada con el inicio de las barras)
			const audDur = att.durationSeconds
				? `${Math.floor(att.durationSeconds / 60)}:${Math.floor(att.durationSeconds % 60).toString().padStart(2, '0')}`
				: '0:00';
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(7.5);
			setTexHex(pdf, theme.metaColor);
			pdf.text(audDur, wfStartX, drawY + 13.5);

			drawY += attachmentH;

		// ── DOCUMENTO: Card tipo WhatsApp con \u00edcono de archivo coloreado ──
		} else if (att.kind === 'document') {
			const docW = bubbleW - bubblePadX * 2;
			const docH = 14.0;
			setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#182229');
			roundedRect(pdf, attX, drawY, docW, docH, 2.2, 'F');

			// \u00cdcono de archivo con color seg\u00fan extensi\u00f3n
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
			// Extensi\u00f3n dentro del \u00edcono (texto blanco)
			pdf.setFont('helvetica', 'bold');
			pdf.setFontSize(4.2);
			setTextRgb(pdf, 255, 255, 255);
			pdf.text(fileExt.slice(0, 3), attX + 3.0, drawY + 8.8);

			// Nombre del archivo
			pdf.setFont('helvetica', 'bold');
			pdf.setFontSize(8.5);
			setTexHex(pdf, textColor);
			drawSingleLineText(pdf, att.fileName || 'Documento', attX + 11.0, drawY + 7.5, docW - 13);

			// Tipo y tama\u00f1o
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
		pdf.setFontSize(10.5);
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

function drawSystemEvent(pdf: jsPDF, text: string, y: number, theme: PdfThemeColors): number {
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(8);
	const textW = pdf.getTextWidth(cleanPdfText(text));
	const pillW = textW + 12;
	const pillX = (PDF_W_MM - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 6.0, 1.8, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(cleanPdfText(text), pillX + 6, y + 4.2);
	return 7.5;
}

function drawDateSeparator(pdf: jsPDF, label: string, y: number, theme: PdfThemeColors): number {
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(8.5);
	const textW = pdf.getTextWidth(label);
	const pillW = textW + 14;
	const pillX = (PDF_W_MM - pillW) / 2;
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

function drawCoverPage(pdf: jsPDF, meta: ChatMeta, options?: PdfExportOptions) {
	const theme = getThemeColors(options?.pdfTheme);

	setFill(pdf, theme.name === 'dark' ? '#0d1418' : '#f8fafc');
	pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');

	const headerY = 25;
	setFill(pdf, theme.name === 'dark' ? '#005c4b' : '#00a884');
	pdf.rect(MARGIN, headerY, CONTENT_W, 20, 'F');

	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(14);
	setTextRgb(pdf, 255, 255, 255);
	pdf.text('INFORME DE EVIDENCIA DIGITAL — CHAT DE WHATSAPP', PDF_W_MM / 2, headerY + 12, { align: 'center' });

	const metaBoxY = headerY + 28;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, MARGIN, metaBoxY, CONTENT_W, 36, 2.5, 'F');

	const cleanTitle = (meta.title || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u200b]/g, '').trim() || 'Chat de WhatsApp';
	const cleanSource = (meta.sourceFileName || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u200b]/g, '').trim() || 'WhatsApp_Chat.zip';

	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(12);
	setTexHex(pdf, theme.bubbleInText);
	pdf.text(cleanTitle, MARGIN + 8, metaBoxY + 10);

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9.5);
	setTexHex(pdf, theme.metaColor);
	pdf.text(`Origen: ${cleanSource}`, MARGIN + 8, metaBoxY + 18);
	pdf.text(`Fecha de procesamiento: ${new Date(meta.parsedAt).toLocaleString('es-ES')}`, MARGIN + 8, metaBoxY + 26);

	if (options?.caseNumber || options?.investigatorName || options?.courtInstitution) {
		const boxY = metaBoxY + 42;
		setFill(pdf, theme.pillBg);
		roundedRect(pdf, MARGIN, boxY, CONTENT_W, 30, 2.5, 'F');

		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(9.5);
		setTexHex(pdf, theme.senderColor);
		pdf.text('DATOS DE LA INVESTIGACIÓN / CADENA DE CUSTODIA', MARGIN + 8, boxY + 8);

		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(9);
		setTexHex(pdf, theme.bubbleInText);

		let curY = boxY + 16;
		if (options.caseNumber) {
			pdf.text(`N° de Expediente / Registro:  ${options.caseNumber}`, MARGIN + 8, curY);
			curY += 6;
		}
		if (options.investigatorName) {
			pdf.text(`Perito / Investigador:        ${options.investigatorName}`, MARGIN + 8, curY);
			curY += 6;
		}
		if (options.courtInstitution) {
			pdf.text(`Juzgado / Unidad:              ${options.courtInstitution}`, MARGIN + 8, curY);
		}
	}

	const statsY = 154;
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(11);
	setTexHex(pdf, theme.senderColor);
	pdf.text('RESUMEN DE REGISTROS EXTRAÍDOS', PDF_W_MM / 2, statsY, { align: 'center' });

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9.5);
	setTexHex(pdf, theme.metaColor);
	pdf.text(`Total de mensajes procesados: ${meta.totalMessages}`, PDF_W_MM / 2, statsY + 8, { align: 'center' });
	pdf.text(`Rango temporal: ${meta.dateRangeStart ?? 'N/A'}  →  ${meta.dateRangeEnd ?? 'N/A'}`, PDF_W_MM / 2, statsY + 15, { align: 'center' });

	if (meta.participants.length) {
		pdf.setFontSize(9);
		pdf.text('Participantes de la conversación:', PDF_W_MM / 2, statsY + 25, { align: 'center' });
		meta.participants.forEach((p, i) => {
			setTexHex(pdf, theme.bubbleInText);
			pdf.text(`• ${p}`, PDF_W_MM / 2, statsY + 32 + i * 6, { align: 'center' });
		});
	}

	const footerBoxY = PDF_H_MM - 45;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, MARGIN, footerBoxY, CONTENT_W, 30, 2, 'F');

	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(8);
	setTexHex(pdf, theme.senderColor);
	pdf.text('FIRMA DE INTEGRIDAD CRIPTOGRÁFICA (SHA-256):', MARGIN + 6, footerBoxY + 7);

	pdf.setFont('courier', 'normal');
	pdf.setFontSize(7.5);
	setTexHex(pdf, theme.metaColor);
	pdf.text(meta.sourceHash || 'No disponible', MARGIN + 6, footerBoxY + 14, { maxWidth: CONTENT_W - 12 });

	pdf.setFont('helvetica', 'italic');
	pdf.setFontSize(7.5);
	pdf.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}  ·  Archivo origen: ${meta.sourceFileName}`, MARGIN + 6, footerBoxY + 23);
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
	const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
	const theme = getThemeColors(options?.pdfTheme);

	const hiddenSet = get(hiddenMediaStore);
	const isGroup = meta.participants.length > 2;

	let exportMessages = messages.filter((m) => {
		if (hiddenSet.has(m.id)) return false;
		if (options?.dateFrom && m.date < options.dateFrom) return false;
		if (options?.dateTo && m.date > options.dateTo) return false;
		if (m.isSystemEvent) return options?.includeSystemEvents ?? false;

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
	// En vez de cargar cada imagen cuando se dibuja su burbuja (secuencial, lento),
	// cargamos TODAS las imágenes en paralelo antes de dibujar nada.
	const imgMessages = exportMessages.filter(
		(m) => m.attachment && (m.attachment.kind === 'image' || m.attachment.isSticker) && m.attachment.previewUrl
	);
	const PARALLEL_BATCH = 8; // 8 imágenes a la vez para no saturar el navegador
	for (let i = 0; i < imgMessages.length; i += PARALLEL_BATCH) {
		const chunk = imgMessages.slice(i, i + PARALLEL_BATCH);
		await Promise.all(
			chunk.map((m) => {
				const att = m.attachment!;
				const isOwner = m.senderRole === 'owner';
				const bgColor = isOwner ? theme.bubbleOutBg : theme.bubbleInBg;
				return urlToPngDataUrl(att.previewUrl!, 450, att.isSticker, bgColor);
			})
		);
		// Progreso de pre-carga: 3% → 18%
		if (onProgress) onProgress(3 + Math.round(((i + PARALLEL_BATCH) / Math.max(imgMessages.length, 1)) * 15));
	}

	if (onProgress) onProgress(18);

	if (options?.includeCoverPage !== false) {
		drawCoverPage(pdf, meta, options);
		if (options?.watermarkText) {
			drawWatermark(pdf, options.watermarkText);
		}
		pdf.addPage();
	}

	setFill(pdf, theme.pageBg);
	pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');

	let currentY = MARGIN + 4;
	let lastDate = '';
	const total = exportMessages.length;

	for (let i = 0; i < total; i++) {
		const msg = exportMessages[i];

		if (!msg.isSystemEvent && msg.date !== lastDate) {
			lastDate = msg.date;
			const [y, mo, d] = msg.date.split('-');
			const dt = new Date(Number(y), Number(mo) - 1, Number(d));
			const label = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

			if (currentY + 12 > PDF_H_MM - MARGIN) {
				pdf.addPage();
				setFill(pdf, theme.pageBg);
				pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');
				currentY = MARGIN + 4;
			}
			currentY += 1.5;
			const dateH = drawDateSeparator(pdf, label, currentY, theme);
			currentY += dateH;
		}

		if (msg.isSystemEvent) {
			if (currentY + 9 > PDF_H_MM - MARGIN) {
				pdf.addPage();
				setFill(pdf, theme.pageBg);
				pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');
				currentY = MARGIN + 4;
			}
			const h = drawSystemEvent(pdf, msg.text, currentY, theme);
			currentY += h;
		} else {
			try {
				const innerMaxW = CONTENT_W * 0.72 - 6;
				const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
				const textH = textLines.length * 4.8;
				const senderH = (isGroup && !msg.senderRole || msg.senderRole !== 'owner') ? 4.8 : 0;
				const callH = msg.callInfo ? 9.0 : 0;

				let attachmentH = 0;
				if (msg.attachment) {
					const att = msg.attachment;
					if (att.kind === 'image' || att.isSticker) attachmentH = 48;
					else if (att.kind === 'video') attachmentH = 46;
					else if (att.kind === 'audio') attachmentH = 16;
					else if (att.kind === 'document') attachmentH = 16;
					else attachmentH = 7.0;
				}

				const estimatedH = senderH + callH + attachmentH + textH + 3.8 + 5.0;

				// ── Protección contra cortes de página ──
				if (currentY + estimatedH > PDF_H_MM - MARGIN) {
					pdf.addPage();
					setFill(pdf, theme.pageBg);
					pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');
					currentY = MARGIN + 4;
				}

				const result = await drawMessage(pdf, msg, currentY, theme, isGroup);
				currentY += result.heightUsed;
			} catch (err) {
				console.warn('Error al dibujar mensaje en PDF', err);
				currentY += 7;
			}
		}

		// Progreso: 18% → 93%
		if (onProgress) onProgress(18 + Math.round(((i + 1) / total) * 75));

		// Cada 150 mensajes, ceder control al navegador para que no se congele
		if (i % 150 === 0 && i > 0) await yieldToUI();
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
		pdf.text(`Página ${p} de ${totalPages}`, PDF_W_MM / 2, PDF_H_MM - 4, { align: 'center' });
	}

	pdf.save(`evidencia_whatsapp_${meta.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}
