/** @import { Snippet } from 'svelte' */
/** @import { Renderer } from '../renderer.js' */
/** @import { LazyHydrateOptions } from '../../client/dom/blocks/lazy-hydration.js' */

import { SKIP_CLOSE, SKIP_OPEN } from '../hydration.js';

/**
 * Render a snippet whose rendered output is hydrated lazily on the client
 * (e.g. when it scrolls into view, or when the browser is idle). On the server
 * this is identical to `skipHydration` — the snippet is rendered once, wrapped
 * in markers that the client uses to locate the region later.
 *
 * ```svelte
 * <script>
 *   import { lazyHydrate } from 'svelte';
 * </script>
 *
 * {#snippet heavy()}
 *   <section>...lots of interactive content...</section>
 * {/snippet}
 *
 * {@render lazyHydrate(heavy)}                              // default: on visible
 * {@render lazyHydrate(heavy, { on: 'visible' })}
 * {@render lazyHydrate(heavy, { on: 'idle' })}
 * {@render lazyHydrate(heavy, { on: ready => { ... } })}
 * ```
 *
 * @template {unknown[]} Params
 * @param {Renderer} renderer
 * @param {Snippet<Params>} snippet
 * @param {LazyHydrateOptions | undefined} [_options]
 * @param {Params} params
 * @returns {void}
 */
export function lazyHydrate(renderer, snippet, _options, ...params) {
	renderer.push(SKIP_OPEN);
	// @ts-expect-error the public snippet type hides the renderer argument
	snippet(renderer, ...params);
	renderer.push(SKIP_CLOSE);
}
