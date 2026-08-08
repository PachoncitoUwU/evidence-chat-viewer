/**
 * chatConfig.ts — Store reactivo de configuración del chat
 * Persiste en localStorage para sobrevivir recargas.
 */

import { writable } from 'svelte/store';

export type EmojiStyle = 'whatsapp' | 'apple' | 'microsoft' | 'facebook' | 'samsung' | 'native';
export type DarkMode = 'light' | 'dark';
export type ChatBgPreset = 'default' | 'dark' | 'solid' | 'custom';

export interface ChatConfig {
  darkMode: DarkMode;
  chatBg: string;           // color CSS o URL
  chatBgPreset: ChatBgPreset;
  bubbleOutColor: string;   // color burbuja enviada
  bubbleInColor: string;    // color burbuja recibida
  emojiStyle: EmojiStyle;
  // Apodos por nombre real → nombre a mostrar
  nameAliases: Record<string, string>;
}

const STORAGE_KEY = 'chatviewer-config';

const DEFAULTS: ChatConfig = {
  darkMode: 'light',
  chatBg: '#e8ede9',
  chatBgPreset: 'default',
  bubbleOutColor: '#d9fdd3',
  bubbleInColor: '#ffffff',
  emojiStyle: 'native',
  nameAliases: {}
};

function loadFromStorage(): ChatConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { ...DEFAULTS };
}

function createChatConfigStore() {
  const { subscribe, set, update } = writable<ChatConfig>(DEFAULTS);

  return {
    subscribe,
    init() {
      set(loadFromStorage());
    },
    update(partial: Partial<ChatConfig>) {
      update(cfg => {
        const next = { ...cfg, ...partial };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
        return next;
      });
    },
    setAlias(realName: string, alias: string) {
      update(cfg => {
        const aliases = { ...cfg.nameAliases };
        if (alias.trim()) aliases[realName] = alias.trim();
        else delete aliases[realName];
        const next = { ...cfg, nameAliases: aliases };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
        return next;
      });
    },
    reset() {
      set({ ...DEFAULTS });
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }
  };
}

export const chatConfig = createChatConfigStore();

// Presets de fondo
export const BG_PRESETS: Array<{ id: ChatBgPreset | string; label: string; value: string }> = [
  { id: 'default',  label: 'Verde WhatsApp', value: '#e8ede9' },
  { id: 'dark',     label: 'Oscuro',         value: '#0d1117' },
  { id: 'blue',     label: 'Azul suave',     value: '#dde8f0' },
  { id: 'warm',     label: 'Cálido',         value: '#f5ede0' },
  { id: 'purple',   label: 'Morado',         value: '#ede0f5' },
  { id: 'solid',    label: 'Blanco',         value: '#ffffff' },
];

// CDN de emojis (Twemoji = Twitter/WhatsApp-like, Noto = Android/Google, etc.)
export const EMOJI_CDN: Record<EmojiStyle, string | null> = {
  native:    null,
  whatsapp:  'https://cdn.jsdelivr.net/npm/emoji-datasource-whatsapp@15/img/whatsapp/64/{unified}.png',
  apple:     'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15/img/apple/64/{unified}.png',
  microsoft: 'https://cdn.jsdelivr.net/npm/emoji-datasource-microsoft@15/img/microsoft/64/{unified}.png',
  facebook:  'https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@15/img/facebook/64/{unified}.png',
  samsung:   'https://cdn.jsdelivr.net/npm/emoji-datasource-samsung@15/img/samsung/64/{unified}.png',
};
