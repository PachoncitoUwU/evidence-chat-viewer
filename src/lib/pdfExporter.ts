/**
 * pdfExporter.ts
 * ------------------------------------------------------------------
 * Generador pericial de PDF de alta calidad para evidencias de WhatsApp.
 * Renderiza chats completos idénticos a la interfaz oficial de WhatsApp
 * (modo oscuro/claro), con checks vectoriales de leído (✓✓), tarjetas de audio
 * con onda de sonido realista, imágenes fit/cover con bordes superiores redondeados,
 * protección contra cortes de página (page-breaks) e ignorando nombres en chats individuales.
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

/** Convierte y redimensiona un objectURL/blob URL a base64 Data URL con esquinas redondeadas para PDF */
async function urlToPngDataUrl(
	url: string,
	maxDim: number = 600,
	roundedTopOnly: boolean = false
): Promise<string | null> {
	if (!url) return null;
	const cacheKey = url + (roundedTopOnly ? '_topRound' : '');
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

					const radius = Math.min(w, h) * 0.05;
					ctx.beginPath();
					if (roundedTopOnly) {
						ctx.moveTo(radius, 0);
						ctx.lineTo(w - radius, 0);
						ctx.quadraticCurveTo(w, 0, w, radius);
						ctx.lineTo(w, h);
						ctx.lineTo(0, h);
						ctx.lineTo(0, radius);
						ctx.quadraticCurveTo(0, 0, radius, 0);
					} else {
						if (typeof ctx.roundRect === 'function') {
							ctx.roundRect(0, 0, w, h, radius);
						} else {
							ctx.rect(0, 0, w, h);
						}
					}
					ctx.clip();
					ctx.drawImage(img, 0, 0, w, h);

					const isPngOrSticker = url.includes('.webp') || url.includes('.png');
					const dataUrl = isPngOrSticker
						? canvas.toDataURL('image/png')
						: canvas.toDataURL('image/jpeg', 0.88);

					resolve(dataUrl);
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

function getImgDims(dataUrl: string): Promise<{ w: number; h: number }> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
		img.onerror = () => resolve({ w: 100, h: 100 });
		img.src = dataUrl;
	});
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

/** Dibuja el doble check azul vectorial oficial de WhatsApp (✓✓) sin usar texto "vv" */
function drawVectorDoubleCheck(pdf: jsPDF, x: number, y: number, colorHex: string = '#53bdeb') {
	setStroke(pdf, colorHex);
	pdf.setLineWidth(0.35);
	// Primer check (izquierdo)
	pdf.line(x, y + 1.2, x + 0.9, y + 2.1);
	pdf.line(x + 0.9, y + 2.1, x + 2.4, y);
	// Segundo check (derecho)
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
	audioCardBg: string;
	audioPlayBg: string;
	audioWaveColor: string;
	borderColor?: string;
}

