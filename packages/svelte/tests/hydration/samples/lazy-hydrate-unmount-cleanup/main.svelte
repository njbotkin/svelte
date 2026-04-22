<script>
	import { lazyHydrate } from 'svelte';

	let { trigger } = $props();
</script>

{#snippet inner()}
	<p>inner</p>
{/snippet}

<main>
	<span>outer</span>
	{@render lazyHydrate(inner, { on: trigger })}
</main>
