<script lang="ts">
	import { UploadCloud } from 'lucide-svelte';

	export let onFilesDropped: (files: FileList) => void = () => {};

	let isDragging = false;
	let zoneEl: HTMLDivElement;

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}
	function handleDragLeave() {
		isDragging = false;
	}
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files?.length) {
			onFilesDropped(e.dataTransfer.files);
		}
	}
	function handleInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files?.length) {
			onFilesDropped(input.files);
		}
	}
</script>

<div
	class="dropzone"
	class:is-dragging={isDragging}
	bind:this={zoneEl}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
	role="button"
	tabindex="0"
>
	<div class="icon-wrap">
		<UploadCloud size={32} strokeWidth={1.5} color="var(--brass)" />
	</div>

	<p class="main-text">Sube tu exportación de WhatsApp</p>
	<p class="sub-text">Arrastra aquí el archivo <strong>.zip</strong> (con fotos, videos, audios y archivos) o el <strong>.txt</strong></p>

	<label class="browse-btn">
		<span>Elegir archivo</span>
		<input type="file" accept=".zip,.txt" hidden on:change={handleInputChange} />
	</label>

	<p class="hint">Tu chat no se sube a ningún servidor. Todo se procesa en tu navegador.</p>
</div>

<style>
	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-7) var(--space-6);
		border: 2px dashed var(--hairline-strong);
		border-radius: var(--radius-lg);
		background: white;
		text-align: center;
		cursor: pointer;
		transition: border-color var(--dur-fast) var(--ease-out-quad),
		            background var(--dur-fast) var(--ease-out-quad),
		            box-shadow var(--dur-fast) var(--ease-out-quad);
		box-shadow: var(--shadow-panel);
	}
	.dropzone:hover,
	.dropzone.is-dragging {
		border-color: var(--brass);
		background: var(--brass-dim);
		box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1), var(--shadow-panel);
	}

	.icon-wrap {
		width: 64px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--brass-dim);
		border-radius: 50%;
		margin-bottom: var(--space-1);
	}

	.main-text {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--ink-100);
	}

	.sub-text {
		font-size: var(--text-sm);
		color: var(--ink-60);
		line-height: 1.6;
	}

	.browse-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 24px;
		border-radius: var(--radius-md);
		background: var(--brass);
		color: white;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--dur-fast), transform var(--dur-fast);
		margin-top: var(--space-1);
	}
	.browse-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.hint {
		font-size: var(--text-xs);
		color: var(--ink-40);
		margin-top: var(--space-1);
	}
</style>
