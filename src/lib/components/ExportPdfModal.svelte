<script lang="ts">
	import {
		FileText, Calendar, X, Download, CheckCircle2,
		Filter, ShieldCheck, Palette, Image as ImageIcon,
		Video, Mic, File, Smile, MessageSquare, AlertCircle
	} from 'lucide-svelte';
	import type { ChatMessage, ChatMeta, PdfExportOptions } from '$types/chat.types';

	export let meta: ChatMeta;
	export let messages: ChatMessage[];
	export let isOpen: boolean = false;
	export let isExporting: boolean = false;
	export let exportProgress: number = 0;
	export let onClose: () => void;
	export let onExport: (options: PdfExportOptions) => void;

	let activeTab: 'filter' | 'forensic' | 'style' = 'filter';

	// Rango de fechas
	let mode: 'all' | 'range' = 'all';
	let dateFrom: string = '';
	let dateTo: string = '';

	// Filtros de tipos de contenido
	let includeText: boolean = true;
	let includeImages: boolean = true;
	let includeVideos: boolean = true;
	let includeAudios: boolean = true;
	let includeDocuments: boolean = true;
	let includeStickers: boolean = true;
	let includeSystemEvents: boolean = false;
	let includeGhostMessages: boolean = false;

	// Opciones de informe pericial & marca de agua
	let includeCoverPage: boolean = true;
	let caseNumber: string = '';
	let investigatorName: string = '';
	let courtInstitution: string = '';
	let watermarkText: string = 'EVIDENCIA DIGITAL - USO CONFIDENCIAL';
	let enableWatermark: boolean = false;

	// Estilo visual del PDF
	let pdfTheme: 'dark' | 'light' | 'legal' = 'dark';

	$: minDate = messages.length > 0 ? messages[0].date : '';
	$: maxDate = messages.length > 0 ? messages[messages.length - 1].date : '';

	$: if (isOpen && !dateFrom) {
		dateFrom = minDate;
		dateTo = maxDate;
	}

	// Conteo reactivo de mensajes filtrados
	$: filteredCount = (() => {
		return messages.filter((m) => {
			// Filtro de fechas
			if (mode === 'range') {
				if (!m.date) return true;
				if (dateFrom && m.date < dateFrom) return false;
				if (dateTo && m.date > dateTo) return false;
			}

			// Eventos de sistema
			if (m.isSystemEvent) {
				return includeSystemEvents;
			}

			// Mensajes vacíos / sin contenido
			const isEmpty = !m.text && (!m.attachment || m.attachment.status === 'omitted' || m.attachment.status === 'missing');
			if (isEmpty && !includeGhostMessages) {
				return false;
			}

			// Mensajes con texto puro (sin adjunto)
			if (m.text && !m.attachment) {
				if (!includeText) return false;
			}

			// Adjuntos
			if (m.attachment) {
				const att = m.attachment;
				if (att.isSticker || (att.kind === 'image' && att.fileName.toLowerCase().endsWith('.gif'))) {
					if (!includeStickers) return false;
				} else if (att.kind === 'image') {
					if (!includeImages) return false;
				} else if (att.kind === 'video') {
					if (!includeVideos) return false;
				} else if (att.kind === 'audio') {
					if (!includeAudios) return false;
				} else if (att.kind === 'document') {
					if (!includeDocuments) return false;
				}
			}

			return true;
		}).length;
	})();

	function selectAllFilters(enable: boolean) {
		includeText = enable;
		includeImages = enable;
		includeVideos = enable;
		includeAudios = enable;
		includeDocuments = enable;
		includeStickers = enable;
		includeSystemEvents = enable;
		includeGhostMessages = enable;
	}

	function handleConfirm() {
		const opts: PdfExportOptions = {
			dateFrom: mode === 'range' ? dateFrom || undefined : undefined,
			dateTo: mode === 'range' ? dateTo || undefined : undefined,
			includeText,
			includeImages,
			includeVideos,
			includeAudios,
			includeDocuments,
			includeStickers,
			includeSystemEvents,
			includeGhostMessages,
			includeCoverPage,
			caseNumber: caseNumber.trim() || undefined,
			investigatorName: investigatorName.trim() || undefined,
			courtInstitution: courtInstitution.trim() || undefined,
			watermarkText: enableWatermark ? watermarkText.trim() : undefined,
			pdfTheme
		};
		onExport(opts);
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-backdrop" on:click|self={onClose}>
		<div class="modal-card">
			<header class="modal-header">
				<div class="header-title">
					<FileText size={22} color="#00a884" />
					<div>
						<h3>Exportar Evidencia a PDF</h3>
						<span class="header-sub">{meta?.title || 'Chat de WhatsApp'}</span>
					</div>
				</div>
				<button class="close-btn" on:click={onClose} disabled={isExporting}>
					<X size={18} />
				</button>
			</header>

			<!-- Pestañas de configuración -->
			<nav class="nav-tabs">
				<button
					class="tab-btn"
					class:active={activeTab === 'filter'}
					on:click={() => (activeTab = 'filter')}
				>
					<Filter size={15} /> Contenido y Fechas
				</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'forensic'}
					on:click={() => (activeTab = 'forensic')}
				>
					<ShieldCheck size={15} /> Datos Periciales
				</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'style'}
					on:click={() => (activeTab = 'style')}
				>
					<Palette size={15} /> Tema y Marca de Agua
				</button>
			</nav>

			<div class="modal-body">
				{#if activeTab === 'filter'}
					<!-- Rango de fechas -->
					<div class="section-title">
						<Calendar size={15} /> Rango de Fechas
					</div>
					<div class="options-group">
						<label class="option-card" class:selected={mode === 'all'}>
							<input type="radio" name="exportMode" value="all" bind:group={mode} disabled={isExporting} />
							<div class="option-content">
								<span class="option-title">Todo el chat</span>
								<span class="option-sub">Exportar desde {minDate} hasta {maxDate}</span>
							</div>
						</label>

						<label class="option-card" class:selected={mode === 'range'}>
							<input type="radio" name="exportMode" value="range" bind:group={mode} disabled={isExporting} />
							<div class="option-content">
								<span class="option-title">Rango de fechas personalizado</span>
								<span class="option-sub">Filtrar mensajes entre dos fechas exactas</span>
							</div>
						</label>
					</div>

					{#if mode === 'range'}
						<div class="date-range-box">
							<div class="date-field">
								<label for="dateFrom">Desde:</label>
								<input id="dateFrom" type="date" bind:value={dateFrom} min={minDate} max={dateTo || maxDate} disabled={isExporting} />
							</div>
							<div class="date-field">
								<label for="dateTo">Hasta:</label>
								<input id="dateTo" type="date" bind:value={dateTo} min={dateFrom || minDate} max={maxDate} disabled={isExporting} />
							</div>
						</div>
					{/if}

					<!-- Selección de tipos de elementos a exportar -->
					<div class="filter-header">
						<div class="section-title" style="margin: 0;">
							<Filter size={15} /> Elementos a Incluir
						</div>
						<div class="quick-toggle-btns">
							<button type="button" class="btn-text-sm" on:click={() => selectAllFilters(true)}>Todos</button>
							<button type="button" class="btn-text-sm" on:click={() => selectAllFilters(false)}>Ninguno</button>
						</div>
					</div>

					<div class="filter-grid">
						<label class="check-box" class:checked={includeText}>
							<input type="checkbox" bind:checked={includeText} disabled={isExporting} />
							<MessageSquare size={16} class="ic-text" />
							<span>Mensajes de texto</span>
						</label>

						<label class="check-box" class:checked={includeImages}>
							<input type="checkbox" bind:checked={includeImages} disabled={isExporting} />
							<ImageIcon size={16} class="ic-img" />
							<span>Fotos e imágenes</span>
						</label>

						<label class="check-box" class:checked={includeVideos}>
							<input type="checkbox" bind:checked={includeVideos} disabled={isExporting} />
							<Video size={16} class="ic-vid" />
							<span>Videos</span>
						</label>

						<label class="check-box" class:checked={includeAudios}>
							<input type="checkbox" bind:checked={includeAudios} disabled={isExporting} />
							<Mic size={16} class="ic-aud" />
							<span>Audios / Notas de voz</span>
						</label>

						<label class="check-box" class:checked={includeDocuments}>
							<input type="checkbox" bind:checked={includeDocuments} disabled={isExporting} />
							<File size={16} class="ic-doc" />
							<span>Documentos / PDF</span>
						</label>

						<label class="check-box" class:checked={includeStickers}>
							<input type="checkbox" bind:checked={includeStickers} disabled={isExporting} />
							<Smile size={16} class="ic-stk" />
							<span>Stickers y GIFs</span>
						</label>

						<label class="check-box" class:checked={includeSystemEvents}>
							<input type="checkbox" bind:checked={includeSystemEvents} disabled={isExporting} />
							<AlertCircle size={16} class="ic-sys" />
							<span>Eventos de sistema</span>
						</label>

						<label class="check-box" class:checked={includeGhostMessages}>
							<input type="checkbox" bind:checked={includeGhostMessages} disabled={isExporting} />
							<X size={16} class="ic-ghost" />
							<span>Mensajes vacíos / omitidos</span>
						</label>
					</div>

				{:else if activeTab === 'forensic'}
					<p class="tab-desc">
						Agrega metadatos periciales para respaldar la cadena de custodia y validar la exportación legal en tribunales.
					</p>

					<div class="form-group">
						<label for="caseNumber">N° de Expediente / Caso / Registro:</label>
						<input id="caseNumber" type="text" placeholder="Ej. EXP-2025-08492" bind:value={caseNumber} disabled={isExporting} />
					</div>

					<div class="form-group">
						<label for="investigatorName">Perito / Investigador a Cargo:</label>
						<input id="investigatorName" type="text" placeholder="Ej. Lic. Carlos Mendoza" bind:value={investigatorName} disabled={isExporting} />
					</div>

					<div class="form-group">
						<label for="courtInstitution">Juzgado / Unidad de Investigación:</label>
						<input id="courtInstitution" type="text" placeholder="Ej. Fiscalía Especializada N° 4" bind:value={courtInstitution} disabled={isExporting} />
					</div>

					<label class="toggle-row">
						<input type="checkbox" bind:checked={includeCoverPage} disabled={isExporting} />
						<div class="toggle-info">
							<span class="toggle-title">Incluir Carátula de Informe Pericial</span>
							<span class="toggle-sub">Añade una portada formal con resumen, fechas, firmas y Hash SHA-256</span>
						</div>
					</label>

				{:else if activeTab === 'style'}
					<div class="section-title">Estilo Visual del PDF</div>
					<div class="theme-selector">
						<label class="theme-card" class:selected={pdfTheme === 'dark'}>
							<input type="radio" name="pdfTheme" value="dark" bind:group={pdfTheme} disabled={isExporting} />
							<div class="theme-preview dark-prev">
								<div class="prev-bubble in"></div>
								<div class="prev-bubble out"></div>
							</div>
							<span>WhatsApp Oscuro</span>
						</label>

						<label class="theme-card" class:selected={pdfTheme === 'light'}>
							<input type="radio" name="pdfTheme" value="light" bind:group={pdfTheme} disabled={isExporting} />
							<div class="theme-preview light-prev">
								<div class="prev-bubble in"></div>
								<div class="prev-bubble out"></div>
							</div>
							<span>WhatsApp Claro</span>
						</label>

						<label class="theme-card" class:selected={pdfTheme === 'legal'}>
							<input type="radio" name="pdfTheme" value="legal" bind:group={pdfTheme} disabled={isExporting} />
							<div class="theme-preview legal-prev">
								<div class="prev-bubble in"></div>
								<div class="prev-bubble out"></div>
							</div>
							<span>Impresión B/N</span>
						</label>
					</div>

					<div class="section-title" style="margin-top: 18px;">Marca de Agua</div>
					<label class="toggle-row">
						<input type="checkbox" bind:checked={enableWatermark} disabled={isExporting} />
						<div class="toggle-info">
							<span class="toggle-title">Activar Marca de Agua en Páginas</span>
							<span class="toggle-sub">Imprime una leyenda diagonal en cada hoja del documento</span>
						</div>
					</label>

					{#if enableWatermark}
						<div class="form-group" style="margin-top: 10px;">
							<label for="watermarkText">Texto de la marca de agua:</label>
							<input id="watermarkText" type="text" bind:value={watermarkText} disabled={isExporting} />
						</div>
					{/if}
				{/if}

				<!-- Resumen de mensajes a exportar -->
				<div class="summary-badge" class:warning={filteredCount === 0}>
					{#if filteredCount > 0}
						<CheckCircle2 size={16} color="#00a884" />
						<span>Se exportarán <strong>{filteredCount}</strong> de {messages.length} mensajes seleccionados.</span>
					{:else}
						<AlertCircle size={16} color="#dc2626" />
						<span>No hay mensajes que coincidan con los filtros seleccionados.</span>
					{/if}
				</div>

				{#if isExporting}
					<div class="progress-section">
						<div class="progress-bar-bg">
							<div class="progress-bar-fill" style="width: {exportProgress}%"></div>
						</div>
						<span class="progress-text">Generando PDF de alta calidad... {exportProgress}%</span>
					</div>
				{/if}
			</div>

			<footer class="modal-footer">
				<button class="btn-cancel" on:click={onClose} disabled={isExporting}>
					Cancelar
				</button>
				<button class="btn-export" on:click={handleConfirm} disabled={isExporting || filteredCount === 0}>
					<Download size={16} />
					{isExporting ? 'Generando...' : 'Descargar PDF'}
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed; inset: 0; z-index: 9999;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(6px);
		display: flex; align-items: center; justify-content: center;
		padding: 16px;
	}
	.modal-card {
		background: #ffffff; border-radius: 18px;
		width: 100%; max-width: 520px;
		box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
		overflow: hidden; display: flex; flex-direction: column;
		max-height: 90vh;
	}
	:global([data-theme="dark"]) .modal-card {
		background: #111b21; color: #e9edef;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.modal-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 18px 20px 14px 20px; border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global([data-theme="dark"]) .modal-header {
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
	.header-title {
		display: flex; align-items: center; gap: 12px;
	}
	.header-title h3 {
		font-size: 17px; font-weight: 700; margin: 0; line-height: 1.2;
	}
	.header-sub {
		font-size: 12px; color: #8696a0; font-weight: 500;
	}
	.close-btn {
		background: transparent; border: none; cursor: pointer;
		padding: 6px; border-radius: 50%; color: #667781;
		display: flex; align-items: center; justify-content: center;
	}
	.close-btn:hover { background: rgba(0, 0, 0, 0.05); }

	/* Pestañas */
	.nav-tabs {
		display: flex; background: #f0f2f5; padding: 4px; gap: 4px;
		border-bottom: 1px solid rgba(0,0,0,0.06);
	}
	:global([data-theme="dark"]) .nav-tabs {
		background: #1f2c33; border-bottom-color: rgba(255,255,255,0.06);
	}
	.tab-btn {
		flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
		padding: 9px 8px; font-size: 12.5px; font-weight: 600; color: #667781;
		border: none; background: transparent; border-radius: 8px; cursor: pointer;
		transition: all 0.15s;
	}
	:global([data-theme="dark"]) .tab-btn { color: #8696a0; }
	.tab-btn.active {
		background: #ffffff; color: #00a884; box-shadow: 0 2px 6px rgba(0,0,0,0.08);
	}
	:global([data-theme="dark"]) .tab-btn.active {
		background: #111b21; color: #00a884;
	}

	.modal-body {
		padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;
		overflow-y: auto; flex: 1;
	}
	.tab-desc {
		font-size: 13px; color: #54656f; margin: 0 0 6px 0; line-height: 1.4;
	}
	:global([data-theme="dark"]) .tab-desc { color: #8696a0; }

	.section-title {
		font-size: 13px; font-weight: 700; color: #111b21;
		display: flex; align-items: center; gap: 6px; text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	:global([data-theme="dark"]) .section-title { color: #e9edef; }

	.options-group {
		display: flex; flex-direction: column; gap: 8px;
	}
	.option-card {
		display: flex; align-items: flex-start; gap: 10px;
		padding: 10px 12px; border-radius: 10px;
		border: 1.5px solid #e9edef; cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	:global([data-theme="dark"]) .option-card { border-color: #222d34; }
	.option-card.selected {
		border-color: #00a884; background: rgba(0, 168, 132, 0.06);
	}
	.option-card input { margin-top: 3px; accent-color: #00a884; }
	.option-content { display: flex; flex-direction: column; gap: 1px; }
	.option-title { font-size: 13.5px; font-weight: 600; }
	.option-sub { font-size: 11.5px; color: #8696a0; }

	.date-range-box {
		display: flex; gap: 12px; padding: 12px;
		background: #f7f8fa; border-radius: 10px;
	}
	:global([data-theme="dark"]) .date-range-box { background: #182229; }
	.date-field {
		flex: 1; display: flex; flex-direction: column; gap: 4px;
	}
	.date-field label { font-size: 11.5px; font-weight: 600; color: #54656f; }
	:global([data-theme="dark"]) .date-field label { color: #8696a0; }
	.date-field input {
		padding: 7px 9px; border-radius: 6px; border: 1px solid #d1d5db;
		font-size: 12.5px; outline: none; background: white;
	}
	:global([data-theme="dark"]) .date-field input {
		background: #111b21; border-color: #2a3942; color: white;
	}

	.filter-header {
		display: flex; align-items: center; justify-content: space-between; margin-top: 6px;
	}
	.quick-toggle-btns { display: flex; gap: 8px; }
	.btn-text-sm {
		background: none; border: none; font-size: 11.5px; color: #00a884;
		font-weight: 600; cursor: pointer; padding: 2px 4px;
	}
	.btn-text-sm:hover { text-decoration: underline; }

	.filter-grid {
		display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
	}
	.check-box {
		display: flex; align-items: center; gap: 8px; padding: 8px 10px;
		border-radius: 8px; border: 1px solid #e9edef; background: #fafafa;
		font-size: 12px; cursor: pointer; user-select: none;
		transition: all 0.15s;
	}
	:global([data-theme="dark"]) .check-box {
		background: #182229; border-color: #222d34; color: #e9edef;
	}
	.check-box.checked {
		border-color: rgba(0, 168, 132, 0.5); background: rgba(0, 168, 132, 0.05);
	}
	.check-box input { accent-color: #00a884; }

	/* Estilos de formulario pericial */
	.form-group {
		display: flex; flex-direction: column; gap: 4px;
	}
	.form-group label {
		font-size: 12px; font-weight: 600; color: #54656f;
	}
	:global([data-theme="dark"]) .form-group label { color: #8696a0; }
	.form-group input {
		padding: 8px 11px; border-radius: 8px; border: 1px solid #d1d5db;
		font-size: 13px; outline: none; background: white;
	}
	:global([data-theme="dark"]) .form-group input {
		background: #182229; border-color: #2a3942; color: white;
	}

	.toggle-row {
		display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
		border-radius: 10px; background: #f7f8fa; cursor: pointer;
	}
	:global([data-theme="dark"]) .toggle-row { background: #182229; }
	.toggle-row input { margin-top: 3px; accent-color: #00a884; }
	.toggle-info { display: flex; flex-direction: column; gap: 2px; }
	.toggle-title { font-size: 13px; font-weight: 600; }
	.toggle-sub { font-size: 11px; color: #8696a0; }

	/* Selector de temas */
	.theme-selector { display: flex; gap: 10px; }
	.theme-card {
		flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
		padding: 10px 6px; border-radius: 10px; border: 2px solid #e9edef;
		cursor: pointer; font-size: 11.5px; font-weight: 600; text-align: center;
	}
	:global([data-theme="dark"]) .theme-card { border-color: #222d34; }
	.theme-card.selected { border-color: #00a884; background: rgba(0, 168, 132, 0.05); }
	.theme-preview {
		width: 100%; height: 38px; border-radius: 6px; padding: 4px;
		display: flex; flex-direction: column; justify-content: center; gap: 3px;
	}
	.dark-prev { background: #0d1418; }
	.light-prev { background: #e5ddd5; }
	.legal-prev { background: #ffffff; border: 1px solid #d1d5db; }
	.prev-bubble { height: 8px; border-radius: 4px; width: 65%; }
	.dark-prev .in { background: #1f2c33; align-self: flex-start; }
	.dark-prev .out { background: #005c4b; align-self: flex-end; }
	.light-prev .in { background: #ffffff; align-self: flex-start; }
	.light-prev .out { background: #d9fdd3; align-self: flex-end; }
	.legal-prev .in { background: #f3f4f6; border: 1px solid #ccc; align-self: flex-start; }
	.legal-prev .out { background: #e5e7eb; border: 1px solid #ccc; align-self: flex-end; }

	.summary-badge {
		display: flex; align-items: center; gap: 8px;
		padding: 10px 14px; background: rgba(0, 168, 132, 0.08);
		border-radius: 10px; font-size: 12.5px; color: #005c4b;
	}
	.summary-badge.warning {
		background: rgba(220, 38, 38, 0.08); color: #dc2626;
	}
	:global([data-theme="dark"]) .summary-badge {
		background: rgba(0, 168, 132, 0.15); color: #25d366;
	}
	:global([data-theme="dark"]) .summary-badge.warning {
		background: rgba(220, 38, 38, 0.15); color: #f87171;
	}

	.progress-section {
		display: flex; flex-direction: column; gap: 6px; margin-top: 4px;
	}
	.progress-bar-bg {
		width: 100%; height: 8px; background: #e9edef;
		border-radius: 4px; overflow: hidden;
	}
	:global([data-theme="dark"]) .progress-bar-bg { background: #222d34; }
	.progress-bar-fill {
		height: 100%; background: #00a884; transition: width 0.2s ease;
	}
	.progress-text {
		font-size: 12px; color: #8696a0; text-align: center;
	}

	.modal-footer {
		display: flex; align-items: center; justify-content: flex-end; gap: 10px;
		padding: 14px 20px; border-top: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global([data-theme="dark"]) .modal-footer {
		border-top-color: rgba(255, 255, 255, 0.08);
	}
	.btn-cancel {
		padding: 9px 16px; border-radius: 10px; border: 1px solid #d1d5db;
		background: transparent; font-size: 13.5px; font-weight: 500;
		cursor: pointer; color: #54656f;
	}
	:global([data-theme="dark"]) .btn-cancel {
		border-color: #2a3942; color: #8696a0;
	}
	.btn-export {
		padding: 9px 18px; border-radius: 10px; border: none;
		background: #00a884; color: white; font-size: 13.5px; font-weight: 600;
		cursor: pointer; display: flex; align-items: center; gap: 8px;
		transition: background 0.15s;
	}
	.btn-export:hover:not(:disabled) { background: #008f6f; }
	.btn-export:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
