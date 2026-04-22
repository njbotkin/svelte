<script>
	import { skipHydration } from 'svelte';

	let { show } = $props();
</script>

{#snippet inner()}
	<section>
		<h1>static heading</h1>
		<p>nested content</p>
	</section>
{/snippet}

<main>
	{#if show}
		<em>branch-a</em>
		{@render skipHydration(inner)}
	{:else}
		<em>branch-b</em>
	{/if}
	<span>after</span>
</main>
