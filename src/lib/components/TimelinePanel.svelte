<script lang="ts">
	import { ChevronLeft, ChevronRight, FileDown, Calendar } from 'lucide-svelte';
	import type { DaySummary, EvidenceFilter } from '$types/chat.types';

	export let days: DaySummary[] = [];
	export let filter: EvidenceFilter;
	export let onFilterChange: (f: Partial<EvidenceFilter>) => void = () => {};
	export let onExportPdf: () => void = () => {};
	export let onToggleCollapse: () => void = () => {};

	const MONTHS = [
		'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
		'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
	];

	$: years = [...new Set(days.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a);
	$: activeYear = filter.year ?? years[0] ?? new Date().getFullYear();

	$: monthsWithData = new Set(
		days
			.filter((d) => Number(d.date.slice(0, 4)) === activeYear)
			.map((d) => Number(d.date.slice(5, 7)))
	);

	$: daysForActiveMonth =
		filter.month == null
			? []
			: days.filter(
					(d) =>
						Number(d.date.slice(0, 4)) === activeYear &&
						Number(d.date.slice(5, 7)) === filter.month
			  );

	function selectYear(y: number) {
		onFilterChange({ year: y, month: null, day: null });
	}
	function selectMonth(m: number) {
		onFilterChange({ month: filter.month === m ? null : m, day: null });
	}
	function selectDay(d: number) {
		onFilterChange({ day: filter.day === d ? null : d });
	}
</script>

<aside class="timeline glass-panel">
	<header class="tl-header">
		<div class="tl-title">
			<Calendar size={15} color="var(--brass)" />
			<span>Cronología</span>
		</div>

		<div class="year-nav">
			<button on:click={() => selectYear(activeYear - 1)} aria-label="Año anterior" disabled={!years.includes(activeYear - 1)}>
				<ChevronLeft size={14} />
			</button>
			<span class="year-label">{activeYear}</span>
			<button on:click={() => selectYear(activeYear + 1)} aria-label="Año siguiente" disabled={!years.includes(activeYear + 1)}>
				<ChevronRight size={14} />
			</button>
			<button class="collapse-header-btn" on:click={onToggleCollapse} title="Ocultar panel derecho (Modo Enfoque)" style="background: transparent; border: none; color: var(--ink-40, #888); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; margin-left: 6px;">
				▶
			</button>
		</div>
	</header>

	<div class="month-grid">
		{#each MONTHS as m, i}
			{@const monthNum = i + 1}
			<button
				class="month-btn"
				class:has-data={monthsWithData.has(monthNum)}
				class:is-active={filter.month === monthNum}
				disabled={!monthsWithData.has(monthNum)}
				on:click={() => selectMonth(monthNum)}
			>
				{m}
			</button>
		{/each}
	</div>

	{#if filter.month && daysForActiveMonth.length > 0}
		<div class="day-section">
			<p class="section-label">
				{MONTHS[(filter.month ?? 1) - 1]} {activeYear}
				— {daysForActiveMonth.length} días
			</p>
			<div class="day-list">
				{#each daysForActiveMonth as d (d.date)}
					{@const dayNum = Number(d.date.slice(8, 10))}
					<button
						class="day-chip"
						class:is-active={filter.day === dayNum}
						on:click={() => selectDay(dayNum)}
					>
						<span class="day-num">{String(dayNum).padStart(2, '0')}</span>
						<span class="day-count">{d.messageCount} mens.</span>
						{#if d.mediaCount > 0}
							<span class="media-badge">📎 {d.mediaCount}</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if filter.month || filter.day || filter.year}
		<button class="clear-btn" on:click={() => onFilterChange({ year: null, month: null, day: null })}>
			Limpiar filtros
		</button>
	{/if}

	<div class="tl-footer">
		<button class="export-btn" on:click={onExportPdf}>
			<FileDown size={14} strokeWidth={2} />
			<span>Exportar PDF</span>
		</button>
	</div>
</aside>

<style>
	.timeline {
		grid-area: right;
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		padding: var(--space-4);
		gap: var(--space-3);
		background: white;
	}

	.tl-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--hairline);
	}

	.tl-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink-100);
	}

	.year-nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.year-nav button {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		color: var(--ink-60);
		transition: background var(--dur-fast);
	}
	.year-nav button:hover:not(:disabled) {
		background: var(--void);
		color: var(--ink-100);
	}
	.year-nav button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.year-label {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--ink-100);
		min-width: 40px;
		text-align: center;
	}

	.month-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 5px;
	}

	.month-btn {
		padding: 7px 4px;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--ink-40);
		border: 1px solid transparent;
		transition: all var(--dur-fast);
		text-align: center;
	}
	.month-btn.has-data {
		color: var(--ink-100);
		border-color: var(--hairline);
		background: var(--void);
	}
	.month-btn.has-data:hover {
		border-color: var(--brass);
		color: var(--brass);
	}
	.month-btn:disabled {
		cursor: not-allowed;
	}
	.month-btn.is-active {
		background: var(--brass);
		border-color: var(--brass);
		color: white;
	}

	.day-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex: 1;
		min-height: 0;
	}

	.section-label {
		font-size: var(--text-xs);
		color: var(--ink-40);
		font-weight: 500;
	}

	.day-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
		overflow-y: auto;
	}

	.day-chip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--hairline);
		text-align: left;
		background: var(--void);
		font-size: var(--text-xs);
		transition: all var(--dur-fast);
	}
	.day-chip:hover {
		border-color: var(--brass);
	}
	.day-chip.is-active {
		background: var(--brass-dim);
		border-color: var(--brass);
		color: var(--brass);
	}

	.day-num {
		font-weight: 700;
		min-width: 22px;
		font-size: var(--text-sm);
	}
	.day-count {
		flex: 1;
		color: var(--ink-60);
	}
	.day-chip.is-active .day-count {
		color: var(--brass);
	}
	.media-badge {
		font-size: 11px;
		color: var(--ink-40);
	}

	.clear-btn {
		font-size: var(--text-xs);
		color: var(--ink-60);
		text-decoration: underline;
		text-align: center;
		padding: 4px;
	}
	.clear-btn:hover {
		color: var(--brass);
	}

	.tl-footer {
		margin-top: auto;
		padding-top: var(--space-3);
		border-top: 1px solid var(--hairline);
	}

	.export-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px;
		border-radius: var(--radius-sm);
		background: var(--void);
		border: 1px solid var(--hairline);
		color: var(--ink-60);
		font-size: var(--text-sm);
		font-weight: 500;
		transition: all var(--dur-fast);
	}
	.export-btn:hover {
		background: var(--brass-dim);
		border-color: var(--brass);
		color: var(--brass);
	}
</style>
