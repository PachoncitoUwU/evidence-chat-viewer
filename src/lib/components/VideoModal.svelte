<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { X, Download } from 'lucide-svelte';

	export let src: string;
	export let fileName: string = '';
	export let onClose: () => void = () => {};

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function handleDownload() {
		const a = document.createElement('a');
		a.href = src;
		a.download = fileName || 'video';
		a.click();
	}

	let videoError = false;
	let errorMessage = '';

	function handleVideoError(e: Event) {
		console.warn('Error al reproducir video:', e);
		videoError = true;
		errorMessage = 'El formato o códec de este video no puede ser reproducido de forma nativa por el navegador. Puedes descargarlo con el botón de abajo para verlo en tu computador.';
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		document.body.style.overflow = 'hidden';
	});
	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		document.body.style.overflow = '';
	});
</script>

<div
	class="backdrop"
	role="dialog"
	aria-modal="true"
	aria-label="Reproductor de video"
	tabindex="-1"
	on:click|self={onClose}
	on:keydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="toolbar">
		{#if fileName}
			<span class="filename">{fileName}</span>
		{/if}
		<div class="actions">
			<button class="icon-btn" on:click={handleDownload} title="Descargar video">
				<Download size={20} color="white" />
			</button>
			<button class="icon-btn" on:click={onClose} title="Cerrar (Esc)">
				<X size={22} color="white" />
			</button>
		</div>
	</div>

	<div class="video-wrap">
		{#if videoError}
			<div class="error-box">
				<p class="error-msg">⚠️ {errorMessage}</p>
				<button class="download-fallback-btn" on:click={handleDownload}>
					<Download size={18} /> Descargar {fileName || 'Video'}
				</button>
			</div>
		{:else}
			<!-- svelte-ignore a11y-media-has-caption -->
			<video
				{src}
				controls
				autoplay
				playsinline
				class="video-player"
				on:error={handleVideoError}
			>
				<source {src} type="video/mp4" />
				<source {src} type="video/webm" />
				<source {src} type="video/quicktime" />
				<source {src} type="video/3gpp" />
				Tu navegador no soporta la reproducción directa de este video.
			</video>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.95);
		z-index: 9000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.15s ease;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	.toolbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
		z-index: 1;
	}

	.filename {
		color: rgba(255,255,255,0.85);
		font-size: 13px;
		font-family: system-ui, sans-serif;
		max-width: 60%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(255,255,255,0.12);
		transition: background 0.15s;
	}
	.icon-btn:hover {
		background: rgba(255,255,255,0.22);
	}

	.video-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 56px 16px 16px;
		max-width: 100vw;
		max-height: 100vh;
	}

	.video-player {
		max-width: 90vw;
		max-height: calc(100vh - 80px);
		border-radius: 8px;
		background: #000;
		outline: none;
	}

	.error-box {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 24px 32px;
		max-width: 440px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}
	.error-msg {
		color: #e9edef;
		font-size: 14px;
		line-height: 1.5;
		margin: 0;
	}
	.download-fallback-btn {
		background: #00a884;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 10px 18px;
		font-size: 13.5px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: background 0.15s;
	}
	.download-fallback-btn:hover {
		background: #008f70;
	}
</style>
