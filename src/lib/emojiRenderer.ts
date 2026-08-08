/**
 * emojiRenderer.ts
 * ------------------------------------------------------------------
 * Convierte texto con emojis Unicode en HTML con <img> para
 * los estilos Apple, WhatsApp, Microsoft, Facebook, Samsung.
 * Para el estilo 'native' devuelve el texto tal cual (sin cambios).
 *
 * Los CDN de emoji-datasource usan el "unified" code point en formato
 * hexadecimal mayúsculas, sin el prefijo U+.
 * Ej: 😊 → 1F60A, ❤️ → 2764-FE0F (o 2764 si el CDN no tiene el variante)
 * ------------------------------------------------------------------
 */

import { EMOJI_CDN } from './stores/chatConfig';
import type { EmojiStyle } from './stores/chatConfig';

// Regex que captura la mayoría de secuencias de emojis Unicode:
// - Emojis básicos (U+1F000–U+1FFFF)
// - Variantes (U+FE0F)
// - ZWJ sequences (👨‍👩‍👧)
// - Keycap sequences (#️⃣)
// - Regional indicators (banderas 🇪🇸)
// - Símbolos misceláneos (☀️ ❤️ etc.)
const EMOJI_RE = /(\u{1F1E0}-\u{1F1FF}\u{1F1E0}-\u{1F1FF}|(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*\uFE0F?)/gu;

/**
 * Convierte un emoji (string) a su código "unified" para emoji-datasource.
 * Ej: "😊" → "1F60A", "❤️" → "2764-FE0F", "👨‍👩‍👧‍👦" → "1F468-200D-1F469-200D-1F467-200D-1F466"
 */
function toUnified(emoji: string): string {
  return [...emoji]
    .map(ch => ch.codePointAt(0)!.toString(16).toUpperCase())
    .join('-');
}

/**
 * Escapa HTML para uso seguro en texto
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reemplaza emojis en `text` con <img> tags del CDN configurado.
 * Devuelve HTML string.
 *
 * Si emojiStyle === 'native' o el CDN template es null, devuelve
 * el texto escapado sin modificar.
 */
export function renderEmojiHtml(text: string, emojiStyle: EmojiStyle): string {
  const cdnTemplate = EMOJI_CDN[emojiStyle];

  if (!cdnTemplate) {
    // Native: devolver texto plano escapado
    return escapeHtml(text);
  }

  const result: string[] = [];
  let lastIndex = 0;

  // Usamos matchAll con la regex global
  for (const match of text.matchAll(EMOJI_RE)) {
    const start = match.index!;
    const end = start + match[0].length;

    // Texto antes del emoji
    if (start > lastIndex) {
      result.push(escapeHtml(text.slice(lastIndex, start)));
    }

    const unified = toUnified(match[0]);
    const src = cdnTemplate.replace('{unified}', unified.toLowerCase());
    const fallbackSrc = src.replace('-fe0f', '');

    result.push(
      `<img class="emoji-img" src="${src}" alt="${escapeHtml(match[0])}" title="${escapeHtml(match[0])}" loading="lazy" onerror="if(this.dataset.fallback){this.style.display='none';this.insertAdjacentText('afterend','${escapeHtml(match[0])}');}else{this.dataset.fallback='1';this.src='${fallbackSrc}';}" />`
    );

    lastIndex = end;
  }

  // Texto restante
  if (lastIndex < text.length) {
    result.push(escapeHtml(text.slice(lastIndex)));
  }

  return result.join('');
}

/**
 * Versión que devuelve nodos DOM (útil para Svelte @html)
 */
export function renderEmojiToHtml(text: string, emojiStyle: EmojiStyle): string {
  return renderEmojiHtml(text, emojiStyle);
}
