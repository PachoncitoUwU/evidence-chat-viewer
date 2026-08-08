<script lang="ts">
  import { X, Sun, Moon, RotateCcw } from 'lucide-svelte';
  import { chatConfig, BG_PRESETS, EMOJI_CDN, type EmojiStyle } from '$lib/stores/chatConfig';
  import type { ChatMessage } from '$types/chat.types';

  export let participants: string[] = [];
  export let onClose: () => void = () => {};

  let cfg = $chatConfig;
  $: cfg = $chatConfig;

  function setBg(value: string) {
    chatConfig.update({ chatBg: value });
  }
  function setCustomBg(e: Event) {
    chatConfig.update({ chatBg: (e.target as HTMLInputElement).value });
  }
  function setEmoji(style: EmojiStyle) {
    chatConfig.update({ emojiStyle: style });
  }
  function toggleDark() {
    chatConfig.update({ darkMode: cfg.darkMode === 'dark' ? 'light' : 'dark' });
  }

  // 😊 = U+1F60A
  const SAMPLE_EMOJI_UNIFIED = '1f60a';

  const EMOJI_STYLES: Array<{ id: EmojiStyle; label: string }> = [
    { id: 'native',    label: 'Sistema'   },
    { id: 'whatsapp',  label: 'WhatsApp'  },
    { id: 'apple',     label: 'Apple'     },
    { id: 'microsoft', label: 'Microsoft' },
    { id: 'facebook',  label: 'Facebook'  },
    { id: 'samsung',   label: 'Samsung'   },
  ];

  function getEmojiSrc(style: EmojiStyle): string | null {
    const tpl = EMOJI_CDN[style];
    if (!tpl) return null;
    return tpl.replace('{unified}', SAMPLE_EMOJI_UNIFIED);
  }
</script>

