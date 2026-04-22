<script>
	import { skipHydration } from 'svelte';

	let count = $state(0);
</script>

{#snippet inner()}
	<p>inner: {count}</p>
{/snippet}

<button onclick={() => count++}>+</button>
<span>outer: {count}</span>
{@render skipHydration(inner)}
