<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { CheckCircle, AlertCircle, Info, X } from 'lucide-svelte';

	export let message: string = '';
	export let type: 'success' | 'error' | 'info' = 'info';
	export let details: string = '';
	export let onClose: () => void = () => {};
	export let duration: number = 5000; // auto-close after 5s

	let visible = true;

	$: icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;
	$: color = type === 'success' ? '#00a884' : type === 'error' ? '#dc2626' : '#4f46e5';

	if (duration > 0) {
		setTimeout(() => {
			visible = false;
			setTimeout(onClose, 300);
		}, duration);
	}

	function handleClose() {
		visible = false;
		setTimeout(onClose, 300);
	}
</script>

{#if visible}
	<div
		class="toast"
		style="border-left-color: {color}"
		in:fly={{ y: -20, duration: 300 }}
		out:fade={{ duration: 200 }}
		role="alert"
	>
		<div class="toast-icon" style="color: {color}">
			<svelte:component this={icon} size={20} />
		</div>
		<div class="toast-content">
			<p class="toast-message">{message}</p>
			{#if details}
				<p class="toast-details">{details}</p>
			{/if}
		</div>
		<button class="toast-close" on:click={handleClose} aria-label="Cerrar">
			<X size={16} />
		</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		top: 24px;
		right: 24px;
		min-width: 320px;
		max-width: 480px;
		background: white;
		border-radius: 12px;
		border-left: 4px solid;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 16px;
		z-index: 10000;
		backdrop-filter: blur(8px);
	}

	.toast-icon {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.toast-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.toast-message {
		font-size: 14px;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.toast-details {
		font-size: 13px;
		color: #6b7280;
		margin: 0;
		line-height: 1.5;
	}

	.toast-close {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca3af;
		transition: all 0.15s;
	}

	.toast-close:hover {
		background: #f3f4f6;
		color: #111827;
	}
</style>
