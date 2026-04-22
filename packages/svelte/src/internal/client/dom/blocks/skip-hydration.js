/** @import { Snippet } from 'svelte' */
/** @import { TemplateNode } from '#client' */

import { find_skip_end, hydrate_node, hydrating, set_hydrate_node } from '../hydration.js';
import { get_next_sibling } from '../operations.js';

/**
 * Render a snippet whose output should be skipped by the hydration pass.
 *
 * On the server and during client-side mount the inner snippet is rendered normally.
 * During hydration the DOM range that the snippet produced on the server is walked over
 * without invoking the snippet: no effects, listeners, or bindings inside the snippet are
 * attached, which can save meaningful hydration work for static-heavy regions (icons,
 * rendered markdown, embedded docs, large tables, etc.).
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
 * @param {TemplateNode} anchor
 * @param {() => Snippet<Params>} get_snippet
 * @param {{ [K in keyof Params]: () => Params[K] }} params
 * @returns {void}
 */
export function skipHydration(anchor, get_snippet, ...params) {
	if (hydrating) {
		// `hydrate_node` points at the `<!--[~-->` comment emitted by the server
		// version of `skipHydration`. Advance past the matching `<!--~]-->`.
		var end = find_skip_end(hydrate_node);
		set_hydrate_node(/** @type {TemplateNode} */ (get_next_sibling(end)));
	} else {
		// `{@render}` arguments are compiled to thunks; invoke the thunk to get the snippet
		var snippet = get_snippet();
		// @ts-expect-error forwarding the anchor and parameter thunks
		snippet(anchor, ...params);
	}
}
