/**
 * pdfExporter.ts
 * ------------------------------------------------------------------
 * Generador pericial de PDF de alta calidad para evidencias de WhatsApp.
 * Renderiza chats completos con captura de imágenes con esquinas redondeadas,
 * tarjetas de audio exactas al diseño oficial, llamadas de WhatsApp,
 * carátula pericial, marcas de agua, y soporte para filtros avanzados.
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

/** Convierte y redimensiona un objectURL/blob URL a base64 Data URL con ESQUINAS REDONDEADAS para PDF */
async function urlToPngDataUrl(url: string, maxDim: number = 600): Promise<string | null> {
	if (!url) return null;
	if (imgCache.has(url)) return imgCache.get(url)!;
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

					// Aplicar esquinas redondeadas en el canvas antes de exportar
					const radius = Math.min(w, h) * 0.05;
					ctx.beginPath();
					if (typeof ctx.roundRect === 'function') {
						ctx.roundRect(0, 0, w, h, radius);
					} else {
						ctx.rect(0, 0, w, h);
					}
					ctx.clip();
					ctx.drawImage(img, 0, 0, w, h);

					const isPngOrSticker = url.includes('.webp') || url.includes('.png');
					const dataUrl = isPngOrSticker
						? canvas.toDataURL('image/png')
						: canvas.toDataURL('image/jpeg', 0.85);

					resolve(dataUrl);
				} catch {
					resolve(null);
				}
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
			audioWaveColor: '#639b6e'
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
	// Dark (default)
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
	theme: PdfThemeColors
): Promise<DrawResult> {
	const isOwner = msg.senderRole === 'owner';
	const time = msg.time.slice(0, 5);

	const bubbleBg = isOwner ? theme.bubbleOutBg : theme.bubbleInBg;
	const textColor = isOwner ? theme.bubbleOutText : theme.bubbleInText;

	const maxBubbleW = CONTENT_W * 0.70;
	const bubblePadX = 3.5;
	const bubblePadY = 3.0;
	const lineH = 4.2;

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(8.5);

	const innerMaxW = maxBubbleW - bubblePadX * 2 - 4;

	// Texto
	const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
	const textH = textLines.length * lineH;

	// Remitente
	const senderNameStr = (!isOwner && msg.senderName) ? cleanPdfText(msg.senderName) : '';
	const senderH = senderNameStr ? 4.5 : 0;

	// Llamadas
	const callH = msg.callInfo ? 9 : 0;

	// Adjunto
	let attachmentH = 0;
	let imgDataUrl: string | null = null;
	let imgDrawW = 0;
	let imgDrawH = 0;

	if (msg.attachment) {
		const att = msg.attachment;
		if (att.status === 'omitted' || att.status === 'missing') {
			attachmentH = 7;
		} else if ((att.kind === 'image' || att.isSticker) && att.previewUrl) {
			imgDataUrl = await urlToPngDataUrl(att.previewUrl);
			if (imgDataUrl) {
				const dims = await getImgDims(imgDataUrl);
				const maxH = att.isSticker ? 30 : 50;
				imgDrawW = innerMaxW;
				imgDrawH = (dims.h * imgDrawW) / dims.w;
				if (imgDrawH > maxH) {
					imgDrawH = maxH;
					imgDrawW = (dims.w * imgDrawH) / dims.h;
				}
				attachmentH = imgDrawH + 3;
			} else {
				attachmentH = 8;
			}
		} else if (att.kind === 'video') {
			attachmentH = 14;
		} else if (att.kind === 'audio') {
			attachmentH = 13;
		} else if (att.kind === 'document') {
			attachmentH = 12;
		} else {
			attachmentH = 7;
		}
	}

	const metaH = 4.0;
	const bubbleH = senderH + callH + attachmentH + textH + metaH + bubblePadY * 2;

	let maxLineWidth = 0;
	if (senderNameStr) {
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8);
		maxLineWidth = Math.max(maxLineWidth, pdf.getTextWidth(senderNameStr));
	}

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(8.5);
	textLines.forEach((line) => {
		maxLineWidth = Math.max(maxLineWidth, pdf.getTextWidth(line));
	});

	if (imgDrawW > 0) {
		maxLineWidth = Math.max(maxLineWidth, imgDrawW);
	} else if (msg.attachment || msg.callInfo) {
		maxLineWidth = Math.max(maxLineWidth, 45);
	}

	const calculatedW = maxLineWidth + bubblePadX * 2 + 10;
	const bubbleW = Math.max(
		maxBubbleW * 0.35,
		Math.min(maxBubbleW, calculatedW)
	);

	const bubbleX = isOwner
		? MARGIN + CONTENT_W - bubbleW
		: MARGIN;

	// ── Fondo de burbuja ──
	setFill(pdf, bubbleBg);
	if (theme.borderColor) {
		setStroke(pdf, theme.borderColor);
		pdf.setLineWidth(0.2);
		roundedRect(pdf, bubbleX, y, bubbleW, bubbleH, 2.5, 'FD');
	} else {
		roundedRect(pdf, bubbleX, y, bubbleW, bubbleH, 2.5, 'F');
	}

	// ── Cola de burbuja ──
	setFill(pdf, bubbleBg);
	if (isOwner) {
		pdf.triangle(
			bubbleX + bubbleW, y + 1,
			bubbleX + bubbleW + 2.2, y,
			bubbleX + bubbleW, y + 3.5,
			'F'
		);
	} else {
		pdf.triangle(
			bubbleX, y + 1,
			bubbleX - 2.2, y,
			bubbleX, y + 3.5,
			'F'
		);
	}

	let drawY = y + bubblePadY;

	// ── Remitente ──
	if (senderNameStr) {
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(8);
		setTexHex(pdf, theme.senderColor);
		pdf.text(senderNameStr, bubbleX + bubblePadX + 1, drawY + 2.8);
		drawY += senderH;
	}

	// ── Llamadas de WhatsApp ──
	if (msg.callInfo) {
		const call = msg.callInfo;
		const isMissed = call.status === 'missed' || call.status === 'declined';
		setFill(pdf, isMissed ? '#fef2f2' : (theme.name === 'light' ? '#eefbf0' : '#182229'));
		roundedRect(pdf, bubbleX + bubblePadX, drawY, bubbleW - bubblePadX * 2, 8.5, 1.8, 'F');

		// Icono teléfono
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
			pdf.setFontSize(7.5);
			setTexHex(pdf, theme.metaColor);
			pdf.text('📷 [Multimedia omitido]', bubbleX + bubblePadX + 1, drawY + 4);
			drawY += attachmentH;
		} else if (att.status === 'missing') {
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(7.5);
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
				pdf.setFontSize(7);
				setTexHex(pdf, theme.metaColor);
				drawSingleLineText(pdf, att.fileName || 'Imagen', bubbleX + bubblePadX + 2, drawY + imgDrawH / 2, innerMaxW - 4);
			}
			drawY += imgDrawH + 3;
		} else if (att.kind === 'video') {
			setFill(pdf, theme.name === 'light' ? '#e2ebd5' : '#0d1b22');
			roundedRect(pdf, bubbleX + bubblePadX, drawY, bubbleW - bubblePadX * 2, 12, 1.8, 'F');
			const cx = bubbleX + bubblePadX + 6;
			const cy = drawY + 6;
			setFill(pdf, '#00a884');
			pdf.circle(cx, cy, 3.5, 'F');
			setFill(pdf, '#ffffff');
			pdf.triangle(cx - 1, cy - 1.8, cx - 1, cy + 1.8, cx + 2, cy, 'F');
			pdf.setFontSize(7.5);
			setTexHex(pdf, textColor);
			drawSingleLineText(pdf, att.fileName || 'Video', bubbleX + bubblePadX + 12, drawY + 7.5, bubbleW - bubblePadX * 2 - 14);
			drawY += attachmentH;

		// ── Tarjeta de Audio en PDF idéntica a Imagen 2 ──
		} else if (att.kind === 'audio') {
			const cardW = bubbleW - bubblePadX * 2;
			const cardH = 11;
			setFill(pdf, theme.name === 'light' ? '#c8edd0' : '#182229');
			roundedRect(pdf, bubbleX + bubblePadX, drawY, cardW, cardH, 2.2, 'F');

			// Avatar micrófono (círculo blanco traslúcido a la izquierda)
			const micX = bubbleX + bubblePadX + 5;
			const micY = drawY + 5.5;
			setFill(pdf, theme.name === 'light' ? '#ffffff' : '#26343d');
			pdf.circle(micX, micY, 3.2, 'F');

			// Icono de micrófono vectorial
			setFill(pdf, '#00a884');
			setStroke(pdf, '#00a884');
			pdf.rect(micX - 0.8, micY - 1.8, 1.6, 2.4, 'F');
			pdf.circle(micX, micY + 0.5, 1.1, 'S');

			// Botón Play verde
			const playX = bubbleX + bubblePadX + 13.5;
			const playY = drawY + 5.5;
			setFill(pdf, '#00a884');
			pdf.circle(playX, playY, 3.8, 'F');
			setFill(pdf, '#ffffff');
			pdf.triangle(playX - 1, playY - 1.8, playX - 1, playY + 1.8, playX + 2, playY, 'F');

			// Barritas de onda
			setFill(pdf, theme.audioWaveColor);
			const barCount = 16;
			const startBarX = bubbleX + bubblePadX + 20;
			const barZone = cardW - 24;
			const barW = Math.max(0.5, barZone / barCount - 0.4);
			for (let i = 0; i < barCount; i++) {
				const bh = 1.2 + Math.sin(i * 1.1) * 2.2;
				const bx = startBarX + i * (barW + 0.4);
				const by = drawY + 4.5 - bh / 2;
				pdf.rect(bx, by, barW, bh, 'F');
			}

			// Tiempo 0:06 en la esquina inferior derecha de la onda
			pdf.setFont('helvetica', 'normal');
			pdf.setFontSize(6.5);
			setTexHex(pdf, theme.metaColor);
			pdf.text('0:06', bubbleX + bubblePadX + cardW - 3, drawY + 9.5, { align: 'right' });

			drawY += attachmentH;
		} else if (att.kind === 'document') {
			setFill(pdf, theme.name === 'light' ? '#f0f2f5' : '#182229');
			roundedRect(pdf, bubbleX + bubblePadX, drawY, bubbleW - bubblePadX * 2, 10, 2, 'F');
			// Icono documento
			setFill(pdf, '#4f46e5');
			roundedRect(pdf, bubbleX + bubblePadX + 2.5, drawY + 2.2, 4.5, 5.6, 0.6, 'F');
			setFill(pdf, '#ffffff');
			pdf.rect(bubbleX + bubblePadX + 3.5, drawY + 3.6, 2.5, 0.5, 'F');
			pdf.rect(bubbleX + bubblePadX + 3.5, drawY + 4.8, 2.5, 0.5, 'F');
			pdf.setFontSize(7.5);
			setTexHex(pdf, textColor);
			drawSingleLineText(
				pdf,
				att.fileName || 'Documento',
				bubbleX + bubblePadX + 9,
				drawY + 6.5,
				bubbleW - bubblePadX * 2 - 12
			);
			drawY += attachmentH;
		} else {
			drawY += attachmentH;
		}
	}

	// ── Texto del mensaje ──
	if (textLines.length > 0) {
		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(8.5);
		const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

		for (const line of textLines) {
			const startX = bubbleX + bubblePadX + 1;
			const startY = drawY + 3.2;

			if (urlRegex.test(line)) {
				urlRegex.lastIndex = 0;
				const parts = line.split(/(\s+)/);
				let currentX = startX;

				for (const part of parts) {
					const isUrl = /(https?:\/\/[^\s]+|www\.[^\s]+)/i.test(part);
					if (isUrl) {
						pdf.setFont('helvetica', 'bold');
						setTextRgb(pdf, 2, 132, 199);
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

	// ── Hora y Vistos Azules ──
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(7);
	setTexHex(pdf, theme.metaColor);
	const timeX = bubbleX + bubbleW - bubblePadX - pdf.getTextWidth(time) - (isOwner ? 5 : 1);
	pdf.text(time, timeX, drawY + 2.5);

	if (isOwner) {
		// Vistos azules (Double blue checks)
		setTextRgb(pdf, 83, 189, 235);
		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(7);
		pdf.text('vv', bubbleX + bubbleW - bubblePadX - 3.8, drawY + 2.5);
	}

	return { heightUsed: bubbleH + 3.5 };
}

function drawSystemEvent(pdf: jsPDF, text: string, y: number, theme: PdfThemeColors): number {
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(7.5);
	const textW = pdf.getTextWidth(cleanPdfText(text));
	const pillW = textW + 10;
	const pillX = (PDF_W_MM - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 6, 1.5, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(cleanPdfText(text), pillX + 5, y + 4.2);
	return 8;
}

function drawDateSeparator(pdf: jsPDF, label: string, y: number, theme: PdfThemeColors): number {
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(8);
	const textW = pdf.getTextWidth(label);
	const pillW = textW + 12;
	const pillX = (PDF_W_MM - pillW) / 2;
	setFill(pdf, theme.pillBg);
	roundedRect(pdf, pillX, y, pillW, 7, 1.5, 'F');
	setTexHex(pdf, theme.pillText);
	pdf.text(label, pillX + 6, y + 4.8);
	return 10;
}

function drawWatermark(pdf: jsPDF, watermarkText: string) {
	if (!watermarkText) return;
	pdf.saveGraphicsState();
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(28);
	setTextRgb(pdf, 180, 180, 180);
	const cx = PDF_W_MM / 2;
	const cy = PDF_H_MM / 2;
	pdf.text(watermarkText, cx, cy, { align: 'center', angle: 35 });
	pdf.restoreGraphicsState();
}

function drawCoverPage(pdf: jsPDF, meta: ChatMeta, options?: PdfExportOptions) {
	const theme = getThemeColors(options?.pdfTheme);

	setFill(pdf, theme.pageBg);
	pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');

	setFill(pdf, '#005c4b');
	pdf.rect(0, 0, PDF_W_MM, 24, 'F');
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(11);
	setTextRgb(pdf, 255, 255, 255);
	pdf.text('INFORME DE EVIDENCIA DIGITAL Y TRANSCRIPCIÓN PERICIAL', PDF_W_MM / 2, 14, { align: 'center' });

	setFill(pdf, '#005c4b');
	pdf.circle(PDF_W_MM / 2, 60, 18, 'F');
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(22);
	setTextRgb(pdf, 220, 255, 240);
	pdf.text(meta.title.slice(0, 1).toUpperCase(), PDF_W_MM / 2, 67, { align: 'center' });

	pdf.setFontSize(18);
	setTexHex(pdf, theme.bubbleInText);
	pdf.text(meta.title, PDF_W_MM / 2, 92, { align: 'center', maxWidth: CONTENT_W });

	setFill(pdf, '#00a884');
	pdf.rect(MARGIN + 30, 98, CONTENT_W - 60, 0.6, 'F');

	if (options?.caseNumber || options?.investigatorName || options?.courtInstitution) {
		const boxY = 106;
		setFill(pdf, theme.pillBg);
		roundedRect(pdf, MARGIN + 10, boxY, CONTENT_W - 20, 36, 3, 'F');

		pdf.setFont('helvetica', 'bold');
		pdf.setFontSize(9);
		setTexHex(pdf, theme.senderColor);
		pdf.text('DATOS DE LA INVESTIGACIÓN / CADENA DE CUSTODIA', MARGIN + 18, boxY + 8);

		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(8.5);
		setTexHex(pdf, theme.bubbleInText);

		let curY = boxY + 16;
		if (options.caseNumber) {
			pdf.text(`N° de Expediente / Registro:  ${options.caseNumber}`, MARGIN + 18, curY);
			curY += 6;
		}
		if (options.investigatorName) {
			pdf.text(`Perito / Investigador:        ${options.investigatorName}`, MARGIN + 18, curY);
			curY += 6;
		}
		if (options.courtInstitution) {
			pdf.text(`Juzgado / Unidad:              ${options.courtInstitution}`, MARGIN + 18, curY);
		}
	}

	const statsY = 154;
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(10);
	setTexHex(pdf, theme.senderColor);
	pdf.text('RESUMEN DE REGISTROS EXTRAÍDOS', PDF_W_MM / 2, statsY, { align: 'center' });

	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(9);
	setTexHex(pdf, theme.metaColor);
	pdf.text(`Total de mensajes procesados: ${meta.totalMessages}`, PDF_W_MM / 2, statsY + 8, { align: 'center' });
	pdf.text(`Rango temporal: ${meta.dateRangeStart ?? 'N/A'}  →  ${meta.dateRangeEnd ?? 'N/A'}`, PDF_W_MM / 2, statsY + 15, { align: 'center' });

	if (meta.participants.length) {
		pdf.setFontSize(8.5);
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
	pdf.setFontSize(7.5);
	setTexHex(pdf, theme.senderColor);
	pdf.text('FIRMA DE INTEGRIDAD CRIPTOGRÁFICA (SHA-256):', MARGIN + 6, footerBoxY + 7);

	pdf.setFont('courier', 'normal');
	pdf.setFontSize(7);
	setTexHex(pdf, theme.metaColor);
	pdf.text(meta.sourceHash || 'No disponible', MARGIN + 6, footerBoxY + 14, { maxWidth: CONTENT_W - 12 });

	pdf.setFont('helvetica', 'italic');
	pdf.setFontSize(7);
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
				const innerMaxW = CONTENT_W * 0.70 - 7;
				const textLines = (msg.text && !msg.callInfo) ? wrapText(pdf, msg.text, innerMaxW) : [];
				const textH = textLines.length * 4.2;
				const senderH = (!msg.senderRole || msg.senderRole !== 'owner') ? 4.5 : 0;
				const callH = msg.callInfo ? 9 : 0;

				let attachmentH = 0;
				if (msg.attachment) {
					const att = msg.attachment;
					if (att.kind === 'image' || att.isSticker) attachmentH = 45;
					else if (att.kind === 'video') attachmentH = 14;
					else if (att.kind === 'audio') attachmentH = 13;
					else if (att.kind === 'document') attachmentH = 12;
					else attachmentH = 7;
				}

				const estimatedH = senderH + callH + attachmentH + textH + 4.0 + 6;

				if (currentY + estimatedH > PDF_H_MM - MARGIN) {
					pdf.addPage();
					setFill(pdf, theme.pageBg);
					pdf.rect(0, 0, PDF_W_MM, PDF_H_MM, 'F');
					currentY = MARGIN + 4;
				}

				const result = await drawMessage(pdf, msg, currentY, theme);
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
		pdf.text(`Página ${p - (startPage - 1)} de ${totalPages - (startPage - 1)}`, PDF_W_MM - MARGIN, PDF_H_MM - 5, { align: 'right' });
		pdf.text(`Evidencia: ${meta.title}`, MARGIN, PDF_H_MM - 5, { align: 'left' });
	}

	if (onProgress) onProgress(100);

	const dateRangeSuffix = options?.dateFrom ? `_${options.dateFrom}_a_${options.dateTo || 'fin'}` : '';
	const fileName = `Reporte_Evidencia_${meta.title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '_')}${dateRangeSuffix}.pdf`;
	pdf.save(fileName);
}
