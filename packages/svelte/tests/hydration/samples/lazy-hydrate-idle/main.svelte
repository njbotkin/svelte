<script>
	import { lazyHydrate } from 'svelte';

	let count = $state(0);
</script>

{#snippet inner()}
	<p>inner: {count}</p>
{/snippet}

<main>
	<button onclick={() => count++}>+</button>
	<span>outer: {count}</span>
	{@render lazyHydrate(inner, { on: 'idle' })}
</main>
