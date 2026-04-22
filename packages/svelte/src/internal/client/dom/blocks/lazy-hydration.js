/** @import { Snippet } from 'svelte' */
/** @import { TemplateNode } from '#client' */

import { ELEMENT_NODE } from '#client/constants';
import {
	find_skip_end,
	hydrate_node,
	hydrating,
	set_hydrate_node,
	set_hydrating
} from '../hydration.js';
import { get_next_sibling } from '../operations.js';
import { effect_root, user_effect } from '../../reactivity/effects.js';
import { untrack } from '../../runtime.js';
import * as w from '../../warnings.js';

/**
 * @typedef LazyHydrateOptions
 * @property {'visible' | 'idle' | ((ready: () => void) => void | (() => void))} [on]
 *   When to run the deferred hydration. Defaults to `'visible'`.
 *     - `'visible'` — hydrate when the region's first element scrolls into view
 *       (via `IntersectionObserver`). Falls back to immediate hydration in
 *       environments without `IntersectionObserver`.
 *     - `'idle'` — hydrate on the next idle callback (`requestIdleCallback`).
 *       Falls back to `setTimeout(0)` in environments without it.
 *     - A function — called with a `ready` callback; invoke `ready()` whenever
 *       the region should hydrate. May return a cleanup function that runs if
 *       the parent unmounts before hydration happens.
 * @property {IntersectionObserverInit} [visibleOptions]
 *   Passed through to `IntersectionObserver` when `on: 'visible'`.
 */

/**
 * Render a snippet whose output is hydrated lazily on the client, instead of
 * during the initial hydration pass. On the server and during client-only
 * mount the snippet is rendered normally. During hydration the snippet's
 * server-rendered DOM is kept as-is, and the snippet's effects/listeners are
 * wired up later, when a configurable trigger fires (the region becomes
 * visible, the browser goes idle, or a user-supplied callback fires).
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
 * {@render lazyHydrate(heavy, { on: ready => window.addEventListener('click', ready, { once: true }) })}
 * ```
 *
 * @template {unknown[]} Params
 * @param {TemplateNode} anchor
 * @param {() => Snippet<Params>} get_snippet
 * @param {() => LazyHydrateOptions | undefined} [get_options]
 * @param {{ [K in keyof Params]: () => Params[K] }} params
 * @returns {void}
 */
export function lazyHydrate(anchor, get_snippet, get_options, ...params) {
	if (!hydrating) {
		// Client-only mount: render the snippet immediately, nothing to defer.
		var snippet_now = get_snippet();
		// @ts-expect-error forwarding the anchor and parameter thunks
		snippet_now(anchor, ...params);
		return;
	}

	// Capture the preserved DOM range. `hydrate_node` is the `<!--[~-->` comment.
	var start = hydrate_node;
	var first = /** @type {TemplateNode} */ (get_next_sibling(start));
	var end = find_skip_end(start);

	// Advance past the region so the rest of the parent hydrates normally.
	set_hydrate_node(/** @type {TemplateNode} */ (get_next_sibling(end)));

	// Capture the snippet and options now; the thunks read reactive state that
	// might change before the trigger fires, and we want a stable snapshot.
	var snippet = get_snippet();
	var options = get_options ? get_options() : undefined;

	user_effect(() => {
		/** @type {(() => void) | null} */
		var destroy_root = null;

		var run = () => {
			if (destroy_root !== null) return;

			// Create an isolated effect tree for the deferred region so its effects
			// have a proper parent. When the outer user_effect is torn down, we
			// destroy this tree in the cleanup.
			destroy_root = effect_root(() => {
				// Re-enter hydration mode briefly so the snippet's template helpers
				// walk the server-rendered DOM rather than creating new nodes.
				var was_hydrating = hydrating;
				var prev_node = hydrate_node;

				set_hydrating(true);
				set_hydrate_node(first);

				try {
					untrack(() => {
						// @ts-expect-error forwarding the anchor and parameter thunks
						snippet(anchor, ...params);
					});
				} catch (error) {
					// DOM diverged from what the snippet expects; warn and bail.
					// The server-rendered DOM stays in place.
					w.hydration_mismatch();
					// eslint-disable-next-line no-console
					console.warn('Deferred hydration failed:', error);
				} finally {
					set_hydrating(was_hydrating);
					set_hydrate_node(prev_node);
				}
			});
		};

		var cancel = schedule_trigger(options, first, run);

		return () => {
			cancel();
			destroy_root?.();
		};
	});
}

/**
 * @param {LazyHydrateOptions | undefined} options
 * @param {TemplateNode} target
 * @param {() => void} ready
 * @returns {() => void} cleanup
 */
function schedule_trigger(options, target, ready) {
	var on = options?.on ?? 'visible';

	if (on === 'idle') {
		if (typeof requestIdleCallback === 'function') {
			var idle_id = requestIdleCallback(ready);
			return () => cancelIdleCallback(idle_id);
		}
		var timeout_id = setTimeout(ready, 0);
		return () => clearTimeout(timeout_id);
	}

	if (on === 'visible') {
		if (
			typeof IntersectionObserver === 'function' &&
			target != null &&
			target.nodeType === ELEMENT_NODE
		) {
			var observer = new IntersectionObserver((entries) => {
				for (var i = 0; i < entries.length; i += 1) {
					if (entries[i].isIntersecting) {
						observer.disconnect();
						ready();
						return;
					}
				}
			}, options?.visibleOptions);
			observer.observe(/** @type {Element} */ (target));
			return () => observer.disconnect();
		}
		// no IntersectionObserver or no element to observe — hydrate immediately
		ready();
		return noop;
	}

	if (typeof on === 'function') {
		var cleanup = on(ready);
		return typeof cleanup === 'function' ? cleanup : noop;
	}

	ready();
	return noop;
}

function noop() {}
