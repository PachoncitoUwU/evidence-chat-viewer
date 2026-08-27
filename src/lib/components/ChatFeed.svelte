<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Search, Settings, MoreVertical, Image } from 'lucide-svelte';
	import MessageBubble from './MessageBubble.svelte';
	import AppearancePanel from './AppearancePanel.svelte';
	import MediaGallery from './MediaGallery.svelte';
	import { chatConfig } from '$lib/stores/chatConfig';
	import { hiddenMediaStore } from '$lib/stores/hiddenMediaStore';
	import type { ChatMessage, ChatMeta, EvidenceFilter } from '$types/chat.types';

	export let meta: ChatMeta | null = null;
	export let messages: ChatMessage[] = [];
	export let allMessages: ChatMessage[] = []; // todos, sin filtrar — para la galería multimedia
	export let filter: EvidenceFilter;
	export let onSearchChange: (q: string) => void = () => {};
	export let participants: string[] = [];
	export let currentOwner: string | null = null;
	export let onSwapRoles: (() => void) | null = null;
	export let onSetOwner: ((name: string) => void) | null = null;

	export let targetJumpDate: string | null = null;

	let feedEl: HTMLDivElement;
	let showAppearance = false;
	let showGallery = false;

	$: cfg = $chatConfig;
	$: darkMode = cfg.darkMode === 'dark';

	// Group messages by date, excluding hidden messages
	type DatePill = { type: 'date'; label: string; key: string };
	type MsgItem  = { type: 'msg'; msg: ChatMessage };
	type FeedItem = DatePill | MsgItem;

	const CHUNK_SIZE = 250;
	let renderCount = CHUNK_SIZE;

	$: visibleMessages = messages.filter(m => !$hiddenMediaStore.has(m.id));
	$: groupedAll = buildGrouped(visibleMessages);
	$: showLoadMore = groupedAll.length > renderCount;
	$: remainingCount = groupedAll.length - renderCount;
	$: displayedGrouped = showLoadMore ? groupedAll.slice(groupedAll.length - renderCount) : groupedAll;

	function loadMoreMessages() {
		renderCount += CHUNK_SIZE;
	}

	function loadAllMessages() {
		renderCount = groupedAll.length;
	}

	function buildGrouped(msgs: ChatMessage[]): FeedItem[] {
		const result: FeedItem[] = [];
		let lastDate = '';
		for (const msg of msgs) {
			if (msg.date !== lastDate) {
				lastDate = msg.date;
				const [y, mo, d] = msg.date.split('-');
				const dt = new Date(Number(y), Number(mo) - 1, Number(d));
				const label = dt.toLocaleDateString('es-ES', {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				});
				result.push({ type: 'date', label, key: msg.date });
			}
			result.push({ type: 'msg', msg });
		}
		return result;
	}

	// Scroll to bottom when messages change
	async function scrollToBottom() {
		await tick();
		if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
	}

	async function jumpToDate(dateStr: string) {
		if (!dateStr || !groupedAll.length) return;
		
		// Encontrar el primer elemento que coincide con la fecha
		const targetIndex = groupedAll.findIndex(
			(item) => (item.type === 'date' && item.key.startsWith(dateStr)) || (item.type === 'msg' && item.msg.date.startsWith(dateStr))
		);

		if (targetIndex !== -1) {
			// Los mensajes se renderizan desde el final: slice(groupedAll.length - renderCount)
			// Para que targetIndex esté renderizado:
			const neededCount = groupedAll.length - targetIndex + 150;
			if (renderCount < neededCount) {
				renderCount = Math.min(groupedAll.length, Math.max(renderCount, neededCount));
			}
			await tick();
			
			const performScroll = () => {
				const el = document.getElementById(`date-pill-${dateStr}`) ||
					document.querySelector(`[data-date^="${dateStr}"]`) ||
					document.querySelector(`[data-date*="${dateStr}"]`) as HTMLElement | null;
					
				if (el && feedEl) {
					// Calcular offset dentro del contenedor con scroll
					const feedRect = feedEl.getBoundingClientRect();
					const elRect = el.getBoundingClientRect();
					const relativeTop = elRect.top - feedRect.top + feedEl.scrollTop;
					
					feedEl.scrollTo({
						top: Math.max(0, relativeTop - 30),
						behavior: 'smooth'
					});

					el.classList.add('jump-highlight');
					setTimeout(() => el.classList.remove('jump-highlight'), 2500);
					return true;
				}
				return false;
			};

			if (!performScroll()) {
				setTimeout(performScroll, 60);
				setTimeout(performScroll, 200);
			}
		}
	}

	$: if (targetJumpDate) {
		jumpToDate(targetJumpDate);
	}

	let lastMsgLength = 0;
	$: if (messages && messages.length !== lastMsgLength) {
		lastMsgLength = messages.length;
		renderCount = CHUNK_SIZE;
		if (!targetJumpDate) {
			scrollToBottom();
		}
	}
	onMount(() => {
		if (targetJumpDate) jumpToDate(targetJumpDate);
		else scrollToBottom();
	});

	// Background style: use chatBg from config or fallback to WhatsApp dark
	$: feedBg = cfg.chatBg || (darkMode ? '#0d1418' : '#e8ede9');

	// WhatsApp-style background pattern SVG
	const WA_PATTERN_LIGHT = `url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext y='60' font-size='42' opacity='0.04'%3E💬%3C/text%3E%3Ctext x='80' y='140' font-size='36' opacity='0.04'%3E❤️%3C/text%3E%3Ctext x='160' y='80' font-size='30' opacity='0.04'%3E😊%3C/text%3E%3Ctext x='220' y='200' font-size='40' opacity='0.04'%3E📱%3C/text%3E%3Ctext x='40' y='250' font-size='34' opacity='0.04'%3E✅%3C/text%3E%3C/svg%3E")`;
	const WA_PATTERN_DARK = `url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext y='60' font-size='42' opacity='0.03'%3E💬%3C/text%3E%3Ctext x='80' y='140' font-size='36' opacity='0.03'%3E❤️%3C/text%3E%3Ctext x='160' y='80' font-size='30' opacity='0.03'%3E😊%3C/text%3E%3Ctext x='220' y='200' font-size='40' opacity='0.03'%3E📱%3C/text%3E%3Ctext x='40' y='250' font-size='34' opacity='0.03'%3E✅%3C/text%3E%3C/svg%3E")`;

	$: feedBgStyle = `background-color:${feedBg}; background-image:${darkMode ? WA_PATTERN_DARK : WA_PATTERN_LIGHT}; --feed-font-size:${cfg.fontSize || 15}px;`;
