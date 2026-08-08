<script lang="ts">
	import { Download, X, Image, Film, Mic, FileText, Grid, List, Smile, Search, Eye, EyeOff } from 'lucide-svelte';
	import Lightbox from './Lightbox.svelte';
	import VideoModal from './VideoModal.svelte';
	import { hiddenMediaStore } from '$lib/stores/hiddenMediaStore';
	import type { ChatMessage } from '$types/chat.types';

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

	// Recopilar todos los adjuntos con su contexto de mensaje
	$: allMedia = messages
		.filter(m => m.attachment && m.attachment.status === 'linked' && m.attachment.previewUrl)
		.map(m => ({
			msg: m,
			att: m.attachment!
		}));

	$: visibleMedia = allMedia.filter(item => !$hiddenMediaStore.has(item.msg.id));
	$: hiddenMedia = allMedia.filter(item => $hiddenMediaStore.has(item.msg.id));

	$: filteredByTab = activeTab === 'hidden'
		? hiddenMedia
		: activeTab === 'all'
			? visibleMedia
			: activeTab === 'sticker'
				? visibleMedia.filter(item => item.att.isSticker)
				: activeTab === 'image'
					? visibleMedia.filter(item => item.att.kind === 'image' && !item.att.isSticker)
					: visibleMedia.filter(item => item.att.kind === activeTab);

	$: filtered = searchQuery.trim()
		? filteredByTab.filter(item =>
				item.att.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.msg.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
		if (kind === 'hidden') return hiddenMedia.length;
		if (kind === 'all') return visibleMedia.length;
		if (kind === 'sticker') return visibleMedia.filter(i => i.att.isSticker).length;
		if (kind === 'image') return visibleMedia.filter(i => i.att.kind === 'image' && !i.att.isSticker).length;
		return visibleMedia.filter(i => i.att.kind === kind).length;
	}

	function downloadFile(url: string, name: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
	}

	function downloadAll() {
		filtered.forEach((item, index) => {
			if (item.att.previewUrl) {
				setTimeout(() => {
					downloadFile(item.att.previewUrl!, item.att.fileName);
				}, index * 100);
			}
		});
	}

	function openLightbox(src: string, name: string) {
		lightboxSrc = src; lightboxName = name; lightboxOpen = true;
	}
	function openVideo(src: string, name: string) {
		videoSrc = src; videoName = name; videoOpen = true;
	}

	function formatDate(iso: string) {
		const [y,mo,d] = iso.split('-');
		return `${d}/${mo}/${y}`;
	}
	function formatSize(bytes: number | null) {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
		return `${(bytes/1024/1024).toFixed(1)} MB`;
	}
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
			<h2>📎 Archivos multimedia</h2>
			<div class="header-actions">
				<button class="action-btn" on:click={downloadAll} title="Descargar todos los archivos de esta vista">
					<Download size={16} /> Descargar todo ({filtered.length})
				</button>
				<button class="icon-btn" on:click={() => (viewMode = viewMode === 'grid' ? 'list' : 'grid')} title="Cambiar vista">
					{#if viewMode === 'grid'}<List size={18} />{:else}<Grid size={18} />{/if}
				</button>
				<button class="icon-btn close" on:click={onClose}><X size={20} /></button>
			</div>
		</header>

		<!-- Buscador y Pestañas -->
		<div class="filter-bar">
			<div class="gallery-search">
				<Search size={14} color="#667781" />
				<input
					type="text"
					placeholder="Buscar en archivos…"
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
					<div class="grid-item">
						{#if item.att.kind === 'image' || item.att.isSticker}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="thumb-wrap" class:is-sticker-thumb={item.att.isSticker} on:click={() => openLightbox(item.att.previewUrl!, item.att.fileName)}>
								<img src={item.att.previewUrl} alt={item.att.fileName} loading="lazy" class="thumb" class:sticker-img-thumb={item.att.isSticker} />
								<div class="thumb-overlay">
									<span class="thumb-date">{formatDate(item.msg.date)}</span>
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
										<button class="thumb-dl" on:click|stopPropagation={() => downloadFile(item.att.previewUrl!, item.att.fileName)} title="Descargar">
											<Download size={14} color="white" />
										</button>
									</div>
								</div>
							</div>
						{:else if item.att.kind === 'video'}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="thumb-wrap video-thumb" on:click={() => openVideo(item.att.previewUrl!, item.att.fileName)}>
								<div class="video-placeholder">
									<Film size={28} color="rgba(255,255,255,0.8)" />
								</div>
								<div class="thumb-overlay">
									<span class="thumb-date">{formatDate(item.msg.date)}</span>
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
										<button class="thumb-dl" on:click|stopPropagation={() => downloadFile(item.att.previewUrl!, item.att.fileName)} title="Descargar">
											<Download size={14} color="white" />
										</button>
									</div>
								</div>
							</div>
						{:else if item.att.kind === 'audio'}
							<div class="audio-grid-item">
								<div class="audio-icon-wrap">
									<Mic size={20} color="#00a884" />
								</div>
								<div class="audio-info">
									<span class="file-name">{item.att.fileName}</span>
									<span class="file-meta">{formatDate(item.msg.date)} · {item.msg.senderName}</span>
									{#if item.att.previewUrl}
										<audio controls src={item.att.previewUrl} preload="none" class="gallery-audio-player"></audio>
									{/if}
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
									<button class="dl-circle" on:click={() => downloadFile(item.att.previewUrl!, item.att.fileName)} title="Descargar audio">
										<Download size={14} />
									</button>
								</div>
							</div>
						{:else}
							<div class="doc-grid-item">
								<FileText size={22} color="#4f46e5" />
								<div class="audio-info">
									<span class="file-name">{item.att.fileName}</span>
									<span class="file-meta">{formatDate(item.msg.date)} · {formatSize(item.att.sizeBytes)}</span>
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
									<button class="dl-circle" on:click={() => downloadFile(item.att.previewUrl!, item.att.fileName)} title="Descargar documento">
										<Download size={14} />
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			{:else}
				<!-- List view -->
				{#each filtered as item (item.msg.id)}
					<div class="list-item">
						{#if item.att.kind === 'image' || item.att.isSticker}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<img src={item.att.previewUrl} alt={item.att.fileName} class="list-thumb" class:is-sticker-list={item.att.isSticker} on:click={() => openLightbox(item.att.previewUrl!, item.att.fileName)} />
						{:else if item.att.kind === 'video'}
							<button type="button" class="list-thumb-btn video-icon" on:click={() => openVideo(item.att.previewUrl!, item.att.fileName)}>
								<Film size={20} color="rgba(255,255,255,0.8)" />
							</button>
						{:else if item.att.kind === 'audio'}
							<div class="list-thumb audio-icon"><Mic size={20} color="#00a884" /></div>
						{:else}
							<div class="list-thumb doc-icon"><FileText size={20} color="#4f46e5" /></div>
						{/if}
						<div class="list-info">
							<span class="file-name">{item.att.fileName}</span>
							<span class="file-meta">
								{item.msg.senderName} · {formatDate(item.msg.date)} {item.msg.time.slice(0,5)}
								{#if item.att.sizeBytes} · {formatSize(item.att.sizeBytes)}{/if}
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
							<button class="dl-circle" on:click={() => downloadFile(item.att.previewUrl!, item.att.fileName)} title="Descargar archivo">
								<Download size={15} />
							</button>
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
		background: rgba(0,0,0,0.6);
		z-index: 800;
		display: flex;
		align-items: stretch;
		justify-content: flex-end;
	}

	.gallery-panel {
		width: min(680px, 100vw);
		height: 100%;
		background: #fff;
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 32px rgba(0,0,0,0.2);
		animation: slideIn 0.2s ease;
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
	.gallery-header h2 { font-size: 16px; font-weight: 700; margin: 0; }

	.header-actions { display: flex; align-items: center; gap: 8px; }
	.action-btn {
		display: flex; align-items: center; gap: 6px;
		padding: 7px 14px; border-radius: 8px;
		background: #005c4b; color: white;
		font-size: 13px; font-weight: 600;
		transition: opacity 0.15s;
	}
	.action-btn:hover { opacity: 0.85; }
	.icon-btn {
		width: 36px; height: 36px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		color: #54656f; transition: background 0.15s;
	}
	.icon-btn:hover { background: #f0f2f5; }
	.icon-btn.close { color: #dc2626; }

	.filter-bar {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid rgba(0,0,0,0.06);
		flex-shrink: 0;
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
	.gallery-search input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		font-size: 13px;
		color: #111b21;
	}
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
	.tab:hover { background: #f0f2f5; }
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
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
		align-content: start;
	}
	.gallery-content.list {
		display: flex; flex-direction: column; gap: 4px;
	}

	.empty {
		grid-column: 1/-1;
		text-align: center; color: #8696a0;
		padding: 48px 16px; font-size: 14px;
	}

	/* Grid items */
	.grid-item { border-radius: 10px; overflow: hidden; }

	.thumb-wrap {
		position: relative; cursor: pointer;
		border-radius: 10px; overflow: hidden;
		aspect-ratio: 1; background: #1c1c1c;
	}
	.thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
	.video-thumb { display: flex; align-items: center; justify-content: center; }
	.video-placeholder {
		display: flex; align-items: center; justify-content: center;
		width: 100%; height: 100%; background: #2a2a2a;
	}
	.thumb-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%);
		display: flex; align-items: flex-end; justify-content: space-between;
		padding: 6px; opacity: 0; transition: opacity 0.15s;
	}
	.thumb-wrap:hover .thumb-overlay { opacity: 1; }
	.thumb-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.thumb-dl, .thumb-eye {
		width: 26px; height: 26px; border-radius: 50%;
		background: rgba(0,0,0,0.5);
		display: flex; align-items: center; justify-content: center;
		border: none; cursor: pointer; transition: background 0.15s, transform 0.15s;
	}
	.thumb-dl:hover, .thumb-eye:hover {
		background: rgba(0,0,0,0.8);
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
	:global([data-theme="dark"]) .audio-grid-item,
	:global([data-theme="dark"]) .doc-grid-item {
		background: #182229; border-color: rgba(255,255,255,0.08);
	}
	.audio-icon-wrap {
		width: 36px; height: 36px; border-radius: 50%;
		background: #e8f5e9; display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.gallery-audio-player {
		width: 100%;
		height: 28px;
		margin-top: 4px;
	}
	.audio-info {
		flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;
	}
	.file-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.file-meta { font-size: 11px; color: #8696a0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	.dl-circle {
		width: 30px; height: 30px; border-radius: 50%;
		background: rgba(0,0,0,0.07);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; transition: background 0.15s;
		color: #54656f;
	}
	.dl-circle:hover { background: rgba(0,92,75,0.12); color: #005c4b; }

	/* List items */
	.list-item {
		display: flex; align-items: center; gap: 12px;
		padding: 10px 12px; border-radius: 10px;
		transition: background 0.15s; cursor: default;
	}
	.list-item:hover { background: #f7f8fa; }
	.list-thumb {
		width: 48px; height: 48px; border-radius: 8px;
		object-fit: cover; flex-shrink: 0; cursor: pointer;
	}
	.video-icon, .audio-icon, .doc-icon {
		width: 48px; height: 48px; border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; cursor: pointer;
	}
	.list-thumb-btn {
		width: 48px; height: 48px; border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; cursor: pointer; border: none; padding: 0;
	}
	.video-icon { background: #1c1c1c; }
	.audio-icon { background: #e8f5e9; }
	.doc-icon { background: #ede9fe; }
	.list-info {
		flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0;
	}
</style>
