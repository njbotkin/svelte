<script>
	import { skipHydration } from 'svelte';

	let count = $state(0);
</script>

{#snippet heavy()}
	<section>
		<h1>static</h1>
		<p>count is {count}</p>
	</section>
{/snippet}

<main>
	<button onclick={() => count++}>increment</button>
	<span>outer: {count}</span>
	{@render skipHydration(heavy)}
</main>