</script>

{#if showAppearance}
	<AppearancePanel
		{participants}
		{currentOwner}
		{onSwapRoles}
		{onSetOwner}
		onClose={() => (showAppearance = false)}
	/>
{/if}

{#if showGallery}
	<MediaGallery
		messages={allMessages.length > 0 ? allMessages : messages}
		onClose={() => (showGallery = false)}
	/>
{/if}

<section class="feed-wrap" class:dark={darkMode} data-theme={darkMode ? 'dark' : 'light'}>
	<!-- ── Header (WhatsApp-style dark bar) ── -->
	<header class="feed-header" class:dark-header={darkMode}>
		<div class="header-left">
			{#if meta}
				<div class="avatar">
					{meta.title.slice(0, 1).toUpperCase()}
				</div>
				<div class="header-info">
					<span class="header-name">{meta.title}</span>
					<span class="header-sub">
						{meta.totalMessages} mensajes
						{#if meta.dateRangeStart} · {meta.dateRangeStart}{/if}
					</span>
				</div>
			{:else}
				<span class="header-name">Sin chat cargado</span>
			{/if}
		</div>

		<div class="header-actions">
			<!-- Font size controls -->
			<div class="font-control-stepper" title="Ajustar tamaño de letra en pantalla">
				<button class="step-btn" on:click={() => chatConfig.update({ fontSize: Math.max(11, (cfg.fontSize || 15) - 1) })} title="Reducir tamaño de letra">-</button>
				<span class="step-val">{(cfg.fontSize || 15)}px</span>
				<button class="step-btn" on:click={() => chatConfig.update({ fontSize: Math.min(24, (cfg.fontSize || 15) + 1) })} title="Aumentar tamaño de letra">+</button>
			</div>

			<!-- Search box -->
			<div class="search-box">
				<Search size={14} color={darkMode ? '#8696a0' : '#54656f'} />
				<input
					type="text"
					placeholder="Buscar…"
					value={filter.searchQuery}
					on:input={(e) => onSearchChange(e.currentTarget.value)}
				/>
				{#if filter.searchQuery}
					<span class="result-badge">{messages.length}</span>
				{/if}
			</div>

			<!-- Media gallery button -->
			<button
				class="header-icon-btn"
				on:click={() => (showGallery = !showGallery)}
				title="Ver archivos multimedia"
				aria-label="Galería multimedia"
			>
				<Image size={18} color={darkMode ? '#aebac1' : '#54656f'} />
			</button>

			<!-- Appearance button -->
			<button
				class="header-icon-btn"
				on:click={() => (showAppearance = !showAppearance)}
				title="Apariencia"
				aria-label="Abrir panel de apariencia"
			>
				<Settings size={18} color={darkMode ? '#aebac1' : '#54656f'} />
			</button>

			<button class="header-icon-btn" title="Más opciones">
				<MoreVertical size={18} color={darkMode ? '#aebac1' : '#54656f'} />
			</button>
		</div>
	</header>

	<!-- ── Messages feed ── -->
	<div class="feed-scroll" bind:this={feedEl} style={feedBgStyle}>
		{#if displayedGrouped.length === 0}
			<div class="empty-state">
				{#if filter.searchQuery || filter.day || filter.month}
					<p>Sin resultados para este filtro.</p>
				{:else}
					<p>No hay mensajes en este chat.</p>
				{/if}
			</div>
		{:else}
			{#if showLoadMore}
				<div class="load-more-bar">
					<button class="load-more-btn" on:click={loadMoreMessages}>
						⬆️ Cargar 250 mensajes anteriores ({remainingCount.toLocaleString('es-ES')} restantes)
					</button>
					<button class="load-all-btn" on:click={loadAllMessages}>
						⚡ Cargar todos ({groupedAll.length.toLocaleString('es-ES')})
					</button>
				</div>
			{/if}

			{#each displayedGrouped as item (item.type === 'msg' ? item.msg.id : item.key)}
				{#if item.type === 'date'}
					<div class="date-pill" id={`date-pill-${item.key}`} data-date={item.key}>
						<span>{item.label}</span>
					</div>
				{:else if item.type === 'msg'}
					<div data-date={item.msg.date}>
						<MessageBubble
							message={item.msg}
							{darkMode}
							bubbleOutColor={cfg.bubbleOutColor}
							bubbleInColor={cfg.bubbleInColor}
							emojiStyle={cfg.emojiStyle}
							isGroup={participants.length > 2}
						/>
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- ── Footer (hash) ── -->
	{#if meta?.sourceHash}
		<footer class="feed-footer" class:dark-footer={darkMode}>
			<span class="ledger-label">SHA-256: {meta.sourceHash.slice(0, 32)}…</span>
		</footer>
	{/if}
</section>

<style>
	.feed-wrap {
		flex: 1;
		width: 100%;
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		height: 100%;
		border-radius: 0;
		overflow: hidden;
		background: var(--void);
		border: none;
	}
	.feed-wrap.dark {
		background: #0d1418;
	}

	:global(.jump-highlight) {
		animation: pulseHighlight 1.5s ease;
	}
	@keyframes pulseHighlight {
		0% { transform: scale(1); filter: brightness(1); }
		50% { transform: scale(1.04); filter: brightness(1.2) drop-shadow(0 0 8px rgba(0, 168, 132, 0.6)); }
		100% { transform: scale(1); filter: brightness(1); }
	}

	/* ── Header ── */
	.feed-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 16px;
		background: #f0f2f5;
		border-bottom: 1px solid rgba(0,0,0,0.08);
		flex-shrink: 0;
		height: 60px;
	}
	.feed-header.dark-header {
		background: #202c33;
		border-bottom-color: rgba(255,255,255,0.06);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		flex: 1;
	}

	.avatar {
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, #00a884, #025144);
		color: white;
		font-weight: 700;
		font-size: 17px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.header-name {
		font-size: 15px;
		font-weight: 600;
		color: #111b21;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.feed-header.dark-header .header-name { color: #e9edef; }

	.header-sub {
		font-size: 12px;
		color: #667781;
	}
	.feed-header.dark-header .header-sub { color: #8696a0; }

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px;
		border-radius: 8px;
		background: #ffffff;
		border: 1px solid rgba(0,0,0,0.1);
		min-width: 180px;
	}
	.feed-header.dark-header .search-box {
		background: #2a3942;
		border-color: rgba(255,255,255,0.08);
	}
	.search-box input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		font-size: 13px;
		color: #111b21;
		font-family: inherit;
		min-width: 0;
	}
	.feed-header.dark-header .search-box input {
		color: #e9edef;
	}
	.search-box input::placeholder { color: #8696a0; }

	.result-badge {
		background: #00a884;
		color: white;
		font-size: 10px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 999px;
	}

	.header-icon-btn {
		width: 38px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background 0.15s;
	}
	.header-icon-btn:hover {
		background: rgba(0,0,0,0.07);
	}
	.feed-header.dark-header .header-icon-btn:hover {
		background: rgba(255,255,255,0.07);
	}

	/* ── Feed scroll area ── */
	.feed-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		background-size: 300px 300px;
	}

	/* ── Date separator pills ── */
	.date-pill {
		display: flex;
		justify-content: center;
		margin: 12px 0 8px;
	}
	.date-pill span {
		background: rgba(11, 20, 26, 0.5);
		color: #e9edef;
		font-size: 12px;
		padding: 5px 14px;
		border-radius: 8px;
		font-family: system-ui, sans-serif;
		backdrop-filter: blur(4px);
	}
	/* Light mode date pills */
	:global([data-theme="light"]) .date-pill span {
		background: rgba(225, 230, 227, 0.92);
		color: #54656f;
	}

	/* ── Empty state ── */
	.empty-state {
		margin: auto;
		color: #8696a0;
		font-size: 14px;
		text-align: center;
		padding: 48px 16px;
	}

	/* ── Footer ── */
	.feed-footer {
		display: flex;
		align-items: center;
		padding: 5px 16px;
		background: #f0f2f5;
		border-top: 1px solid rgba(0,0,0,0.07);
		flex-shrink: 0;
	}
	.feed-footer.dark-footer {
		background: #202c33;
		border-top-color: rgba(255,255,255,0.06);
	}
	.ledger-label {
		font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 10px;
		letter-spacing: 0.05em;
		color: #8696a0;
	}

	/* ── Scrollbar ── */
	.feed-scroll::-webkit-scrollbar { width: 5px; }
	.feed-scroll::-webkit-scrollbar-track { background: transparent; }
	.feed-scroll::-webkit-scrollbar-thumb {
		background: rgba(0,0,0,0.18);
		border-radius: 999px;
	}

	.load-more-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin: 12px auto;
		padding: 4px 12px;
	}
	.load-more-btn {
		background: #00a884;
		color: #ffffff;
		border: none;
		border-radius: 20px;
		padding: 7px 16px;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0,0,0,0.2);
		transition: all 0.15s ease;
	}
	.load-more-btn:hover {
		background: #008f70;
		transform: translateY(-1px);
	}
	.load-all-btn {
		background: rgba(0,0,0,0.06);
		color: #54656f;
		border: 1px solid rgba(0,0,0,0.12);
		border-radius: 20px;
		padding: 6px 12px;
		font-size: 11.5px;
		cursor: pointer;
	}
	:global([data-theme="dark"] .load-all-btn) {
		background: rgba(255,255,255,0.08);
		color: #8696a0;
		border-color: rgba(255,255,255,0.12);
	}

	.font-control-stepper {
		display: flex;
		align-items: center;
		background: rgba(0,0,0,0.06);
		border-radius: 16px;
		padding: 2px 6px;
		gap: 2px;
	}
	:global([data-theme="dark"] .font-control-stepper) {
		background: rgba(255,255,255,0.1);
	}
	.step-btn {
		border: none;
		background: transparent;
		color: currentColor;
		font-weight: bold;
		cursor: pointer;
		padding: 0 5px;
		font-size: 13px;
		border-radius: 4px;
	}
	.step-btn:hover {
		background: rgba(0,0,0,0.1);
	}
	.step-val {
		font-size: 11px;
		font-family: monospace;
		padding: 0 2px;
	}
</style>
