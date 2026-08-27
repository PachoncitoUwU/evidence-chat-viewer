<script lang="ts">
	import {
		FileWarning, FileText, Play, Pause, Download, Mic, Copy, Check,
		PhoneMissed, PhoneIncoming, PhoneOff, Video, VideoOff, Eye, EyeOff
	} from 'lucide-svelte';
	import type { ChatMessage } from '$types/chat.types';
	import Lightbox from './Lightbox.svelte';
	import VideoModal from './VideoModal.svelte';
	import { renderEmojiHtml } from '$lib/emojiRenderer';
	import type { EmojiStyle } from '$lib/stores/chatConfig';
	import { hiddenMediaStore } from '$lib/stores/hiddenMediaStore';

	export let message: ChatMessage;
	export let darkMode: boolean = false;
	export let bubbleOutColor: string = '';
	export let bubbleInColor: string = '';
	export let emojiStyle: EmojiStyle = 'native';
	export let isGroup: boolean = false;

	$: isOwner = message.senderRole === 'owner';
	$: time = message.time.slice(0, 5);

	// Detectar si el mensaje es "fantasma" (sin texto ni adjunto o con multimedia omitido)
	$: isGhost = !message.text && (!message.attachment || message.attachment.status === 'omitted') && !message.callInfo;

	// State de copia a portapapeles
	let copied = false;
	function copyCitation() {
		const citation = `[${message.date} ${message.time}] ${message.senderName}: "${message.text || (message.attachment?.fileName ? `[Archivo: ${message.attachment.fileName}]` : message.callInfo ? `[${message.callInfo.status === 'missed' ? 'Llamada perdida' : 'Llamada'}]` : '[Multimedia]')}"`;
		navigator.clipboard.writeText(citation);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	// ── Audio player state ──
	let audioEl: HTMLAudioElement | null = null;
	let isPlaying = false;
	let audioDuration = 0;
	let audioCurrentTime = 0;
	let audioProgress = 0;

	function formatDuration(sec: number): string {
		if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function togglePlay() {
		if (!audioEl) return;
		if (isPlaying) {
			audioEl.pause();
		} else {
			audioEl.play();
		}
	}

	function onAudioLoaded() {
		if (audioEl) audioDuration = audioEl.duration;
	}

	function onTimeUpdate() {
		if (audioEl) {
			audioCurrentTime = audioEl.currentTime;
			audioProgress = audioDuration > 0 ? (audioEl.currentTime / audioDuration) * 100 : 0;
		}
	}

	function onAudioEnded() {
		isPlaying = false;
		audioCurrentTime = 0;
		audioProgress = 0;
	}

	function seekAudio(e: MouseEvent) {
		if (!audioEl || !audioDuration) return;
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		audioEl.currentTime = ratio * audioDuration;
	}

	// ── Lightbox / Video modal ──
	let lightboxOpen = false;
	let videoModalOpen = false;

	function downloadFile(url: string, name: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
	}

	// Dynamic bubble colors (WhatsApp Official Light & Dark defaults)
	$: outBg = bubbleOutColor || (darkMode ? '#005c4b' : '#d9fdd3');
	$: inBg = bubbleInColor || (darkMode ? '#1f2c33' : '#ffffff');
	$: textColor = darkMode ? '#e9edef' : '#111b21';
	$: metaColor = darkMode ? '#8696a0' : '#667781';
	$: senderColor = isOwner ? '#00a884' : (darkMode ? '#00a884' : '#0284c7');

	function renderMessageWithLinks(text: string, style: EmojiStyle): string {
		if (!text) return '';
		const html = renderEmojiHtml(text, style);
		const urlRegex = /(https?:\/\/[^\s<"']+|www\.[^\s<"']+)/gi;
		return html.replace(urlRegex, (match, url, offset, fullString) => {
			const before = fullString.slice(0, offset);
			if (/="[^"]*$/.test(before) || /='[^']*$/.test(before)) {
				return match;
			}
			const href = url.startsWith('http') ? url : `https://${url}`;
			return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-link" onclick="event.stopPropagation()">${url}</a>`;
		});
	}

	$: messageHtml = renderMessageWithLinks(message.text || '', emojiStyle);
</script>

{#if lightboxOpen && message.attachment?.previewUrl}
	<Lightbox
		src={message.attachment.previewUrl}
		fileName={message.attachment.fileName}
		onClose={() => (lightboxOpen = false)}
	/>
{/if}

{#if videoModalOpen && message.attachment?.previewUrl}
	<VideoModal
		src={message.attachment.previewUrl}
		fileName={message.attachment.fileName}
		onClose={() => (videoModalOpen = false)}
	/>
{/if}

<div class="row" class:is-owner={isOwner}>
	{#if message.isSystemEvent}
		<div class="system-pill" class:dark={darkMode}>{message.text}</div>
	{:else}
		{#if isGroup && !isOwner}
			<span class="sender-name" style="color:{senderColor}">{message.senderName}</span>
		{/if}

		{@const att = message.attachment}
		{@const call = message.callInfo}

		<!-- Stickers -->
		{#if att?.isSticker && (att.status === 'linked') && att.previewUrl}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="sticker-wrap" on:click={() => (lightboxOpen = true)}>
				<img src={att.previewUrl} alt="Sticker" class="sticker-img" loading="lazy" />
				<div class="sticker-actions">
					<button
						class="sticker-dl-btn"
						on:click|stopPropagation={() => downloadFile(att.previewUrl!, att.fileName)}
						title="Descargar sticker"
					>
						<Download size={13} color="white" />
					</button>
					<button
						class="sticker-dl-btn"
						on:click|stopPropagation={() => hiddenMediaStore.toggle(message.id)}
						title="Ocultar sticker del chat y del PDF"
					>
						<Eye size={13} color="white" />
					</button>
					<span class="sticker-time" style="color:{metaColor}">{time}</span>
				</div>
			</div>

		<!-- GIFs animados -->
		{:else if att?.kind === 'image' && att.fileName.toLowerCase().endsWith('.gif') && att.status === 'linked' && att.previewUrl}
			<div class="gif-wrap">
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
				<img
					src={att.previewUrl}
					alt={att.fileName}
					class="gif-img"
					loading="lazy"
					on:click={() => (lightboxOpen = true)}
				/>
				<div class="gif-overlay">
					<span class="gif-time" style="color:{metaColor}">{time}</span>
					<div style="display:flex; gap:4px;">
						<button
							class="gif-dl-btn"
							on:click|stopPropagation={() => downloadFile(att.previewUrl!, att.fileName)}
							title="Descargar"
						>
							<Download size={14} color="white" />
						</button>
						<button
							class="gif-dl-btn"
							on:click|stopPropagation={() => hiddenMediaStore.toggle(message.id)}
							title="Ocultar GIF del chat y del PDF"
						>
							<Eye size={14} color="white" />
						</button>
					</div>
				</div>
			</div>

		{:else}
			<div
				class="bubble"
				class:is-owner={isOwner}
				class:dark={darkMode}
				class:has-image-only={att?.kind === 'image' && !message.text}
				style="
					background: {isOwner ? outBg : inBg};
					color: {textColor};
					--bubble-bg: {isOwner ? outBg : inBg};
				"
			>
				<!-- Acciones flotantes del mensaje (Copiar Cita y Ocultar con Ojito 👁️) -->
				<div class="msg-actions-hover">
					<button class="action-btn" on:click={copyCitation} title="Copiar cita pericial">
						{#if copied}
							<Check size={12} color="#00a884" />
						{:else}
							<Copy size={12} color={metaColor} />
						{/if}
					</button>
					<button
						class="action-btn"
						on:click={() => hiddenMediaStore.toggle(message.id)}
						title="Ocultar del chat y del PDF (Ojito)"
					>
						<Eye size={12} color={metaColor} />
					</button>
				</div>

				<!-- Registro de Llamada de WhatsApp -->
				{#if call}
					<div class="call-card" class:missed={call.status === 'missed' || call.status === 'declined'}>
						<div class="call-icon-box">
							{#if call.status === 'missed' || call.status === 'declined'}
								{#if call.type === 'video'}
									<VideoOff size={18} color="#dc2626" />
								{:else}
									<PhoneMissed size={18} color="#dc2626" />
								{/if}
							{:else}
								{#if call.type === 'video'}
									<Video size={18} color="#00a884" />
								{:else}
									<PhoneIncoming size={18} color="#00a884" />
								{/if}
							{/if}
						</div>
						<div class="call-info">
							<span class="call-title">
								{#if call.status === 'missed'}
									{call.type === 'video' ? 'Videollamada perdida' : 'Llamada de voz perdida'}
								{:else if call.status === 'declined'}
									{call.type === 'video' ? 'Videollamada rechazada' : 'Llamada rechazada'}
								{:else}
									{call.type === 'video' ? 'Videollamada' : 'Llamada de voz'} {call.duration ? `(${call.duration})` : ''}
								{/if}
							</span>
							<span class="call-sub">{time}</span>
						</div>
					</div>
				{/if}

				<!-- Adjunto multimedia -->
				{#if att}
					{#if att.status === 'omitted'}
						<p class="att-omitted" style="color:{metaColor}">📷 Multimedia omitido</p>

					{:else if att.status === 'missing'}
						<div class="att-missing">
							<FileWarning size={14} />
							<span>{att.fileName || 'Adjunto no encontrado'}</span>
						</div>

					{:else if att.kind === 'image' && att.previewUrl}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div class="att-image-wrap" on:click={() => (lightboxOpen = true)}>
							<img src={att.previewUrl} alt={att.fileName} class="att-image" loading="lazy" />
							<div class="img-hover-overlay">
								<button
									class="img-dl-btn"
									on:click|stopPropagation={() => downloadFile(att.previewUrl!, att.fileName)}
									title="Descargar imagen"
								>
									<Download size={16} color="white" />
								</button>
								<button
									class="img-hide-btn"
									on:click|stopPropagation={() => hiddenMediaStore.hide(message.id)}
									title="Ocultar imagen del chat y del PDF"
								>
									<Eye size={16} color="white" />
								</button>
							</div>
						</div>

					{:else if att.kind === 'image' && !att.previewUrl}
						<div class="att-placeholder" class:dark={darkMode}>
							<FileText size={18} />
							<span>{att.fileName}</span>
						</div>

					{:else if att.kind === 'video'}
						{#if att.previewUrl}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="att-video-thumb" on:click={() => (videoModalOpen = true)}>
								<div class="play-circle">
									<Play size={20} fill="white" color="white" />
								</div>
								<span class="att-vid-label">{att.fileName}</span>
								<button
									class="vid-dl-btn"
									on:click|stopPropagation={() => downloadFile(att.previewUrl!, att.fileName)}
									title="Descargar"
								>
									<Download size={14} color="white" />
								</button>
							</div>
						{:else}
							<div class="att-video-thumb">
								<div class="play-circle"><Play size={20} fill="white" color="white" /></div>
								<span class="att-vid-label">{att.fileName}</span>
							</div>
						{/if}

					<!-- Tarjeta de Audio rediseñada para coincidir exactamente con WhatsApp -->
					{:else if att.kind === 'audio'}
						{#if att.previewUrl}
							<audio
								bind:this={audioEl}
								src={att.previewUrl}
								preload="metadata"
								on:loadedmetadata={onAudioLoaded}
								on:timeupdate={onTimeUpdate}
								on:ended={onAudioEnded}
								on:play={() => (isPlaying = true)}
								on:pause={() => (isPlaying = false)}
								style="display:none"
							></audio>

							<div class="att-audio-card" class:is-owner={isOwner} class:dark={darkMode}>
								<!-- Badge de micrófono -->
								<div class="mic-badge" class:dark={darkMode}>
									<Mic size={17} color={darkMode ? '#00a884' : '#54656f'} />
								</div>

								<!-- Botón Play/Pause -->
								<button class="play-btn" class:dark={darkMode} on:click={togglePlay} aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
									{#if isPlaying}
										<Pause size={18} fill={darkMode ? '#ffffff' : '#00a884'} color={darkMode ? '#ffffff' : '#00a884'} />
									{:else}
										<Play size={18} fill={darkMode ? '#ffffff' : '#00a884'} color={darkMode ? '#ffffff' : '#00a884'} style="margin-left: 2px;" />
									{/if}
								</button>

								<!-- Onda sonora y barra de búsqueda -->
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div class="waveform-box">
									<div class="waveform-bars" class:playing={isPlaying} on:click={seekAudio}>
										{#each Array(22) as _, i}
											<span
												class="w-bar"
												style="
													height: {8 + Math.sin(i * 0.95 + 0.4) * 11}px;
													opacity: {audioProgress > (i / 22) * 100 ? 1 : 0.4};
													background: {darkMode ? '#00a884' : (audioProgress > (i / 22) * 100 ? '#00a884' : '#8696a0')};
												"
											></span>
										{/each}
									</div>
									<div class="seek-track" class:dark={darkMode} on:click={seekAudio}>
										<div
											class="seek-fill-bar"
											style="
												width:{audioProgress}%;
												background:#00a884;
											"
										></div>
									</div>
									<div class="timer-row">
										<span class="audio-timer-text" style="color:{metaColor}">
											{isPlaying || audioCurrentTime > 0
												? formatDuration(audioCurrentTime)
												: formatDuration(audioDuration)}
										</span>
									</div>
								</div>

								<!-- Botón descargar -->
								<button
									class="dl-btn"
									class:dark={darkMode}
									on:click={() => downloadFile(att.previewUrl!, att.fileName)}
									title="Descargar audio"
								>
									<Download size={14} color={metaColor} />
								</button>
							</div>
						{:else}
							<div class="att-placeholder" class:dark={darkMode}>
								<Mic size={18} />
								<span>{att.fileName}</span>
							</div>
						{/if}

					{:else if att.kind === 'document'}
						<div class="att-doc" class:dark={darkMode}>
							<div class="doc-icon">
								<FileText size={22} color="#4f46e5" />
							</div>
							<div class="doc-info">
								<span class="doc-name" style="color:{textColor}">{att.fileName}</span>
								{#if att.sizeBytes}
									<span class="doc-size" style="color:{metaColor}">
										{(att.sizeBytes / 1024).toFixed(1)} KB
									</span>
								{/if}
							</div>
							{#if att.previewUrl}
								<button
									class="dl-btn"
									class:dark={darkMode}
									on:click={() => downloadFile(att.previewUrl!, att.fileName)}
									title="Descargar"
								>
									<Download size={16} color={metaColor} />
								</button>
							{/if}
						</div>
					{/if}
				{/if}

				<!-- Texto principal -->
				{#if message.text && !call}
					<p class="bubble-text" style="color:{textColor}">{@html messageHtml}</p>
				{:else if isGhost}
					<p class="ghost-placeholder">🚫 Mensaje sin contenido visible</p>
				{/if}

				<!-- Fila de metadatos (hora + vistos azules) -->
				<div class="meta-row">
					{#if message.wasEdited}
						<span class="edited" style="color:{metaColor}">editado</span>
					{/if}
					<span class="time-stamp" style="color:{metaColor}">{time}</span>
					{#if isOwner}
						<svg width="16" height="11" viewBox="0 0 16 11" fill="none">
							<path d="M11.071.653 5.745 7.74 3.27 5.3l-.97.97L5.806 9.71l.002.002.969-.97 5.296-6.12-.002-.002.97-.968L11.07.653z" fill="#53bdeb"/>
							<path d="M15.071.653 9.745 7.74 7.27 5.3l-.97.97L9.806 9.71l.002.002.969-.97 5.296-6.12-.002-.002.97-.968L15.07.653z" fill="#53bdeb"/>
						</svg>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 88%;
		margin-bottom: 3px;
		position: relative;
	}
	.row.is-owner {
		align-items: flex-end;
		align-self: flex-end;
	}

	.system-pill {
		align-self: center;
		background: rgba(225, 230, 227, 0.92);
		border-radius: 999px;
		padding: 5px 14px;
		font-size: 11.5px;
		color: #54656f;
		margin: 8px 0;
		text-align: center;
		max-width: 420px;
		font-family: system-ui, sans-serif;
		box-shadow: 0 1px 2px rgba(0,0,0,0.06);
	}
	.system-pill.dark {
		background: rgba(11, 20, 26, 0.55);
		color: #e9edef;
		box-shadow: none;
	}

	.sender-name {
		font-size: 12px;
		font-weight: 700;
		margin-bottom: 2px;
		margin-left: 8px;
	}

	/* ── Sticker ── */
	.sticker-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		cursor: pointer;
	}
	.sticker-img {
		width: 150px;
		height: 150px;
		object-fit: contain;
	}
	.sticker-time {
		font-size: 11px;
		margin-right: 4px;
	}
	.sticker-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.sticker-dl-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0,0,0,0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border: none;
		padding: 0;
	}

	/* ── GIF ── */
	.gif-wrap {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		max-width: 280px;
	}
	.gif-img {
		width: 100%;
		height: auto;
		max-height: 320px;
		object-fit: contain;
		display: block;
		background: #1c1c1c;
	}
	.gif-overlay {
		position: absolute; bottom: 0; left: 0; right: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
		display: flex; justify-content: space-between; align-items: flex-end;
		padding: 6px 8px; opacity: 0; transition: opacity 0.2s;
	}
	.gif-wrap:hover .gif-overlay { opacity: 1; }
	.gif-time { font-size: 11px; color: white; }
	.gif-dl-btn {
		width: 26px; height: 26px; border-radius: 50%;
		background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
		border: none; cursor: pointer;
	}

	/* ── Burbujas y Colas ── */
	.bubble {
		position: relative;
		border-radius: 8px;
		padding: 6px 10px 4px 10px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		box-shadow: 0 1px 2px rgba(0,0,0,0.12);
		max-width: 100%;
		min-width: 86px;
	}
	.bubble.dark {
		box-shadow: 0 1px 2px rgba(0,0,0,0.22);
	}
	.bubble:not(.is-owner) {
		border-top-left-radius: 0px;
	}
	.bubble.is-owner {
		border-top-right-radius: 0px;
	}

	/* Cola para mensaje entrante (izquierda) */
	.bubble:not(.is-owner)::before {
		content: '';
		position: absolute;
		top: 0;
		left: -8px;
		width: 0;
		height: 0;
		border-style: solid;
		border-width: 0 8px 10px 0;
		border-color: transparent var(--bubble-bg, #ffffff) transparent transparent;
	}

	/* Cola para mensaje saliente (derecha) */
	.bubble.is-owner::after {
		content: '';
		position: absolute;
		top: 0;
		right: -8px;
		width: 0;
		height: 0;
		border-style: solid;
		border-width: 0 0 10px 8px;
		border-color: transparent transparent transparent var(--bubble-bg, #d9fdd3);
	}

	.bubble.has-image-only {
		padding: 3px;
		width: fit-content;
		max-width: 366px;
	}

	.msg-actions-hover {
		position: absolute;
		top: 4px;
		right: 6px;
		display: flex;
		align-items: center;
		gap: 3px;
		opacity: 0;
		transition: opacity 0.15s;
		z-index: 5;
	}
	.bubble:hover .msg-actions-hover {
		opacity: 1;
	}
	.action-btn {
		background: rgba(0,0,0,0.08);
		border: none;
		border-radius: 4px;
		padding: 2px 5px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bubble.dark .action-btn {
		background: rgba(255,255,255,0.12);
	}
	.action-btn:hover {
		background: rgba(0,0,0,0.18);
	}

	/* ── Tarjeta de Llamadas ── */
	.call-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 6px;
		min-width: 180px;
	}
	.call-icon-box {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: rgba(0,0,0,0.05);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.call-card.missed .call-icon-box {
		background: rgba(220, 38, 38, 0.08);
	}
	.call-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.call-title {
		font-size: 13.5px;
		font-weight: 600;
		color: #111b21;
	}
	.call-card.missed .call-title {
		color: #dc2626;
	}
	.call-sub {
		font-size: 11px;
		color: #667781;
	}

	/* ── Texto de la burbuja ── */
	.bubble-text {
		font-size: 14px;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}

	.ghost-placeholder {
		font-size: 12px;
		font-style: italic;
		opacity: 0.6;
		margin: 2px 0;
	}

	/* ── Meta row ── */
	.meta-row {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 4px;
		margin-top: 1px;
	}
	.time-stamp {
		font-size: 11px;
		line-height: 1;
	}
	.edited {
		font-size: 10.5px;
		font-style: italic;
	}

	/* ── Imagen adjunta ── */
	.att-image-wrap {
		position: relative;
		display: block;
		cursor: pointer;
		border-radius: 6px;
		overflow: hidden;
		max-width: 100%;
	}
	.att-image {
		display: block;
		max-width: 360px;
		max-height: 360px;
		width: 100%;
		height: auto;
		object-fit: cover;
		border-radius: 6px;
		cursor: zoom-in;
	}
	.img-hover-overlay {
		position: absolute; inset: 0; background: rgba(0,0,0,0);
		display: flex; align-items: flex-end; justify-content: flex-end; padding: 6px; gap: 6px;
		transition: background 0.15s; pointer-events: none;
	}
	.att-image-wrap:hover .img-hover-overlay { background: rgba(0,0,0,0.3); }
	.img-dl-btn, .img-hide-btn {
		opacity: 0; background: rgba(0,0,0,0.6); border-radius: 50%;
		width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
		pointer-events: auto; cursor: pointer; border: none; transition: opacity 0.15s, transform 0.15s;
	}
	.img-dl-btn:hover, .img-hide-btn:hover {
		transform: scale(1.1);
		background: rgba(0,0,0,0.85);
	}
	.att-image-wrap:hover .img-dl-btn, .att-image-wrap:hover .img-hide-btn { opacity: 1; }

	/* ── Video thumb ── */
	.att-video-thumb {
		width: 250px; height: 140px; background: #1c1c1c; border-radius: 6px;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 6px; cursor: pointer; position: relative; overflow: hidden;
	}
	.play-circle {
		width: 44px; height: 44px; background: rgba(255,255,255,0.25);
		border-radius: 50%; display: flex; align-items: center; justify-content: center;
		border: 2px solid white;
	}
	.att-vid-label { font-size: 11px; color: white; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.vid-dl-btn {
		position: absolute; bottom: 6px; right: 6px; width: 28px; height: 28px;
		background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;
	}

	/* ── Tarjeta de Audio WhatsApp (Exacta a Imagen 2) ── */
	.att-audio-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		width: 100%;
		min-width: 250px;
		max-width: 380px;
		box-sizing: border-box;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.04);
	}
	.att-audio-card.dark {
		background: rgba(255, 255, 255, 0.06);
	}
	.att-audio-card.is-owner {
		background: rgba(0, 0, 0, 0.05);
	}

	.mic-badge {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.mic-badge.dark {
		background: rgba(255, 255, 255, 0.12);
	}

	.play-btn {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #9bbd9c;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: none;
		cursor: pointer;
		transition: background 0.15s;
	}
	.play-btn.dark {
		background: rgba(255, 255, 255, 0.2);
	}
	.play-btn:hover {
		filter: brightness(0.92);
	}

	.waveform-box {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.waveform-bars {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 20px;
		cursor: pointer;
	}
	.w-bar {
		width: 3px;
		border-radius: 2px;
		flex-shrink: 0;
		transition: opacity 0.15s, background 0.15s;
	}
	@keyframes pulseBar {
		0%, 100% { transform: scaleY(0.5); }
		50% { transform: scaleY(1.1); }
	}
	.waveform-bars.playing .w-bar:nth-child(odd) {
		animation: pulseBar 0.6s ease-in-out infinite;
	}
	.waveform-bars.playing .w-bar:nth-child(even) {
		animation: pulseBar 0.8s ease-in-out infinite 0.15s;
	}

	.seek-track {
		height: 3px;
		background: rgba(0,0,0,0.12);
		border-radius: 2px;
		cursor: pointer;
		overflow: hidden;
	}
	.seek-track.dark {
		background: rgba(255,255,255,0.15);
	}
	.seek-fill-bar {
		height: 100%;
		border-radius: 2px;
		transition: width 0.1s linear;
	}

	.timer-row {
		display: flex;
		justify-content: flex-end;
	}
	.audio-timer-text {
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}

	/* ── Document ── */
	.att-doc {
		display: flex; align-items: center; gap: 10px;
		background: rgba(0,0,0,0.04); border-radius: 8px;
		padding: 8px 10px; min-width: 200px; max-width: 280px;
	}
	.att-doc.dark { background: rgba(255,255,255,0.06); }
	.doc-icon { flex-shrink: 0; }
	.doc-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
	.doc-name { font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.doc-size { font-size: 10.5px; }

	.att-missing {
		display: flex; align-items: center; gap: 8px;
		background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220,38,38,0.25);
		border-radius: 6px; padding: 6px 8px; font-size: 11.5px; color: #dc2626;
	}
	.att-omitted { font-size: 11.5px; font-style: italic; margin: 0; }
	.att-placeholder {
		display: flex; align-items: center; gap: 8px; font-size: 12px;
		background: rgba(0,0,0,0.04); border-radius: 6px; padding: 6px 8px;
	}
	.att-placeholder.dark { background: rgba(255,255,255,0.06); }

	.dl-btn {
		width: 28px; height: 28px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		background: rgba(0,0,0,0.06); border: none; cursor: pointer; flex-shrink: 0;
	}
	.dl-btn.dark { background: rgba(255,255,255,0.1); }
	.dl-btn:hover { background: rgba(0,0,0,0.12); }

	:global(.chat-link) { color: #0284c7; text-decoration: underline; word-break: break-all; }
	:global([data-theme="dark"] .chat-link) { color: #53bdeb; }

	:global(.emoji-img) {
		width: 1.25em;
		height: 1.25em;
		vertical-align: -0.2em;
		display: inline-block;
		margin: 0 0.1em;
	}
</style>
