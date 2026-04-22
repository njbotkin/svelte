<script>
	import { lazyHydrate } from 'svelte';

	let { trigger = () => {} } = $props();
	let count = $state(0);
</script>

{#snippet inner()}
	<p>inner: {count}</p>
{/snippet}

<button onclick={() => count++}>+</button>
<span>outer: {count}</span>
{@render lazyHydrate(inner, { on: trigger })}
