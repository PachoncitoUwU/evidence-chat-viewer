<script lang="ts">
	import { FolderOpen, Plus, MessageCircle, Search, LogIn, ShieldCheck, Trash2, AlertTriangle } from 'lucide-svelte';
	import type { EvidenceCase } from '$types/chat.types';
	import { authStore } from '$lib/stores/authStore';
	import { APP_VERSION, BUILD_COMMIT, BUILD_DATE } from '$lib/version';

	export let cases: EvidenceCase[] = [];
	export let activeCaseId: string | null = null;
	export let onSelectCase: (id: string) => void = () => {};
	export let onNewCase: () => void = () => {};
	export let onOpenAuth: () => void = () => {};
	export let onDeleteCase: (id: string) => void = () => {};
	export let onSyncToCloud: (id: string) => void = () => {};
	export let isSyncingCloud: boolean = false;
	export let onToggleCollapse: () => void = () => {};

	let filterQuery = '';
	let targetDeleteCase: EvidenceCase | null = null;
	let confirmTypedName = '';
	let isDeleting = false;

	$: user = $authStore;
	$: visibleCases = cases.filter((c) =>
		c.name.toLowerCase().includes(filterQuery.trim().toLowerCase())
	);

	function openDeleteConfirm(c: EvidenceCase, e: MouseEvent) {
		e.stopPropagation();
		targetDeleteCase = c;
		confirmTypedName = '';
	}

	function closeDeleteModal() {
		targetDeleteCase = null;
		confirmTypedName = '';
		isDeleting = false;
	}

	async function confirmDelete() {
		if (!targetDeleteCase) return;
		isDeleting = true;
		await onDeleteCase(targetDeleteCase.id);
		closeDeleteModal();
	}
</script>

