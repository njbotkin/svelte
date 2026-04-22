<script>
	import { skipHydration } from 'svelte';

	let { show = true } = $props();
	let count = $state(0);
</script>

{#snippet inner()}
	<p>inner: {count}</p>
{/snippet}

<main>
	<button onclick={() => count++}>+</button>
	<span>outer: {count}</span>
	{#if show}
		<em>visible</em>
		{@render skipHydration(inner)}
	{/if}
</main>