<div class="panel-backdrop" on:click|self={onClose} role="presentation">
  <aside class="panel" class:dark={cfg.darkMode === 'dark'}>
    <header class="panel-header">
      <h3>⚙️ Apariencia del chat</h3>
      <button class="close-btn" on:click={onClose} aria-label="Cerrar">
        <X size={18} />
      </button>
    </header>

    <div class="section">
      <h4>Modo de pantalla</h4>
      <button class="toggle-dark" on:click={toggleDark}>
        {#if cfg.darkMode === 'dark'}
          <Sun size={16} /> Cambiar a modo claro
        {:else}
          <Moon size={16} /> Cambiar a modo oscuro
        {/if}
      </button>
    </div>

    <div class="section">
      <h4>Fondo del chat</h4>
      <div class="bg-grid">
        {#each BG_PRESETS as preset}
          <button
            class="bg-swatch"
            class:selected={cfg.chatBg === preset.value}
            style="background:{preset.value}"
            title={preset.label}
            on:click={() => setBg(preset.value)}
          >
            {#if cfg.chatBg === preset.value}
              <span class="check">✓</span>
            {/if}
          </button>
        {/each}
      </div>
      <label class="custom-color-row">
        <span>Color personalizado:</span>
        <input type="color" value={cfg.chatBg} on:input={setCustomBg} />
        <span class="color-hex">{cfg.chatBg}</span>
      </label>
    </div>

    <div class="section">
      <h4>Color de burbujas</h4>
      <div class="bubble-colors">
        <label>
          <span>Enviados</span>
          <input type="color" value={cfg.bubbleOutColor}
            on:input={(e) => chatConfig.update({ bubbleOutColor: (e.target as HTMLInputElement).value })} />
        </label>
        <label>
          <span>Recibidos</span>
          <input type="color" value={cfg.bubbleInColor}
            on:input={(e) => chatConfig.update({ bubbleInColor: (e.target as HTMLInputElement).value })} />
        </label>
      </div>
    </div>

    <div class="section">
      <h4>Estilo de emojis</h4>
      <p class="hint">Los emojis de Apple, WhatsApp, etc. se cargan de internet.</p>
      <div class="emoji-grid">
        {#each EMOJI_STYLES as es}
          {@const src = getEmojiSrc(es.id)}
          <button
            class="emoji-opt"
            class:selected={cfg.emojiStyle === es.id}
            on:click={() => setEmoji(es.id)}
          >
            {#if src}
              <img
                class="emoji-sample-img"
                {src}
                alt="😊"
                loading="lazy"
                on:error={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  const next = img.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = 'inline';
                }}
              />
              <span class="emoji-sample-fallback" style="display:none">😊</span>
            {:else}
              <span class="emoji-sample">😊</span>
            {/if}
            <span class="emoji-label">{es.label}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if participants.length > 0}
      <div class="section">
        <h4>Nombres en el chat</h4>
        <p class="hint">Puedes cambiar cómo se muestra cada nombre.</p>
        {#each participants as p}
          <label class="alias-row">
            <span class="alias-real">{p}</span>
            <input
              type="text"
              placeholder="Apodo (opcional)"
              value={cfg.nameAliases[p] ?? ''}
              on:input={(e) => chatConfig.setAlias(p, (e.target as HTMLInputElement).value)}
            />
          </label>
        {/each}
      </div>
    {/if}

    <div class="section">
      <button class="reset-btn" on:click={chatConfig.reset}>
        <RotateCcw size={14} /> Restablecer valores por defecto
      </button>
    </div>
  </aside>
</div>

<style>
  .panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 500;
    display: flex;
    justify-content: flex-end;
  }

  .panel {
    width: 340px;
    height: 100%;
    background: #fff;
    overflow-y: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 32px rgba(0,0,0,0.15);
  }
  .panel.dark {
    background: #1a1a2e;
    color: #e0e0e0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    background: inherit;
    z-index: 1;
  }
  .dark .panel-header { border-color: rgba(255,255,255,0.1); }
  .panel-header h3 {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
  }
  .close-btn {
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    color: #667781;
    transition: background 0.15s;
  }
  .close-btn:hover { background: rgba(0,0,0,0.08); }

  .section {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .dark .section { border-color: rgba(255,255,255,0.06); }
  .section h4 {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #667781;
    margin: 0 0 12px;
  }
  .dark .section h4 { color: #8899aa; }

  .hint {
    font-size: 11px;
    color: #9ca3af;
    margin: -6px 0 10px;
  }

  .toggle-dark {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    background: #f0f2f5;
    font-size: 13px;
    font-weight: 600;
    width: 100%;
    transition: background 0.15s;
  }
  .dark .toggle-dark { background: #2a2a3e; color: #e0e0e0; }
  .toggle-dark:hover { background: #e0e3e8; }

  .bg-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .bg-swatch {
    width: 36px; height: 36px;
    border-radius: 8px;
    border: 2px solid transparent;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.1s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  }
  .bg-swatch.selected { border-color: #4f46e5; transform: scale(1.1); }
  .check { font-size: 14px; color: #4f46e5; font-weight: 700; }

  .custom-color-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .custom-color-row input[type=color] {
    width: 36px; height: 28px;
    padding: 0; border: 1px solid rgba(0,0,0,0.15);
    border-radius: 6px; cursor: pointer;
  }
  .color-hex { font-family: monospace; font-size: 12px; color: #667781; }

  .bubble-colors {
    display: flex;
    gap: 20px;
  }
  .bubble-colors label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #667781;
  }
  .bubble-colors input[type=color] {
    width: 44px; height: 36px;
    padding: 0; border: 1px solid rgba(0,0,0,0.15);
    border-radius: 8px; cursor: pointer;
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .emoji-opt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    border-radius: 8px;
    border: 2px solid transparent;
    background: #f7f8fa;
    cursor: pointer;
    transition: all 0.15s;
  }
  .dark .emoji-opt { background: #2a2a3e; }
  .emoji-opt.selected {
    border-color: #4f46e5;
    background: rgba(79,70,229,0.08);
  }
  .emoji-sample { line-height: 1; font-size: 20px; }
  .emoji-sample-img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }
  .emoji-sample-fallback { font-size: 20px; line-height: 1; }
  .emoji-label { font-size: 10px; color: #667781; }

  .alias-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 13px;
  }
  .alias-real {
    min-width: 90px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .alias-row input {
    flex: 1;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid rgba(0,0,0,0.15);
    font-size: 13px;
    outline: none;
    background: #f7f8fa;
  }
  .dark .alias-row input { background: #2a2a3e; color: #e0e0e0; border-color: rgba(255,255,255,0.1); }
  .alias-row input:focus { border-color: #4f46e5; }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    color: #dc2626;
    background: rgba(220,38,38,0.08);
    transition: background 0.15s;
  }
  .reset-btn:hover { background: rgba(220,38,38,0.14); }
</style>