<aside class="sidebar glass-panel">
	<header class="sidebar-header">
		<div class="brand">
			<div class="brand-icon">
				<MessageCircle size={18} color="white" strokeWidth={2} />
			</div>
			<h1 class="brand-title">Evidence Viewer</h1>
		</div>

		{#if user && user.isLoggedIn}
			<button class="user-pill-btn" on:click={onOpenAuth} title="Perfil de usuario activo">
				<ShieldCheck size={14} color="#00a884" />
				<span class="user-pill-name">@{user.username}</span>
			</button>
		{:else}
			<button class="login-btn-header" on:click={onOpenAuth} title="Iniciar sesión para guardar en la nube">
				<LogIn size={14} />
				<span>Iniciar sesión</span>
			</button>
		{/if}
	</header>

	<div class="search-box">
		<Search size={14} color="var(--ink-40)" />
		<input type="text" placeholder="Buscar chat…" bind:value={filterQuery} />
	</div>

	<button class="new-btn" on:click={onNewCase}>
		<Plus size={16} strokeWidth={2.5} />
		<span>Cargar otro chat</span>
	</button>

	<nav class="case-list">
		{#each visibleCases as c (c.id)}
			<div
				class="case-item-row"
				class:is-active={c.id === activeCaseId}
				on:click={() => onSelectCase(c.id)}
				role="button"
				tabindex="0"
			>
				<FolderOpen size={15} strokeWidth={1.8} color={c.id === activeCaseId ? 'var(--brass)' : 'var(--ink-40)'} />
				<div class="case-text">
					<span class="case-name">{c.name}</span>
					{#if c.description}
						<span class="case-meta">{c.description}</span>
					{/if}
				</div>

				{#if user && user.isLoggedIn}
					<button
						class="sync-cloud-btn"
						on:click={(e) => { e.stopPropagation(); onSyncToCloud(c.id); }}
						disabled={isSyncingCloud}
						title="Forzar respaldo de este chat en Supabase Cloud"
					>
						☁️
					</button>
				{/if}

				<button
					class="delete-chat-btn"
					on:click={(e) => openDeleteConfirm(c, e)}
					title="Eliminar este chat definitivamente de la nube y del perfil"
				>
					<Trash2 size={14} color="#ef4444" />
				</button>
			</div>
		{:else}
			<div class="empty-state">
				{#if user && user.isLoggedIn}
					<p>☁️ No hay chats guardados en tu perfil <strong>@{user.username}</strong>.</p>
					<p>Carga un archivo arriba para respaldarlo automáticamente en la nube.</p>
				{:else}
					<p class="empty-title">🔒 ¿Iniciaste sesión?</p>
					<p class="empty-desc">Para ver los chats que subiste desde otro dispositivo o computador:</p>
					<button class="login-prompt-btn" on:click={onOpenAuth}>
						<LogIn size={15} />
						<span>Iniciar sesión con tu usuario y PIN</span>
					</button>
				{/if}
			</div>
		{/each}
	</nav>

	<footer class="sidebar-footer">
		<div class="version-footer-badge" title="Fecha de actualización: {BUILD_DATE}">
			<span class="pulse-dot"></span>
			<span>Vercel en vivo: <strong>{APP_VERSION}</strong> (<code class="commit-code">{BUILD_COMMIT}</code>)</span>
		</div>
	</footer>
</aside>

{#if targetDeleteCase}
	<div class="modal-backdrop" on:click|self={closeDeleteModal} role="dialog">
		<div class="delete-modal">
			<div class="modal-header-danger">
				<AlertTriangle size={24} color="#ef4444" />
				<h3>¿Eliminar chat de la nube?</h3>
			</div>
			<p class="modal-desc">
				Estás a punto de eliminar definitivamente el chat <strong>"{targetDeleteCase.name}"</strong> de tu perfil y de la base de datos de Supabase.
			</p>
			<p class="modal-warning">
				⚠️ <strong>Atención:</strong> Esta acción no se puede deshacer. Todos los mensajes e imágenes asociados serán borrados de la nube.
			</p>
			<div class="modal-actions">
				<button class="btn-cancel" on:click={closeDeleteModal} disabled={isDeleting}>
					Cancelar
				</button>
				<button class="btn-delete-confirm" on:click={confirmDelete} disabled={isDeleting}>
					{#if isDeleting}
						<span>Eliminando de Supabase...</span>
					{:else}
						<span>🗑️ Sí, eliminar chat</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.sidebar {
		grid-area: left;
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-3);
		background: white;
	}

	.sidebar-header {
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--hairline);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 4px;
	}

	.brand-icon {
		width: 32px;
		height: 32px;
		background: var(--brass);
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.brand-name {
		font-size: var(--text-base);
		font-weight: 700;
		color: var(--ink-100);
		letter-spacing: -0.02em;
	}

	.brand-subtitle {
		font-size: var(--text-xs);
		color: var(--ink-40);
		margin-left: 42px;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		background: var(--void);
		border: 1px solid var(--hairline);
	}
	.search-box input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--ink-100);
		font-size: var(--text-sm);
	}
	.search-box input::placeholder {
		color: var(--ink-40);
	}

	.new-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 9px;
		border-radius: var(--radius-sm);
		background: var(--brass);
		color: white;
		font-size: var(--text-sm);
		font-weight: 600;
		transition: opacity var(--dur-fast), transform var(--dur-fast);
	}
	.new-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.backup-box {
		display: flex;
		gap: 6px;
		margin-top: 4px;
	}
	.backup-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 600;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		border: 1px solid rgba(0,0,0,0.1);
		transition: all var(--dur-fast);
	}
	.backup-btn.export-btn {
		background: rgba(79, 70, 229, 0.1);
		color: #4f46e5;
		border-color: rgba(79, 70, 229, 0.25);
	}
	.backup-btn.import-btn {
		background: rgba(37, 211, 102, 0.1);
		color: #00a884;
		border-color: rgba(37, 211, 102, 0.25);
	}
	.backup-btn:hover {
		transform: translateY(-1px);
		filter: brightness(1.05);
	}

	.case-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.case-item-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		border-radius: var(--radius-sm);
		text-align: left;
		transition: background var(--dur-fast);
		border: 1px solid transparent;
		cursor: pointer;
		position: relative;
	}
	.case-item-row:hover {
		background: var(--void);
	}
	.case-item-row.is-active {
		background: var(--brass-dim);
		border-color: rgba(79, 70, 229, 0.2);
	}

	.delete-chat-btn {
		opacity: 0;
		transition: opacity 0.15s ease;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		margin-left: auto;
		flex-shrink: 0;
	}
	.case-item-row:hover .delete-chat-btn {
		opacity: 1;
	}
	.delete-chat-btn:hover {
		background: rgba(239, 68, 68, 0.15);
	}

	/* Modal de eliminación */
	.modal-backdrop {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.6);
		backdrop-filter: blur(4px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.delete-modal {
		background: white;
		border-radius: 12px;
		width: 100%;
		max-width: 440px;
		padding: 24px;
		box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.modal-header-danger {
		display: flex;
		align-items: center;
		gap: 10px;
		color: #ef4444;
	}
	.modal-header-danger h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: #111827;
	}
	.modal-desc {
		font-size: 14px;
		color: #374151;
		line-height: 1.5;
		margin: 0;
	}
	.modal-warning {
		font-size: 12.5px;
		background: #fef2f2;
		color: #991b1b;
		border: 1px solid #fecaca;
		padding: 10px 12px;
		border-radius: 8px;
		margin: 0;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 8px;
	}
	.btn-cancel {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 8px 16px;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-delete-confirm {
		background: #ef4444;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-delete-confirm:hover {
		background: #dc2626;
	}

	.case-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.case-name {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink-100);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.case-meta {
		font-size: var(--text-2xs);
		color: var(--ink-40);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty-state {
		padding: var(--space-4) var(--space-2);
		font-size: var(--text-xs);
		color: var(--ink-40);
		line-height: 1.7;
		text-align: center;
	}

	.user-bar {
		margin-bottom: 4px;
	}

	.login-trigger-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: rgba(37, 211, 102, 0.12);
		color: #128c7e;
		font-weight: 600;
		font-size: var(--text-xs);
		border: 1px dashed rgba(37, 211, 102, 0.4);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.login-trigger-btn:hover {
		background: rgba(37, 211, 102, 0.2);
		border-style: solid;
	}

	.user-chip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		background: var(--void, #f9fafb);
		border: 1px solid var(--hairline, #e5e7eb);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background 0.2s ease;
	}
	.user-chip:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.user-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.user-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.user-tag {
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--ink-100);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-status {
		font-size: var(--text-2xs, 0.7rem);
		color: #128c7e;
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.version-pill {
		margin-left: auto;
		background: #4f46e5;
		color: white;
		font-size: 10.5px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 12px;
		letter-spacing: 0.02em;
	}

	.commit-tag {
		font-family: monospace;
		color: #4f46e5;
		font-weight: 600;
	}

	.sidebar-footer {
		margin-top: auto;
		padding-top: 8px;
		border-top: 1px solid var(--hairline);
	}

	.version-footer-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--ink-60, #667781);
		background: var(--void, #f8fafc);
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--hairline, #e2e8f0);
	}

	.commit-code {
		font-family: monospace;
		font-weight: 600;
		color: #4f46e5;
		background: rgba(79, 70, 229, 0.08);
		padding: 1px 4px;
		border-radius: 4px;
	}

	.pulse-dot {
		width: 7px;
		height: 7px;
		background: #22c55e;
		border-radius: 50%;
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
		animation: pulseDot 2s infinite;
	}

	@keyframes pulseDot {
		0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
		70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
		100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
	}
</style>
