<script>
	import { lazyHydrate } from 'svelte';

	let { trigger } = $props();
	let count = $state(0);
</script>

{#snippet inner()}
	<p>inner: {count}</p>
	<button class="inner" onclick={() => count++}>inner +</button>
{/snippet}

<main>
	<span>outer: {count}</span>
	<button class="outer" onclick={() => count++}>outer +</button>
	{@render lazyHydrate(inner, { on: trigger })}
</main>