function getThemeColors(theme?: 'dark' | 'light' | 'legal'): PdfThemeColors {
	if (theme === 'light') {
		return {
			name: 'light',
			pageBg: '#e5ddd5',
			bubbleOutBg: '#d9fdd3',
			bubbleOutText: '#111b21',
			bubbleInBg: '#ffffff',
			bubbleInText: '#111b21',
			senderColor: '#00a884',
			metaColor: '#667781',
			pillBg: '#e1e6e3',
			pillText: '#54656f',
			audioCardBg: '#c8edd0',
			audioPlayBg: '#00a884',
			audioWaveColor: '#00a884'
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
			audioCardBg: '#e5e7eb',
			audioPlayBg: '#374151',
			audioWaveColor: '#6b7280',
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
		pillText: '#cdd6db',
		audioCardBg: '#182229',
		audioPlayBg: '#00a884',
		audioWaveColor: '#00a884'
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
	const bubblePadX = 3.8;
	const bubblePadY = 3.2;
	const lineH = 4.6;

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9.5); // Tipografía clara 9.5pt para legibilidad

	const innerMaxW = maxBubbleW - bubblePadX * 2 - 4;

	// Nombre del remitente (solo si es chat grupal)
	const senderNameStr = (isGroup && !isOwner && msg.senderName) ? cleanPdfText(msg.senderName) : '';
	const senderH = senderNameStr ? 4.8 : 0;

	// Detección de mensajes eliminados
	const isDeleted = msg.text.toLowerCase().includes('se eliminó este mensaje') ||
	                  msg.text.toLowerCase().includes('este mensaje fue eliminado');

	// Texto del mensaje
	const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
	const textH = textLines.length * lineH;

	// Llamadas
	const callH = msg.callInfo ? 9.5 : 0;

	// Adjuntos
	let attachmentH = 0;
	let imgDataUrl: string | null = null;
	let imgDrawW = 0;
	let imgDrawH = 0;

	if (msg.attachment) {
		const att = msg.attachment;
		if (att.status === 'omitted' || att.status === 'missing') {
			attachmentH = 7.5;
		} else if ((att.kind === 'image' || att.isSticker) && att.previewUrl) {
			imgDataUrl = await urlToPngDataUrl(att.previewUrl, 600, true);
			if (imgDataUrl) {
				const dims = await getImgDims(imgDataUrl);
				const maxH = att.isSticker ? 32 : 55;
				imgDrawW = innerMaxW;
				imgDrawH = (dims.h * imgDrawW) / dims.w;
				if (imgDrawH > maxH) {
					imgDrawH = maxH;
					imgDrawW = (dims.w * imgDrawH) / dims.h;
				}
				attachmentH = imgDrawH + 3.5;
			} else {
				attachmentH = 8.5;
			}
		} else if (att.kind === 'video') {
			attachmentH = 14;
		} else if (att.kind === 'audio') {
			attachmentH = 14;
		} else if (att.kind === 'document') {
			attachmentH = 12.5;
		} else {
			attachmentH = 7.5;
		}
	}

	const metaH = 4.2;
	const bubbleH = senderH + callH + attachmentH + textH + metaH + bubblePadY * 2;

	let maxLineWidth = 0;
	if (senderNameStr) {
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8.5);
		maxLineWidth = Math.max(maxLineWidth, pdf.getTextWidth(senderNameStr));
	}

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9.5);
	textLines.forEach((line) => {
		maxLineWidth = Math.max(maxLineWidth, pdf.getTextWidth(line));
	});

	if (imgDrawW > 0) {
		maxLineWidth = Math.max(maxLineWidth, imgDrawW);
	} else if (msg.attachment || msg.callInfo) {
		maxLineWidth = Math.max(maxLineWidth, 48);
	}

	const calculatedW = maxLineWidth + bubblePadX * 2 + 12;
	const bubbleW = Math.max(
		maxBubbleW * 0.38,
		Math.min(maxBubbleW, calculatedW)
	);

	const bubbleX = isOwner
		? MARGIN + CONTENT_W - bubbleW
		: MARGIN + 2.5;

	// ── Fondo de burbuja ──
	setFill(pdf, bubbleBg);
	if (theme.borderColor) {
		setStroke(pdf, theme.borderColor);
		pdf.setLineWidth(0.2);
		roundedRect(pdf, bubbleX, y, bubbleW, bubbleH, 2.5, 'FD');
	} else {
		roundedRect(pdf, bubbleX, y, bubbleW, bubbleH, 2.5, 'F');
	}

	// ── Cola de burbuja (Triangulito limpio sin artefactos) ──
	setFill(pdf, bubbleBg);
	if (isOwner) {
		pdf.triangle(
			bubbleX + bubbleW, y + 0.5,
			bubbleX + bubbleW + 2.5, y,
			bubbleX + bubbleW, y + 3.8,
			'F'
		);
	} else {
		pdf.triangle(
			bubbleX, y + 0.5,
			bubbleX - 2.5, y,
			bubbleX, y + 3.8,
			'F'
		);
	}

	let drawY = y + bubblePadY;

	// ── Remitente (Grupales) ──
	if (senderNameStr) {
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8.5);
		setTexHex(pdf, theme.senderColor);
		pdf.text(senderNameStr, bubbleX + bubblePadX + 1, drawY + 3.0);
		drawY += senderH;
	}

	// ── Llamadas de WhatsApp ──
	if (msg.callInfo) {
		const call = msg.callInfo;
		const isMissed = call.status === 'missed' || call.status === 'declined';
		setFill(pdf, isMissed ? '#fef2f2' : (theme.name === 'light' ? '#eefbf0' : '#182229'));
		roundedRect(pdf, bubbleX + bubblePadX, drawY, bubbleW - bubblePadX * 2, 8.5, 1.8, 'F');

		const icX = bubbleX + bubblePadX + 4;
		const icY = drawY + 4.25;
		setFill(pdf, isMissed ? '#dc2626' : '#00a884');
		pdf.circle(icX, icY, 2.8, 'F');

		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8);
		if (isMissed) setTextRgb(pdf, 220, 38, 38);
		else setTextRgb(pdf, 0, 168, 132);

		const title = isMissed
			? (call.type === 'video' ? 'Videollamada perdida' : 'Llamada de voz perdida')
			: (call.type === 'video' ? 'Videollamada' : 'Llamada de voz');

		drawSingleLineText(pdf, title, bubbleX + bubblePadX + 9, drawY + 5.5, bubbleW - bubblePadX * 2 - 11);
		drawY += callH;
	}

	// ── Adjuntos ──
	if (msg.attachment) {
		const att = msg.attachment;
		const attX = isOwner ? bubbleX + bubbleW - bubblePadX - imgDrawW : bubbleX + bubblePadX;

		if (att.status === 'omitted') {
			pdf.setFont('helvetica', 'italic');
			pdf.setFontSize(8);
			setTexHex(pdf, theme.metaColor);
			pdf.text('📷 [Multimedia omitido]', bubbleX + bubblePadX + 1, drawY + 4);
			drawY += attachmentH;
		} else if (att.status === 'missing') {
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(8);
			setTextRgb(pdf, 220, 38, 38);
			drawSingleLineText(
				pdf,
				att.fileName ? `⚠️ ${att.fileName} (no encontrado)` : '⚠️ Archivo no encontrado',
				bubbleX + bubblePadX + 1,
				drawY + 4,
				bubbleW - bubblePadX * 2 - 2
			);
			drawY += attachmentH;
		} else if ((att.kind === 'image' || att.isSticker) && imgDataUrl) {
			try {
				const format = imgDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
				pdf.addImage(imgDataUrl, format, attX, drawY, imgDrawW, imgDrawH);
			} catch {
				setFill(pdf, '#2a3942');
				pdf.rect(bubbleX + bubblePadX, drawY, innerMaxW, imgDrawH, 'F');
				pdf.setFontSize(7.5);
				setTexHex(pdf, theme.metaColor);
				drawSingleLineText(pdf, att.fileName || 'Imagen', bubbleX + bubblePadX + 2, drawY + imgDrawH / 2, innerMaxW - 4);
			}
			drawY += imgDrawH + 3.5;
		} else if (att.kind === 'video') {
			setFill(pdf, theme.name === 'light' ? '#e2ebd5' : '#0d1b22');
			roundedRect(pdf, bubbleX + bubblePadX, drawY, bubbleW - bubblePadX * 2, 12, 1.8, 'F');
			const cx = bubbleX + bubblePadX + 6;
			const cy = drawY + 6;
			setFill(pdf, '#00a884');
			pdf.circle(cx, cy, 3.5, 'F');
			setFill(pdf, '#ffffff');
			pdf.triangle(cx - 1, cy - 1.8, cx - 1, cy + 1.8, cx + 2, cy, 'F');
			pdf.setFontSize(8);
			setTexHex(pdf, textColor);
			drawSingleLineText(pdf, att.fileName || 'Video', bubbleX + bubblePadX + 12, drawY + 7.5, bubbleW - bubblePadX * 2 - 14);
			drawY += attachmentH;

		// ── REPRODUCTOR DE NOTA DE VOZ (AUDIO) REALISTA ──
		} else if (att.kind === 'audio') {
			const cardW = bubbleW - bubblePadX * 2;
			const cardH = 13.5;
			setFill(pdf, theme.name === 'light' ? '#c8edd0' : '#182229');
			roundedRect(pdf, bubbleX + bubblePadX, drawY, cardW, cardH, 2.5, 'F');

			// Avatar de perfil (izq)
			const avX = bubbleX + bubblePadX + 5.5;
			const avY = drawY + 6.75;
			setFill(pdf, theme.name === 'light' ? '#ffffff' : '#26343d');
			pdf.circle(avX, avY, 3.8, 'F');

			// Icono de micrófono vectorial en avatar
			setFill(pdf, '#00a884');
			pdf.rect(avX - 0.9, avY - 2.0, 1.8, 2.6, 'F');

			// Botón Play verde circular
			const playX = bubbleX + bubblePadX + 15.5;
			const playY = drawY + 6.75;
			setFill(pdf, '#00a884');
			pdf.circle(playX, playY, 4.2, 'F');
			setFill(pdf, '#ffffff');
			pdf.triangle(playX - 1.2, playY - 2.2, playX - 1.2, playY + 2.2, playX + 2.4, playY, 'F');

			// Barritas verticales de onda de sonido (waveform realista)
			const barHeights = [2.2, 4.5, 1.8, 5.2, 3.2, 5.8, 2.5, 4.8, 3.5, 2.0, 4.2, 3.0, 5.0, 2.2, 4.0, 3.0, 1.8, 3.2];
			const barCount = barHeights.length;
			const startBarX = bubbleX + bubblePadX + 23;
			const barZone = cardW - 27;
			const barW = Math.max(0.6, barZone / barCount - 0.4);

			for (let i = 0; i < barCount; i++) {
				const bh = barHeights[i];
				const bx = startBarX + i * (barW + 0.4);
				const by = drawY + 5.8 - bh / 2;
				// Primeros 40% en verde activo, resto en gris
				if (i < Math.floor(barCount * 0.4)) {
					setFill(pdf, '#00a884');
				} else {
					setFill(pdf, theme.name === 'light' ? '#8696a0' : '#3b4a54');
				}
				pdf.rect(bx, by, barW, bh, 'F');
			}

			// Duración del audio (ej. 0:06 o att.durationSeconds)
			const durationStr = att.durationSeconds
				? `${Math.floor(att.durationSeconds / 60)}:${Math.floor(att.durationSeconds % 60).toString().padStart(2, '0')}`
				: '0:06';

			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(7);
			setTexHex(pdf, theme.metaColor);
			pdf.text(durationStr, bubbleX + bubblePadX + cardW - 3, drawY + 11.8, { align: 'right' });

			drawY += attachmentH;
		} else if (att.kind === 'document') {
			setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#182229');
			roundedRect(pdf, bubbleX + bubblePadX, drawY, bubbleW - bubblePadX * 2, 10.5, 2, 'F');
			// Icono documento
			setFill(pdf, '#4f46e5');
			roundedRect(pdf, bubbleX + bubblePadX + 2.5, drawY + 2.2, 4.5, 5.6, 0.6, 'F');
			setFill(pdf, '#ffffff');
			pdf.rect(bubbleX + bubblePadX + 3.5, drawY + 3.6, 2.5, 0.5, 'F');
			pdf.rect(bubbleX + bubblePadX + 3.5, drawY + 4.8, 2.5, 0.5, 'F');
			pdf.setFontSize(8);
			setTexHex(pdf, textColor);
			drawSingleLineText(
				pdf,
				att.fileName || 'Documento',
				bubbleX + bubblePadX + 9,
				drawY + 6.8,
				bubbleW - bubblePadX * 2 - 12
			);
			drawY += attachmentH;
		} else {
			drawY += attachmentH;
		}
	}

	// ── Texto del mensaje ──
	if (textLines.length > 0) {
		pdf.setFont('helvetica', isDeleted ? 'italic' : 'normal');
		pdf.setFontSize(9.5);
		const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

		for (const line of textLines) {
			const startX = bubbleX + bubblePadX + 1;
			const startY = drawY + 3.5;

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
	const timeX = bubbleX + bubbleW - bubblePadX - pdf.getTextWidth(time) - (isOwner ? 5.5 : 1);
	pdf.text(time, timeX, drawY + 2.5);

	if (isOwner) {
		// Doble check vectorial azul oficial de WhatsApp
		drawVectorDoubleCheck(pdf, bubbleX + bubbleW - bubblePadX - 4.2, drawY + 0.6, '#53bdeb');
	}

	return { heightUsed: bubbleH + 4.0 };
}

function drawSystemEvent(pdf: jsPDF, text: string, y: number, theme: PdfThemeColors): number {
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(8);
	const textW = pdf.getTextWidth(cleanPdfText(text));
	const pillW = textW + 12;
	const pillX = (PDF_W_MM - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 6.5, 1.8, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(cleanPdfText(text), pillX + 6, y + 4.4);
	return 8.5;
}

function drawDateSeparator(pdf: jsPDF, label: string, y: number, theme: PdfThemeColors): number {
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(8.5);
	const textW = pdf.getTextWidth(label);
	const pillW = textW + 14;
	const pillX = (PDF_W_MM - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 7, 2, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(label, pillX + 7, y + 4.8);
	return 9.5;
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

	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(12);
	setTexHex(pdf, theme.bubbleInText);
	pdf.text(meta.title, MARGIN + 8, metaBoxY + 10);

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9.5);
	setTexHex(pdf, theme.metaColor);
	pdf.text(`Origen: ${meta.sourceFileName}`, MARGIN + 8, metaBoxY + 18);
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

	if (onProgress) onProgress(5);

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

			if (currentY + 14 > PDF_H_MM - MARGIN) {
				pdf.addPage();
				setFill(pdf, theme.pageBg);
				pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');
				currentY = MARGIN + 4;
			}
			currentY += 2;
			const dateH = drawDateSeparator(pdf, label, currentY, theme);
			currentY += dateH;
		}

		if (msg.isSystemEvent) {
			if (currentY + 10 > PDF_H_MM - MARGIN) {
				pdf.addPage();
				setFill(pdf, theme.pageBg);
				pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');
				currentY = MARGIN + 4;
			}
			const h = drawSystemEvent(pdf, msg.text, currentY, theme);
			currentY += h;
		} else {
			try {
				const innerMaxW = CONTENT_W * 0.72 - 8;
				const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
				const textH = textLines.length * 4.6;
				const senderH = (isGroup && !msg.senderRole || msg.senderRole !== 'owner') ? 4.8 : 0;
				const callH = msg.callInfo ? 9.5 : 0;

				let attachmentH = 0;
				if (msg.attachment) {
					const att = msg.attachment;
					if (att.kind === 'image' || att.isSticker) attachmentH = 48;
					else if (att.kind === 'video') attachmentH = 14;
					else if (att.kind === 'audio') attachmentH = 14;
					else if (att.kind === 'document') attachmentH = 12.5;
					else attachmentH = 7.5;
				}

				const estimatedH = senderH + callH + attachmentH + textH + 4.2 + 6.4;

				// ── Protección de salto de página (page-break-inside: avoid) ──
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
				currentY += 8;
			}
		}

		if (onProgress) onProgress(5 + Math.round(((i + 1) / total) * 88));
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
