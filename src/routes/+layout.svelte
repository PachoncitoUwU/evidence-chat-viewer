<script lang="ts">
	import '$styles/global.css';
	import { onMount } from 'svelte';

	onMount(() => {
		document.body.classList.add('dossier-theme');
	});
</script>

<slot />
