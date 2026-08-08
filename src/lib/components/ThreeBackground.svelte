<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ParticleField } from '$three/ParticleField';

	let canvasEl: HTMLCanvasElement;
	let field: ParticleField | null = null;

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!prefersReducedMotion) {
			field = new ParticleField(canvasEl);
		}
	});

	onDestroy(() => {
		field?.destroy();
	});
</script>

<canvas bind:this={canvasEl} class="bg-canvas" aria-hidden="true"></canvas>

<style>
	.bg-canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
		/* Viñeta: concentra el foco en los paneles de cristal, no en el fondo */
		mask-image: radial-gradient(ellipse at center, black 40%, transparent 92%);
	}
</style>
