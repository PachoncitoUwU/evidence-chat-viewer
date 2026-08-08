<script lang="ts">
	import { onMount } from 'svelte';
	import ProjectSidebar from '$components/ProjectSidebar.svelte';
	import TimelinePanel from '$components/TimelinePanel.svelte';
	import ChatFeed from '$components/ChatFeed.svelte';
	import MediaGallery from '$components/MediaGallery.svelte';
	import DropZone from '$components/DropZone.svelte';
	import Toast from '$components/Toast.svelte';
	import SimpleAuthModal from '$components/SimpleAuthModal.svelte';
	import { parseWhatsAppFile } from '$lib/whatsappParser';
	import ExportPdfModal from '$components/ExportPdfModal.svelte';
	import { exportChatToPdf, type PdfExportOptions } from '$lib/pdfExporter';
	import { chatConfig } from '$lib/stores/chatConfig';
	import { authStore } from '$lib/stores/authStore';
	import { saveUserCasesToCloud, loadUserCasesFromCloud } from '$lib/cloudStorage';
	import type { EvidenceCase, ChatMeta, ChatMessage, DaySummary, EvidenceFilter } from '$types/chat.types';

	let cases: EvidenceCase[] = [];
	let activeCaseId: string | null = null;
	let activeMeta: ChatMeta | null = null;
	let activeMessages: ChatMessage[] = [];
	let activeDays: DaySummary[] = [];

	// Persistencia en memoria: guardar datos de cada caso cargado
	const caseDataMap = new Map<string, { meta: ChatMeta; messages: ChatMessage[]; days: DaySummary[] }>();

	let isParsing = false;
	let parseError: string | null = null;

	// Estado de autenticación modal
	let showAuthModal = false;

	// Estado de exportación PDF
	let showExportPdfModal = false;
	let isExporting = false;
	let exportProgress = 0;

	// Estado de galería multimedia
	let showMediaGallery = false;

	// Estado de notificación toast
	let showToast = false;
	let toastMessage = '';
	let toastDetails = '';
	let toastType: 'success' | 'error' | 'info' = 'info';

	let filter: EvidenceFilter = {
		year: null,
		month: null,
		day: null,
		searchQuery: '',
		onlyWithMedia: false
	};

	$: cfg = $chatConfig;
	$: darkMode = cfg.darkMode === 'dark';
	$: user = $authStore;

	// Sincronizar y cargar chats cuando cambia la sesión del usuario
	$: if (user && user.isLoggedIn) {
		loadUserSessionData(user.username, user.pin);
	}

	function loadUserSessionData(username: string, pin: string) {
		const loaded = loadUserCasesFromCloud(username, pin);
		if (loaded.cases.length > 0) {
			cases = loaded.cases;
			loaded.caseDataMap.forEach((v, k) => caseDataMap.set(k, v));
			if (!activeCaseId || !caseDataMap.has(activeCaseId)) {
				const firstCase = loaded.cases[0];
				selectCase(firstCase.id);
			}
		}
	}

	function selectCase(id: string) {
		const data = caseDataMap.get(id);
		if (data) {
			activeCaseId = id;
			activeMeta = data.meta;
			activeMessages = data.messages;
			activeDays = data.days;
		}
	}

	// Apply dark mode data-theme to document element
	$: if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
		if (darkMode) {
			document.body.classList.add('dark-mode');
		} else {
			document.body.classList.remove('dark-mode');
		}
	}

	onMount(() => {
		chatConfig.init();
		if (user && user.isLoggedIn) {
			loadUserSessionData(user.username, user.pin);
		}
	});

	$: filteredMessages = activeMessages.filter((m) => {
		if (m.isSystemEvent) return false;
		if (filter.year && Number(m.date.slice(0, 4)) !== filter.year) return false;
		if (filter.month && Number(m.date.slice(5, 7)) !== filter.month) return false;
		if (filter.day && Number(m.date.slice(8, 10)) !== filter.day) return false;
		if (filter.onlyWithMedia && !m.attachment) return false;
		if (filter.searchQuery && !m.text.toLowerCase().includes(filter.searchQuery.toLowerCase())) return false;
		return true;
	});

	function handleFilterChange(partial: Partial<EvidenceFilter>) {
		filter = { ...filter, ...partial };
	}

	function handleSearchChange(q: string) {
		filter = { ...filter, searchQuery: q };
	}

	async function handleFilesDropped(files: FileList) {
		const file = Array.from(files).find(
			(f) => f.name.toLowerCase().endsWith('.zip') || f.name.toLowerCase().endsWith('.txt')
		);
		if (!file) {
			parseError = 'Por favor sube un archivo .zip o .txt exportado de WhatsApp.';
			return;
		}

		isParsing = true;
		parseError = null;

		try {
			const result = await parseWhatsAppFile(file);

			const caseId = `case-${Date.now()}`;
			
			// Contar archivos multimedia por tipo
			const mediaStats = {
				images: result.messages.filter(m => m.attachment?.kind === 'image' && !m.attachment.isSticker && m.attachment.status === 'linked').length,
				videos: result.messages.filter(m => m.attachment?.kind === 'video' && m.attachment.status === 'linked').length,
				audios: result.messages.filter(m => m.attachment?.kind === 'audio' && m.attachment.status === 'linked').length,
				documents: result.messages.filter(m => m.attachment?.kind === 'document' && m.attachment.status === 'linked').length,
				stickers: result.messages.filter(m => m.attachment?.isSticker && m.attachment.status === 'linked').length,
			};
			const totalMedia = mediaStats.images + mediaStats.videos + mediaStats.audios + mediaStats.documents + mediaStats.stickers;
			
			let descParts = [`${result.meta.totalMessages} mensajes`];
			if (totalMedia > 0) {
				descParts.push(`${totalMedia} archivos multimedia`);
			}
			descParts.push(`${result.meta.dateRangeStart} → ${result.meta.dateRangeEnd}`);
			
			const newCase: EvidenceCase = {
				id: caseId,
				name: result.meta.title,
				description: descParts.join(' · '),
				createdAt: new Date().toISOString(),
				chats: [result.meta]
			};

			cases = [...cases, newCase];
			activeCaseId = caseId;
			activeMeta = result.meta;
			activeMessages = result.messages;
			activeDays = result.days;

			// Guardar en el mapa para no perder al cambiar de caso
			caseDataMap.set(caseId, { meta: result.meta, messages: result.messages, days: result.days });

			// Guardar en la nube si hay sesión activa
			if (user && user.isLoggedIn) {
				saveUserCasesToCloud(user.username, user.pin, cases, caseDataMap);
			}

			filter = { year: null, month: null, day: null, searchQuery: '', onlyWithMedia: false };
			
			// Mostrar notificación con resumen
			const mediaParts = [];
			if (mediaStats.images > 0) mediaParts.push(`${mediaStats.images} fotos`);
			if (mediaStats.videos > 0) mediaParts.push(`${mediaStats.videos} videos`);
			if (mediaStats.audios > 0) mediaParts.push(`${mediaStats.audios} audios`);
			if (mediaStats.documents > 0) mediaParts.push(`${mediaStats.documents} documentos`);
			if (mediaStats.stickers > 0) mediaParts.push(`${mediaStats.stickers} stickers`);
			
			toastMessage = `✅ Chat cargado exitosamente`;
			toastDetails = `${result.meta.totalMessages} mensajes${totalMedia > 0 ? ` · ${mediaParts.join(', ')}` : ''}`;
			toastType = 'success';
			showToast = true;
		} catch (err: unknown) {
			parseError = err instanceof Error ? err.message : 'Error desconocido al parsear el archivo.';
		} finally {
			isParsing = false;
		}
	}

	function handleSelectCase(id: string) {
		activeCaseId = id;
		const data = caseDataMap.get(id);
		if (data) {
			activeMeta = data.meta;
			activeMessages = data.messages;
			activeDays = data.days;
			filter = { year: null, month: null, day: null, searchQuery: '', onlyWithMedia: false };
		}
	}

	function handleNewCase() {
		activeMeta = null;
		activeMessages = [];
		activeDays = [];
		parseError = null;
	}

	function handleExportPdf() {
		if (!activeMeta || isExporting) return;
		showExportPdfModal = true;
	}

	async function executePdfExport(options: PdfExportOptions) {
		if (!activeMeta || isExporting) return;

		isExporting = true;
		exportProgress = 0;

		try {
			await exportChatToPdf(activeMeta, activeMessages, options, (pct: number) => {
				exportProgress = pct;
			});
			showExportPdfModal = false;
		} catch (err) {
			alert('Error al generar el PDF: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			isExporting = false;
			exportProgress = 0;
		}
	}
</script>

<svelte:head>
	<title>Chat Viewer — Visor de WhatsApp</title>
</svelte:head>

<div class="app-shell" class:dark={darkMode}>
	<ProjectSidebar
		{cases}
		{activeCaseId}
		onSelectCase={handleSelectCase}
		onNewCase={handleNewCase}
		onOpenAuth={() => (showAuthModal = true)}
	/>

	{#if isParsing}
		<div class="center-state">
			<div class="spinner"></div>
			<p>Procesando chat de WhatsApp…</p>
			<p class="hint">Esto puede tardar unos segundos si hay muchas imágenes.</p>
		</div>

	{:else if activeMeta}
		<ChatFeed
			meta={activeMeta}
			messages={filteredMessages}
			allMessages={activeMessages}
			{filter}
			onSearchChange={handleSearchChange}
			participants={activeMeta?.participants ?? []}
		/>
		<TimelinePanel
			days={activeDays}
			{filter}
			onFilterChange={handleFilterChange}
			onExportPdf={handleExportPdf}
		/>

		<!-- Floating button for media gallery -->
		<button class="fab-media" on:click={() => (showMediaGallery = true)} title="Ver galería multimedia">
			📎
		</button>

		<!-- Media Gallery Modal -->
		{#if showMediaGallery}
			<MediaGallery messages={activeMessages} onClose={() => (showMediaGallery = false)} />
		{/if}

		<!-- Modal de Exportación a PDF por rango de fechas -->
		{#if showExportPdfModal && activeMeta}
			<ExportPdfModal
				meta={activeMeta}
				messages={activeMessages}
				isOpen={showExportPdfModal}
				{isExporting}
				{exportProgress}
				onClose={() => (showExportPdfModal = false)}
				onExport={executePdfExport}
			/>
		{/if}

	{:else}
		<div class="onboarding">
			{#if parseError}
				<div class="error-banner">⚠️ {parseError}</div>
			{/if}
			<DropZone onFilesDropped={handleFilesDropped} />
		</div>
	{/if}
</div>

<!-- Overlay de exportación PDF -->
{#if isExporting}
	<div class="export-overlay">
		<div class="export-card">
			<div class="export-spinner"></div>
			<p class="export-title">Generando PDF…</p>
			<p class="export-sub">Capturando el chat con imágenes y archivos</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width:{exportProgress}%"></div>
			</div>
			<p class="export-pct">{exportProgress}%</p>
		</div>
	</div>
{/if}

<!-- Toast notification -->
{#if showToast}
	<Toast
		message={toastMessage}
		details={toastDetails}
		type={toastType}
		onClose={() => (showToast = false)}
	/>
{/if}

<SimpleAuthModal bind:show={showAuthModal} />

<style>
	.app-shell {
		display: grid;
		grid-template-columns: 264px 1fr 300px;
		grid-template-areas: 'left main right';
		gap: var(--space-4);
		height: 100vh;
		padding: var(--space-4);
		background: var(--void);
	}
	.app-shell.dark {
		background: #0d1418;
	}

	.onboarding {
		grid-column: 2 / span 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
	}
	.onboarding :global(.dropzone) {
		width: min(560px, 100%);
	}

	.center-state {
		grid-column: 2 / span 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		color: var(--ink-60);
		font-size: var(--text-sm);
		text-align: center;
	}
	.hint {
		font-size: var(--text-xs);
		color: var(--ink-40);
	}

	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid var(--hairline-strong);
		border-top-color: var(--brass);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.error-banner {
		background: var(--alert-dim);
		border: 1px solid var(--alert);
		color: var(--alert);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		max-width: 560px;
		width: 100%;
		text-align: center;
	}

	/* — Overlay PDF — */
	.export-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		backdrop-filter: blur(4px);
	}
	.export-card {
		background: white;
		border-radius: var(--radius-lg);
		padding: var(--space-6) var(--space-7);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		min-width: 320px;
		box-shadow: 0 24px 64px rgba(0,0,0,0.25);
	}
	.export-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e5e7eb;
		border-top-color: var(--brass);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	.export-title {
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--ink-100);
	}
	.export-sub {
		font-size: var(--text-sm);
		color: var(--ink-60);
		text-align: center;
	}
	.progress-bar {
		width: 100%;
		height: 8px;
		background: #e5e7eb;
		border-radius: 999px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--brass) 0%, #7c3aed 100%);
		border-radius: 999px;
		transition: width 0.3s ease;
	}
	.export-pct {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--brass);
	}

	@media (max-width: 1080px) {
		.app-shell {
			grid-template-columns: 220px 1fr;
			grid-template-areas: 'left main';
		}
	}

	/* — Floating Action Button for Media Gallery — */
	.fab-media {
		position: fixed;
		bottom: 24px;
		right: 24px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: linear-gradient(135deg, #005c4b 0%, #00a884 100%);
		color: white;
		font-size: 24px;
		box-shadow: 0 4px 16px rgba(0, 92, 75, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		z-index: 100;
		border: none;
	}
	.fab-media:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 24px rgba(0, 92, 75, 0.6);
	}
	.fab-media:active {
		transform: scale(0.95);
	}
</style>
