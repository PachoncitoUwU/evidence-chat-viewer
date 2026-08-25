<script lang="ts">
	import { Download, X, Image, Film, Mic, FileText, Grid, List, Smile, Search, Eye, EyeOff, CheckSquare, Square, Archive, Loader2 } from 'lucide-svelte';
	import JSZip from 'jszip';
	import Lightbox from './Lightbox.svelte';
	import VideoModal from './VideoModal.svelte';
	import { hiddenMediaStore } from '$lib/stores/hiddenMediaStore';
	import type { ChatMessage, MediaAttachment } from '$types/chat.types';

	export let messages: ChatMessage[] = [];
	export let onClose: () => void = () => {};

	type MediaTabKind = 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'all' | 'hidden';
	let activeTab: MediaTabKind = 'all';
	let viewMode: 'grid' | 'list' = 'grid';
	let searchQuery = '';

	let lightboxSrc = '';
	let lightboxName = '';
	let lightboxOpen = false;
	let videoSrc = '';
	let videoName = '';
	let videoOpen = false;

	// Selección múltiple
	let selectedIds = new Set<string>();
	let isExportingZip = false;
	let exportProgress = { current: 0, total: 0, statusText: '' };

	// Recopilar todos los adjuntos con su contexto de mensaje
	$: allMedia = messages
		.filter(m => m.attachment && m.attachment.fileName && m.attachment.status !== 'omitted')
		.map(m => ({
			msg: m,
			att: m.attachment!
		}));

	$: hiddenItems = messages
		.filter(m => $hiddenMediaStore.has(m.id))
		.map(m => ({
			msg: m,
			att: m.attachment && m.attachment.status !== 'omitted' ? m.attachment : null
		}));

	$: visibleMedia = allMedia.filter(item => !$hiddenMediaStore.has(item.msg.id));

	$: filteredByTab = activeTab === 'hidden'
		? hiddenItems
		: activeTab === 'all'
			? visibleMedia
			: activeTab === 'sticker'
				? visibleMedia.filter(item => item.att && item.att.isSticker)
				: activeTab === 'image'
					? visibleMedia.filter(item => item.att && item.att.kind === 'image' && !item.att.isSticker)
					: visibleMedia.filter(item => item.att && item.att.kind === activeTab);

	$: filtered = searchQuery.trim()
		? filteredByTab.filter(item =>
				(item.att?.fileName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.msg.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.msg.date.includes(searchQuery)
			)
		: filteredByTab;

	const tabs: Array<{ id: MediaTabKind; label: string; icon: any }> = [
		{ id: 'all',      label: 'Todo',       icon: Grid },
		{ id: 'image',    label: 'Fotos',      icon: Image },
		{ id: 'video',    label: 'Videos',     icon: Film },
		{ id: 'audio',    label: 'Audios',     icon: Mic },
		{ id: 'document', label: 'Documentos', icon: FileText },
		{ id: 'sticker',  label: 'Stickers',   icon: Smile },
		{ id: 'hidden',   label: 'Ocultos',    icon: EyeOff },
	];

	function countOf(kind: MediaTabKind) {
		if (kind === 'hidden') return hiddenItems.length;
		if (kind === 'all') return visibleMedia.length;
		if (kind === 'sticker') return visibleMedia.filter(i => i.att?.isSticker).length;
		if (kind === 'image') return visibleMedia.filter(i => i.att?.kind === 'image' && !i.att?.isSticker).length;
		return visibleMedia.filter(i => i.att?.kind === kind).length;
	}

	function toggleSelection(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next;
	}

	function selectAllFiltered() {
		const next = new Set(selectedIds);
		const selectable = filtered.filter(f => f.att && f.att.previewUrl);
		const allSelected = selectable.length > 0 && selectable.every(f => next.has(f.msg.id));
		
		if (allSelected) {
			selectable.forEach(f => next.delete(f.msg.id));
		} else {
			selectable.forEach(f => next.add(f.msg.id));
		}
		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	/**
	 * Genera un nombre estandarizado de WhatsApp con la fecha y hora en que fue enviado en el chat.
	 * Ejemplo: WhatsApp_IMG_2024-03-15_14-30-22.jpg
	 */
	function generateWhatsAppFileName(msg: ChatMessage, att: MediaAttachment, indexSuffix?: number): string {
		let prefix = 'WhatsApp_FILE_';
		if (att.isSticker) prefix = 'WhatsApp_STK_';
		else if (att.kind === 'image') prefix = 'WhatsApp_IMG_';
		else if (att.kind === 'video') prefix = 'WhatsApp_VID_';
		else if (att.kind === 'audio') prefix = 'WhatsApp_AUD_';
		else if (att.kind === 'document') prefix = 'WhatsApp_DOC_';

		// Formatear fecha limpia YYYY-MM-DD
		const datePart = (msg.date || '0000-00-00').replace(/[^0-9]/g, '-').slice(0, 10);
		// Formatear hora limpia HH-mm-ss
		const timePart = (msg.time || '00-00-00').replace(/[^0-9]/g, '-').slice(0, 8);

		// Obtener extensión original
		let ext = '';
		const dotIdx = att.fileName.lastIndexOf('.');
		if (dotIdx !== -1) {
			ext = att.fileName.slice(dotIdx);
		} else {
			if (att.kind === 'image') ext = '.jpg';
			else if (att.kind === 'video') ext = '.mp4';
			else if (att.kind === 'audio') ext = '.opus';
			else if (att.isSticker) ext = '.webp';
		}

		const suffix = typeof indexSuffix === 'number' && indexSuffix > 0 ? `_${indexSuffix}` : '';
		return `${prefix}${datePart}_${timePart}${suffix}${ext}`;
	}

	function downloadFile(url?: string | null, name?: string | null) {
		if (!url || !name) return;
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
	}

	function downloadSingleWithWhatsAppName(item: { msg: ChatMessage; att: MediaAttachment | null }) {
		if (!item.att?.previewUrl) return;
		const customName = generateWhatsAppFileName(item.msg, item.att);
		downloadFile(item.att.previewUrl, customName);
	}

	async function downloadZip(itemsToExport: Array<{ msg: ChatMessage; att: MediaAttachment }>) {
		if (itemsToExport.length === 0 || isExportingZip) return;
		isExportingZip = true;
		exportProgress = { current: 0, total: itemsToExport.length, statusText: 'Preparando descarga...' };

		try {
			const zip = new JSZip();
			const usedNames = new Map<string, number>();

			for (let i = 0; i < itemsToExport.length; i++) {
				const item = itemsToExport[i];
				exportProgress = {
					current: i + 1,
					total: itemsToExport.length,
					statusText: `Empaquetando (${i + 1}/${itemsToExport.length}): ${item.att.fileName}`
				};

				if (!item.att.previewUrl) continue;

				// Obtener Blob o ArrayBuffer del archivo
				try {
					const response = await fetch(item.att.previewUrl);
					const blob = await response.blob();

					// Generar nombre con fecha de envío WhatsApp
					let baseName = generateWhatsAppFileName(item.msg, item.att);
					if (usedNames.has(baseName)) {
						const count = usedNames.get(baseName)! + 1;
						usedNames.set(baseName, count);
						baseName = generateWhatsAppFileName(item.msg, item.att, count);
					} else {
						usedNames.set(baseName, 0);
					}

					// Fecha real del mensaje para los detalles del archivo en Windows
					const fileDate = item.msg.timestampMs ? new Date(item.msg.timestampMs) : new Date();

					zip.file(baseName, blob, {
						date: fileDate,
						comment: `Enviado por ${item.msg.senderName} el ${item.msg.date} a las ${item.msg.time}`
					});
				} catch (err) {
					console.error('Error al agregar archivo al zip:', item.att.fileName, err);
				}
			}

			exportProgress.statusText = 'Generando archivo ZIP comprimido...';
			const zipBlob = await zip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: { level: 6 }
			});

			const dateStr = new Date().toISOString().slice(0, 10);
			const zipName = `WhatsApp_Multimedia_${dateStr}.zip`;

			const downloadUrl = URL.createObjectURL(zipBlob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = zipName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(downloadUrl);

			exportProgress.statusText = '¡Descarga completada!';
		} catch (error) {
			console.error('Error al generar zip:', error);
			alert('Ocurrió un error al generar el archivo ZIP.');
		} finally {
			setTimeout(() => {
				isExportingZip = false;
				exportProgress = { current: 0, total: 0, statusText: '' };
			}, 1200);
		}
	}

	function downloadSelectedZip() {
		const items = allMedia.filter(m => selectedIds.has(m.msg.id) && m.att.previewUrl);
		if (items.length === 0) {
			alert('No has seleccionado ningún archivo con vista previa disponible.');
			return;
		}
		downloadZip(items);
	}

	function selectOnlyPhotosAndVideos() {
		const next = new Set<string>();
		const photosAndVideos = filtered.filter(f => f.att && f.att.previewUrl && (f.att.kind === 'image' || f.att.kind === 'video') && !f.att.isSticker);
		photosAndVideos.forEach(f => next.add(f.msg.id));
		selectedIds = next;
	}

	function downloadOnlyPhotosAndVideosZip() {
		const items = visibleMedia.filter((m): m is { msg: ChatMessage; att: MediaAttachment } => 
			!!m.att && 
			!!m.att.previewUrl && 
			(m.att.kind === 'image' || m.att.kind === 'video') && 
			!m.att.isSticker
		);
		if (items.length === 0) {
			alert('No se encontraron fotos o videos con vista previa disponible para descargar.');
			return;
		}
		downloadZip(items);
	}

	function downloadOnlyPhotosZip() {
		const items = visibleMedia.filter((m): m is { msg: ChatMessage; att: MediaAttachment } => 
			!!m.att && 
			!!m.att.previewUrl && 
			m.att.kind === 'image' && 
			!m.att.isSticker
		);
		if (items.length === 0) {
			alert('No se encontraron fotos para descargar.');
			return;
		}
		downloadZip(items);
	}

	function openLightbox(src?: string | null, name?: string | null) {
		if (!src) return;
		lightboxSrc = src; lightboxName = name || ''; lightboxOpen = true;
	}
	function openVideo(src?: string | null, name?: string | null) {
		if (!src) return;
		videoSrc = src; videoName = name || ''; videoOpen = true;
	}

	function formatDate(iso: string) {
		if (!iso) return '';
		const [y,mo,d] = iso.split('-');
		return `${d}/${mo}/${y}`;
	}
	function formatSize(bytes: number | null) {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
		return `${(bytes/1024/1024).toFixed(1)} MB`;
	}

	$: selectableInCurrentView = filtered.filter(f => f.att && f.att.previewUrl);
	$: allInViewSelected = selectableInCurrentView.length > 0 && selectableInCurrentView.every(f => selectedIds.has(f.msg.id));
	$: totalPhotosAndVideosCount = visibleMedia.filter(m => m.att?.previewUrl && (m.att.kind === 'image' || m.att.kind === 'video') && !m.att.isSticker).length;
</script>

{#if lightboxOpen}
	<Lightbox src={lightboxSrc} fileName={lightboxName} onClose={() => (lightboxOpen = false)} />
{/if}
{#if videoOpen}
	<VideoModal src={videoSrc} fileName={videoName} onClose={() => (videoOpen = false)} />
{/if}

<div class="gallery-backdrop" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
	<div class="gallery-panel">

		<!-- Header -->
		<header class="gallery-header">
			<div class="header-title-block">
				<h2>📎 Archivos multimedia</h2>
				<span class="header-subtitle">
					{visibleMedia.length} archivos · {totalPhotosAndVideosCount} fotos y videos con fecha de envío
				</span>
			</div>
			<div class="header-actions">
				<button class="icon-btn" on:click={() => (viewMode = viewMode === 'grid' ? 'list' : 'grid')} title="Cambiar vista (Cuadrícula / Lista)">
					{#if viewMode === 'grid'}<List size={18} />{:else}<Grid size={18} />{/if}
				</button>
				<button class="icon-btn close" on:click={onClose} title="Cerrar galería"><X size={20} /></button>
			</div>
		</header>

		<!-- Barra de Selección y Descarga ZIP -->
		<div class="selection-action-bar">
			<div class="selection-left">
				<button class="select-all-btn" on:click={selectAllFiltered} title="Seleccionar o deseleccionar todos los de esta vista">
					{#if allInViewSelected}
						<CheckSquare size={16} color="#00a884" />
						<span>Deseleccionar todo</span>
					{:else}
						<Square size={16} color="#667781" />
						<span>Seleccionar vista ({selectableInCurrentView.length})</span>
					{/if}
				</button>

				<button class="select-all-btn filter-btn" on:click={selectOnlyPhotosAndVideos} title="Seleccionar únicamente Fotos y Videos (excluyendo audios, stickers y docs)">
					<Image size={15} color="#00a884" />
					<span>Solo Fotos y Videos</span>
				</button>

				{#if selectedIds.size > 0}
					<span class="selection-count-badge">
						{selectedIds.size} marcado{selectedIds.size > 1 ? 's' : ''}
					</span>
					<button class="clear-btn" on:click={clearSelection}>Limpiar</button>
				{/if}
			</div>

			<div class="selection-right">
				{#if selectedIds.size > 0}
					<button 
						class="action-btn"
						style="background: #dc2626; color: white;"
						on:click={() => {
							const selectedList = Array.from(selectedIds);
							selectedList.forEach(id => hiddenMediaStore.toggle(id));
							clearSelection();
						}}
						title="Ocultar o restaurar todos los elementos seleccionados del chat y del PDF"
					>
						<Eye size={16} />
						<span>Ocultar / Mostrar ({selectedIds.size})</span>
					</button>

					<button 
						class="action-btn zip-btn" 
						on:click={downloadSelectedZip} 
						disabled={isExportingZip}
						title="Descargar los elementos seleccionados en un ZIP con nombre y fecha de WhatsApp"
					>
						{#if isExportingZip}
							<Loader2 size={16} class="spin" />
							<span>Empaquetando...</span>
						{:else}
							<Archive size={16} />
							<span>Descargar ZIP seleccionados ({selectedIds.size})</span>
						{/if}
					</button>
				{:else}
					<button 
						class="action-btn photo-video-btn" 
						on:click={downloadOnlyPhotosAndVideosZip} 
						disabled={isExportingZip || totalPhotosAndVideosCount === 0}
						title="Descargar únicamente todas las fotos y videos del chat en un ZIP"
					>
						{#if isExportingZip}
							<Loader2 size={16} class="spin" />
							<span>Generando ZIP...</span>
						{:else}
							<Archive size={16} />
							<span>Descargar Fotos y Videos ZIP ({totalPhotosAndVideosCount})</span>
						{/if}
					</button>
				{/if}
			</div>
		</div>

		<!-- Progreso de exportación ZIP -->
		{#if isExportingZip}
			<div class="export-progress-bar">
				<div class="progress-info">
					<Loader2 size={14} class="spin" />
					<span>{exportProgress.statusText}</span>
				</div>
				{#if exportProgress.total > 0}
					<div class="progress-track">
						<div 
							class="progress-fill" 
							style="width: {(exportProgress.current / exportProgress.total) * 100}%"
						></div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Buscador y Pestañas -->
		<div class="filter-bar">
			<div class="gallery-search">
				<Search size={14} color="#667781" />
				<input
					type="text"
					placeholder="Buscar por nombre, remitente, texto o fecha (AAAA-MM-DD)…"
					bind:value={searchQuery}
				/>
				{#if searchQuery}
					<button class="clear-search" on:click={() => (searchQuery = '')}>×</button>
				{/if}
			</div>

			<nav class="tabs">
				{#each tabs as tab}
					{@const count = countOf(tab.id)}
					{#if count > 0 || tab.id === 'all'}
						<button
							class="tab"
							class:active={activeTab === tab.id}
							on:click={() => (activeTab = tab.id)}
						>
							<svelte:component this={tab.icon} size={14} />
							{tab.label}
							<span class="badge">{count}</span>
						</button>
					{/if}
				{/each}
			</nav>
		</div>

		<!-- Content -->
		<div class="gallery-content" class:grid={viewMode === 'grid'} class:list={viewMode === 'list'}>
			{#if filtered.length === 0}
				<div class="empty">
					<p>{searchQuery ? 'Sin archivos que coincidan con la búsqueda.' : 'No hay archivos de este tipo en el chat.'}</p>
				</div>
			{:else if viewMode === 'grid'}
				{#each filtered as item (item.msg.id)}
					{@const isSelected = selectedIds.has(item.msg.id)}
					<div class="grid-item" class:is-selected={isSelected}>
						{#if item.att?.kind === 'image' || item.att?.isSticker}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="thumb-wrap" class:is-sticker-thumb={item.att.isSticker} on:click={() => item.att?.previewUrl && openLightbox(item.att.previewUrl, item.att.fileName)}>
								{#if item.att.previewUrl}
									<img src={item.att.previewUrl} alt={item.att.fileName} loading="lazy" class="thumb" class:sticker-img-thumb={item.att.isSticker} />
								{:else}
									<div class="no-thumb-placeholder">
										<Image size={32} color="rgba(255,255,255,0.4)" />
										<span class="no-thumb-name">{item.att.fileName}</span>
									</div>
								{/if}

								<!-- Checkbox selector en la esquina superior -->
								{#if item.att.previewUrl}
									<button 
										class="item-checkbox" 
										class:checked={isSelected}
										on:click|stopPropagation={() => toggleSelection(item.msg.id)} 
										title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
									>
										{#if isSelected}
											<CheckSquare size={18} color="#00a884" />
										{:else}
											<Square size={18} color="rgba(255,255,255,0.9)" />
										{/if}
									</button>
								{/if}

								<div class="thumb-overlay">
									<div class="thumb-meta-wrap">
										<span class="thumb-date">{formatDate(item.msg.date)} {item.msg.time?.slice(0,5) || ''}</span>
										<span class="thumb-sender">{item.msg.senderName}</span>
									</div>
									<div class="thumb-actions">
										{#if $hiddenMediaStore.has(item.msg.id)}
											<button class="thumb-eye restored" on:click|stopPropagation={() => hiddenMediaStore.unhide(item.msg.id)} title="Mostrar en el chat y PDF (Restaurar)">
												<EyeOff size={14} color="#25d366" />
											</button>
										{:else}
											<button class="thumb-eye" on:click|stopPropagation={() => hiddenMediaStore.hide(item.msg.id)} title="Ocultar del chat y PDF">
												<Eye size={14} color="white" />
											</button>
										{/if}
										{#if item.att.previewUrl}
											<button class="thumb-dl" on:click|stopPropagation={() => downloadSingleWithWhatsAppName(item)} title="Descargar con fecha de WhatsApp">
												<Download size={14} color="white" />
											</button>
										{/if}
									</div>
								</div>
							</div>
						{:else if item.att?.kind === 'video'}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="thumb-wrap video-thumb" on:click={() => openVideo(item.att?.previewUrl!, item.att?.fileName)}>
								<div class="video-placeholder">
									<Film size={28} color="rgba(255,255,255,0.8)" />
									<span class="file-badge">Video</span>
								</div>

								<!-- Checkbox selector en la esquina superior -->
								{#if item.att?.previewUrl}
									<button 
										class="item-checkbox" 
										class:checked={isSelected}
										on:click|stopPropagation={() => toggleSelection(item.msg.id)} 
										title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
									>
										{#if isSelected}
											<CheckSquare size={18} color="#00a884" />
										{:else}
											<Square size={18} color="rgba(255,255,255,0.9)" />
										{/if}
									</button>
								{/if}

								<div class="thumb-overlay">
									<div class="thumb-meta-wrap">
										<span class="thumb-date">{formatDate(item.msg.date)} {item.msg.time?.slice(0,5) || ''}</span>
										<span class="thumb-sender">{item.msg.senderName}</span>
									</div>
									<div class="thumb-actions">
										{#if $hiddenMediaStore.has(item.msg.id)}
											<button class="thumb-eye restored" on:click|stopPropagation={() => hiddenMediaStore.unhide(item.msg.id)} title="Mostrar en el chat (Restaurar)">
												<EyeOff size={14} color="#25d366" />
											</button>
										{:else}
											<button class="thumb-eye" on:click|stopPropagation={() => hiddenMediaStore.hide(item.msg.id)} title="Ocultar del chat">
												<Eye size={14} color="white" />
											</button>
										{/if}
										{#if item.att?.previewUrl}
											<button class="thumb-dl" on:click|stopPropagation={() => downloadSingleWithWhatsAppName(item)} title="Descargar con fecha de WhatsApp">
												<Download size={14} color="white" />
											</button>
										{/if}
									</div>
								</div>
							</div>
						{:else if item.att?.kind === 'audio'}
							<div class="audio-grid-item" class:is-selected={isSelected}>
								<button class="item-checkbox-inline" on:click={() => toggleSelection(item.msg.id)}>
									{#if isSelected}
										<CheckSquare size={18} color="#00a884" />
									{:else}
										<Square size={18} color="#667781" />
									{/if}
								</button>
								<Mic size={22} color="#00a884" />
								<div class="audio-info">
									<span class="file-name">{item.att.fileName}</span>
									<span class="file-meta">{item.msg.senderName} · {formatDate(item.msg.date)} {item.msg.time} · Audio</span>
								</div>
								<div class="item-action-btns">
									{#if $hiddenMediaStore.has(item.msg.id)}
										<button class="dl-circle" on:click={() => hiddenMediaStore.unhide(item.msg.id)} title="Mostrar en el chat (Restaurar)">
											<EyeOff size={14} color="#25d366" />
										</button>
									{:else}
										<button class="dl-circle" on:click={() => hiddenMediaStore.hide(item.msg.id)} title="Ocultar del chat">
											<Eye size={14} />
										</button>
									{/if}
									{#if item.att.previewUrl}
										<button class="dl-circle" on:click={() => downloadSingleWithWhatsAppName(item)} title="Descargar audio con fecha WhatsApp">
											<Download size={14} />
										</button>
									{/if}
								</div>
							</div>
						{:else if item.att?.kind === 'document'}
							<div class="doc-grid-item" class:is-selected={isSelected}>
								<button class="item-checkbox-inline" on:click={() => toggleSelection(item.msg.id)}>
									{#if isSelected}
										<CheckSquare size={18} color="#00a884" />
									{:else}
										<Square size={18} color="#667781" />
									{/if}
								</button>
								<FileText size={22} color="#4f46e5" />
								<div class="audio-info">
									<span class="file-name">{item.att.fileName}</span>
									<span class="file-meta">{item.msg.senderName} · {formatDate(item.msg.date)} {item.msg.time} · {formatSize(item.att.sizeBytes)}</span>
								</div>
								<div class="item-action-btns">
									{#if $hiddenMediaStore.has(item.msg.id)}
										<button class="dl-circle" on:click={() => hiddenMediaStore.unhide(item.msg.id)} title="Mostrar en el chat (Restaurar)">
											<EyeOff size={14} color="#25d366" />
										</button>
									{:else}
										<button class="dl-circle" on:click={() => hiddenMediaStore.hide(item.msg.id)} title="Ocultar del chat">
											<Eye size={14} />
										</button>
									{/if}
									{#if item.att.previewUrl}
										<button class="dl-circle" on:click={() => downloadSingleWithWhatsAppName(item)} title="Descargar documento con fecha WhatsApp">
											<Download size={14} />
										</button>
									{/if}
								</div>
							</div>
						{:else}
							<!-- Mensajes de texto ocultos sin adjunto -->
							<div class="doc-grid-item" style="border-left: 3px solid #dc2626;">
								<EyeOff size={20} color="#dc2626" />
								<div class="audio-info">
									<span class="file-name">@{item.msg.senderName}: "{item.msg.text.slice(0, 45)}{item.msg.text.length > 45 ? '...' : ''}"</span>
									<span class="file-meta">{formatDate(item.msg.date)} {item.msg.time} · Mensaje de Texto Oculto</span>
								</div>
								<div class="item-action-btns">
									<button class="dl-circle" on:click={() => hiddenMediaStore.unhide(item.msg.id)} title="Mostrar en el chat y PDF (Restaurar)">
										<EyeOff size={14} color="#25d366" />
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			{:else}
				<!-- List view con detalles completos -->
				{#each filtered as item (item.msg.id)}
					{@const isSelected = selectedIds.has(item.msg.id)}
					<div class="list-item" class:is-selected={isSelected}>
						{#if item.att?.previewUrl}
							<button class="item-checkbox-inline" on:click={() => toggleSelection(item.msg.id)}>
								{#if isSelected}
									<CheckSquare size={18} color="#00a884" />
								{:else}
									<Square size={18} color="#667781" />
								{/if}
							</button>
						{/if}

						{#if item.att?.kind === 'image' || item.att?.isSticker}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<img src={item.att.previewUrl} alt={item.att.fileName} class="list-thumb" class:is-sticker-list={item.att.isSticker} on:click={() => openLightbox(item.att?.previewUrl, item.att?.fileName)} />
						{:else if item.att?.kind === 'video'}
							<button type="button" class="list-thumb-btn video-icon" on:click={() => openVideo(item.att?.previewUrl, item.att?.fileName)}>
								<Film size={20} color="rgba(255,255,255,0.8)" />
							</button>
						{:else if item.att?.kind === 'audio'}
							<div class="list-thumb audio-icon"><Mic size={20} color="#00a884" /></div>
						{:else if item.att?.kind === 'document'}
							<div class="list-thumb doc-icon"><FileText size={20} color="#4f46e5" /></div>
						{:else}
							<div class="list-thumb doc-icon" style="background:rgba(220,38,38,0.1);"><EyeOff size={20} color="#dc2626" /></div>
						{/if}

						<div class="list-info">
							<div class="list-title-row">
								<span class="file-name">{item.att?.fileName || item.msg.text.slice(0, 45)}</span>
								{#if item.att}
									<span class="suggested-name-badge">
										WhatsApp: {generateWhatsAppFileName(item.msg, item.att)}
									</span>
								{/if}
							</div>
							<span class="file-meta">
								Enviado por <strong>{item.msg.senderName}</strong> · Fecha: {formatDate(item.msg.date)} {item.msg.time}
								{#if item.att?.sizeBytes} · Tamaño: {formatSize(item.att.sizeBytes)}{/if}
							</span>
						</div>
						<div class="item-action-btns">
							{#if $hiddenMediaStore.has(item.msg.id)}
								<button class="dl-circle" on:click={() => hiddenMediaStore.unhide(item.msg.id)} title="Mostrar en el chat (Restaurar)">
									<EyeOff size={15} color="#25d366" />
								</button>
							{:else}
								<button class="dl-circle" on:click={() => hiddenMediaStore.hide(item.msg.id)} title="Ocultar del chat">
									<Eye size={15} />
								</button>
							{/if}
							{#if item.att?.previewUrl}
								<button class="dl-circle" on:click={() => downloadSingleWithWhatsAppName(item)} title="Descargar archivo con fecha original de WhatsApp">
									<Download size={15} />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.gallery-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.65);
		z-index: 800;
		display: flex;
		align-items: stretch;
		justify-content: flex-end;
		backdrop-filter: blur(2px);
	}

	.gallery-panel {
		width: min(740px, 100vw);
		height: 100%;
		background: #fff;
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 32px rgba(0,0,0,0.25);
		animation: slideIn 0.2s ease;
	}
	:global([data-theme="dark"]) .gallery-panel {
		background: #111b21;
		color: #e9edef;
	}
	@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

	.gallery-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid rgba(0,0,0,0.08);
		flex-shrink: 0;
	}
	:global([data-theme="dark"]) .gallery-header {
		border-color: rgba(255,255,255,0.08);
	}
	.header-title-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.gallery-header h2 { font-size: 17px; font-weight: 700; margin: 0; }
	.header-subtitle { font-size: 12px; color: #667781; }
	:global([data-theme="dark"]) .header-subtitle { color: #8696a0; }

	.header-actions { display: flex; align-items: center; gap: 8px; }

	/* Selection Action Bar */
	.selection-action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		background: #f8fafc;
		border-bottom: 1px solid rgba(0,0,0,0.07);
		flex-shrink: 0;
		gap: 12px;
		flex-wrap: wrap;
	}
	:global([data-theme="dark"]) .selection-action-bar {
		background: #182229;
		border-color: rgba(255,255,255,0.06);
	}
	.selection-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.select-all-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid rgba(0,0,0,0.12);
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s;
	}
	:global([data-theme="dark"]) .select-all-btn {
		border-color: rgba(255,255,255,0.15);
		color: #cbd5e1;
	}
	.select-all-btn:hover {
		background: rgba(0,0,0,0.04);
	}
	:global([data-theme="dark"]) .select-all-btn:hover {
		background: rgba(255,255,255,0.05);
	}
	.selection-count-badge {
		font-size: 12px;
		font-weight: 700;
		color: #005c4b;
		background: rgba(0,92,75,0.1);
		padding: 4px 10px;
		border-radius: 20px;
	}
	:global([data-theme="dark"]) .selection-count-badge {
		color: #25d366;
		background: rgba(37,211,102,0.15);
	}
	.clear-btn {
		font-size: 11px;
		color: #8696a0;
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
	}

	.selection-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.action-btn {
		display: flex; align-items: center; gap: 7px;
		padding: 8px 14px; border-radius: 8px;
		font-size: 13px; font-weight: 600;
		cursor: pointer; border: none;
		transition: all 0.15s;
	}
	.action-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.zip-btn {
		background: #00a884;
		color: white;
		box-shadow: 0 2px 8px rgba(0, 168, 132, 0.3);
	}
	.zip-btn:hover:not(:disabled) {
		background: #008f6f;
	}
	.photo-video-btn {
		background: #005c4b;
		color: white;
		box-shadow: 0 2px 8px rgba(0, 92, 75, 0.25);
	}
	.photo-video-btn:hover:not(:disabled) {
		background: #004d3e;
	}
	.filter-btn {
		background: rgba(0, 168, 132, 0.08);
		border-color: rgba(0, 168, 132, 0.3);
		color: #005c4b;
	}
	:global([data-theme="dark"]) .filter-btn {
		background: rgba(37, 211, 102, 0.12);
		border-color: rgba(37, 211, 102, 0.3);
		color: #25d366;
	}
	.filter-btn:hover {
		background: rgba(0, 168, 132, 0.15);
	}
	.secondary-btn {
		background: #f0f2f5;
		color: #111b21;
		border: 1px solid rgba(0,0,0,0.08);
	}
	:global([data-theme="dark"]) .secondary-btn {
		background: #222e35;
		color: #e9edef;
		border-color: rgba(255,255,255,0.1);
	}
	.secondary-btn:hover:not(:disabled) {
		background: #e2e8f0;
	}

	/* Export progress */
	.export-progress-bar {
		padding: 8px 16px;
		background: #ecfdf5;
		border-bottom: 1px solid #a7f3d0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		animation: fadeIn 0.2s ease;
	}
	:global([data-theme="dark"]) .export-progress-bar {
		background: #064e3b;
		border-color: #047857;
	}
	.progress-info {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		font-weight: 600;
		color: #065f46;
	}
	:global([data-theme="dark"]) .progress-info { color: #a7f3d0; }
	.progress-track {
		height: 5px;
		background: rgba(0,0,0,0.08);
		border-radius: 4px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: #059669;
		transition: width 0.2s ease;
	}

	.icon-btn {
		width: 36px; height: 36px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		color: #54656f; transition: background 0.15s;
		background: none; border: none; cursor: pointer;
	}
	:global([data-theme="dark"]) .icon-btn { color: #8696a0; }
	.icon-btn:hover { background: #f0f2f5; }
	:global([data-theme="dark"]) .icon-btn:hover { background: #222e35; }
	.icon-btn.close { color: #dc2626; }

	.filter-bar {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid rgba(0,0,0,0.06);
		flex-shrink: 0;
	}
	:global([data-theme="dark"]) .filter-bar {
		border-color: rgba(255,255,255,0.06);
	}
	.gallery-search {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 10px 16px 4px 16px;
		padding: 6px 12px;
		border-radius: 8px;
		background: #f0f2f5;
		border: 1px solid rgba(0,0,0,0.08);
	}
	:global([data-theme="dark"]) .gallery-search {
		background: #202c33;
		border-color: rgba(255,255,255,0.08);
	}
	.gallery-search input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		font-size: 13px;
		color: #111b21;
	}
	:global([data-theme="dark"]) .gallery-search input { color: #e9edef; }
	.clear-search {
		background: none;
		border: none;
		font-size: 16px;
		color: #8696a0;
		cursor: pointer;
		padding: 0 4px;
	}

	.tabs {
		display: flex; gap: 4px; padding: 6px 16px 10px 16px;
		overflow-x: auto; flex-shrink: 0;
	}
	.tab {
		display: flex; align-items: center; gap: 5px;
		padding: 6px 12px; border-radius: 20px;
		font-size: 13px; font-weight: 500; color: #667781;
		white-space: nowrap; transition: all 0.15s;
		border: none; background: transparent; cursor: pointer;
	}
	:global([data-theme="dark"]) .tab { color: #8696a0; }
	.tab:hover { background: #f0f2f5; }
	:global([data-theme="dark"]) .tab:hover { background: #202c33; }
	.tab.active { background: #005c4b; color: white; }
	.badge {
		background: rgba(0,0,0,0.12); border-radius: 999px;
		font-size: 10px; padding: 1px 6px; font-weight: 700;
	}
	.tab.active .badge { background: rgba(255,255,255,0.25); }

	.thumb-wrap.is-sticker-thumb {
		background: #f7f8fa;
		border: 1px solid rgba(0,0,0,0.06);
	}
	.thumb.sticker-img-thumb {
		object-fit: contain;
		padding: 8px;
	}
	.list-thumb.is-sticker-list {
		object-fit: contain;
		background: #f7f8fa;
		padding: 4px;
	}

	.gallery-content {
		flex: 1; overflow-y: auto; padding: 16px;
	}
	.gallery-content.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 14px;
		align-content: start;
	}
	.gallery-content.list {
		display: flex; flex-direction: column; gap: 6px;
	}

	.empty {
		grid-column: 1/-1;
		text-align: center; color: #8696a0;
		padding: 48px 16px; font-size: 14px;
	}

	/* Grid items */
	.grid-item { 
		border-radius: 10px; 
		overflow: hidden;
		position: relative;
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.grid-item.is-selected {
		outline: 3px solid #00a884;
		box-shadow: 0 0 10px rgba(0,168,132,0.4);
	}

	.thumb-wrap {
		position: relative; cursor: pointer;
		border-radius: 10px; overflow: hidden;
		width: 100%; min-height: 160px; height: 180px;
		background: #1c1c1c;
		display: flex; align-items: center; justify-content: center;
	}
	.thumb {
		width: 100%; height: 100%;
		object-fit: cover;
		display: block;
		background: #182229;
	}
	.video-thumb { display: flex; align-items: center; justify-content: center; }
	.video-placeholder, .no-thumb-placeholder {
		display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
		width: 100%; height: 100%; background: #2a2a2a; padding: 8px; box-sizing: border-box; text-align: center;
	}
	.file-badge {
		font-size: 10px;
		background: rgba(255,255,255,0.2);
		padding: 2px 6px;
		border-radius: 4px;
		color: #fff;
	}
	.no-thumb-name {
		font-size: 10px; color: rgba(255,255,255,0.7); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}

	/* Item Checkbox */
	.item-checkbox {
		position: absolute;
		top: 6px;
		left: 6px;
		z-index: 20;
		background: rgba(0,0,0,0.6);
		border: none;
		border-radius: 6px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}
	.item-checkbox:hover {
		background: rgba(0,0,0,0.85);
		transform: scale(1.1);
	}
	.item-checkbox.checked {
		background: #ffffff;
	}
	.item-checkbox-inline {
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
	}

	.thumb-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%);
		display: flex; align-items: flex-end; justify-content: space-between;
		padding: 8px; opacity: 0; transition: opacity 0.15s;
		pointer-events: none;
	}
	.thumb-wrap:hover .thumb-overlay { opacity: 1; }
	.thumb-meta-wrap {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-width: 65%;
	}
	.thumb-date { font-size: 10px; font-weight: 700; color: #fff; line-height: 1.1; }
	.thumb-sender { font-size: 9px; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	.thumb-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		pointer-events: auto;
	}
	.thumb-dl, .thumb-eye {
		width: 26px; height: 26px; border-radius: 50%;
		background: rgba(0,0,0,0.6);
		display: flex; align-items: center; justify-content: center;
		border: none; cursor: pointer; transition: background 0.15s, transform 0.15s;
	}
	.thumb-dl:hover, .thumb-eye:hover {
		background: rgba(0,0,0,0.9);
		transform: scale(1.1);
	}
	.thumb-eye.restored {
		background: rgba(37, 211, 102, 0.25);
		border: 1px solid rgba(37, 211, 102, 0.5);
	}

	.item-action-btns {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.audio-grid-item, .doc-grid-item {
		grid-column: 1 / -1;
		display: flex; align-items: center; gap: 12px;
		padding: 12px 14px; border-radius: 12px;
		background: #f7f8fa; border: 1px solid rgba(0,0,0,0.06);
	}
	.audio-grid-item.is-selected, .doc-grid-item.is-selected {
		border-color: #00a884;
		background: rgba(0,168,132,0.05);
	}
	:global([data-theme="dark"]) .audio-grid-item,
	:global([data-theme="dark"]) .doc-grid-item {
		background: #182229; border-color: rgba(255,255,255,0.08);
	}
	.audio-info {
		flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;
	}
	.file-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.file-meta { font-size: 11px; color: #8696a0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	.dl-circle {
		width: 32px; height: 32px; border-radius: 50%;
		background: rgba(0,0,0,0.07);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; transition: background 0.15s;
		color: #54656f; border: none; cursor: pointer;
	}
	:global([data-theme="dark"]) .dl-circle {
		background: rgba(255,255,255,0.08);
		color: #aebac1;
	}
	.dl-circle:hover { background: rgba(0,92,75,0.15); color: #00a884; }

	/* List items */
	.list-item {
		display: flex; align-items: center; gap: 12px;
		padding: 10px 14px; border-radius: 10px;
		background: #f8fafc;
		border: 1px solid rgba(0,0,0,0.04);
		transition: background 0.15s, border-color 0.15s;
	}
	:global([data-theme="dark"]) .list-item {
		background: #182229;
		border-color: rgba(255,255,255,0.05);
	}
	.list-item:hover { background: #f1f5f9; }
	:global([data-theme="dark"]) .list-item:hover { background: #202c33; }
	.list-item.is-selected {
		border-color: #00a884;
		background: rgba(0,168,132,0.06);
	}
	.list-thumb {
		width: 52px; height: 52px; border-radius: 8px;
		object-fit: cover; flex-shrink: 0; cursor: pointer;
	}
	.video-icon, .audio-icon, .doc-icon {
		width: 52px; height: 52px; border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; cursor: pointer;
	}
	.list-thumb-btn {
		width: 52px; height: 52px; border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; cursor: pointer; border: none; padding: 0;
	}
	.video-icon { background: #1c1c1c; }
	.audio-icon { background: #e8f5e9; }
	.doc-icon { background: #ede9fe; }
	.list-info {
		flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0;
	}
	.list-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.suggested-name-badge {
		font-size: 10px;
		font-family: monospace;
		background: #e2e8f0;
		color: #334155;
		padding: 2px 6px;
		border-radius: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	:global([data-theme="dark"]) .suggested-name-badge {
		background: #2a3942;
		color: #94a3b8;
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>

