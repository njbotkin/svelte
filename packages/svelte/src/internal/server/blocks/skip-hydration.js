/** @import { Snippet } from 'svelte' */
/** @import { Renderer } from '../renderer.js' */

import { SKIP_CLOSE, SKIP_OPEN } from '../hydration.js';

/**
 * Render a snippet whose output should be skipped by the hydration pass on the client.
 * The content is still rendered on the server (and on client-side mount), but the hydration
 * walker will treat the region as opaque: no effects, listeners, or bindings inside the
 * snippet are attached when hydrating.
 *
 * ```svelte
 * <script>
 *   import { skipHydration } from 'svelte';
 * </script>
 *
 * {#snippet heavy()}
 *   <div>...lots of static content...</div>
 * {/snippet}
 *
 * {@render skipHydration(heavy)}
 * ```
 *
 * @template {unknown[]} Params
 * @param {Renderer} renderer
 * @param {Snippet<Params>} snippet
 * @param {Params} params
 * @returns {void}
 */
export function skipHydration(renderer, snippet, ...params) {
	renderer.push(SKIP_OPEN);
	// @ts-expect-error the public snippet type hides the renderer argument
	snippet(renderer, ...params);
	renderer.push(SKIP_CLOSE);
}
