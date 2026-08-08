<script lang="ts">
	import { FolderOpen, Plus, MessageCircle, Search, User, LogIn, LogOut, ShieldCheck } from 'lucide-svelte';
	import type { EvidenceCase } from '$types/chat.types';
	import { authStore } from '$lib/stores/authStore';

	export let cases: EvidenceCase[] = [];
	export let activeCaseId: string | null = null;
	export let onSelectCase: (id: string) => void = () => {};
	export let onNewCase: () => void = () => {};
	export let onOpenAuth: () => void = () => {};

	let filterQuery = '';

	$: user = $authStore;
	$: visibleCases = cases.filter((c) =>
		c.name.toLowerCase().includes(filterQuery.trim().toLowerCase())
	);
</script>

<aside class="sidebar glass-panel">
	<header class="sidebar-header">
		<div class="brand">
			<div class="brand-icon">
				<MessageCircle size={18} color="white" strokeWidth={2} />
			</div>
			<span class="brand-name">Chat Viewer</span>
		</div>
		<p class="brand-subtitle">Visor de chats de WhatsApp</p>
	</header>

	<div class="user-bar">
		{#if user.isLoggedIn}
			<div class="user-chip" on:click={onOpenAuth} role="button" tabindex="0">
				<div class="user-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
				<div class="user-details">
					<span class="user-tag">@{user.username}</span>
					<span class="user-status"><ShieldCheck size={12} color="#25d366" /> Nube Sincronizada</span>
				</div>
			</div>
		{:else}
			<button class="login-trigger-btn" on:click={onOpenAuth}>
				<LogIn size={15} />
				<span>Iniciar Sesión / PIN</span>
			</button>
		{/if}
	</div>

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
			<button
				class="case-item"
				class:is-active={c.id === activeCaseId}
				on:click={() => onSelectCase(c.id)}
			>
				<FolderOpen size={15} strokeWidth={1.8} color={c.id === activeCaseId ? 'var(--brass)' : 'var(--ink-40)'} />
				<div class="case-text">
					<span class="case-name">{c.name}</span>
					{#if c.description}
						<span class="case-meta">{c.description}</span>
					{/if}
				</div>
			</button>
		{:else}
			<div class="empty-state">
				<p>Aún no hay chats cargados.</p>
				<p>Usa el botón de arriba para cargar un archivo de WhatsApp.</p>
			</div>
		{/each}
	</nav>
</aside>

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

	.case-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.case-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px;
		border-radius: var(--radius-sm);
		text-align: left;
		transition: background var(--dur-fast);
		border: 1px solid transparent;
	}
	.case-item:hover {
		background: var(--void);
	}
	.case-item.is-active {
		background: var(--brass-dim);
		border-color: rgba(79, 70, 229, 0.2);
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
</style>
