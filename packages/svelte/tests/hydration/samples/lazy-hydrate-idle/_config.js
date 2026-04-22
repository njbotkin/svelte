import { flushSync } from 'svelte';
import { test } from '../../test';

// the test runs in jsdom which doesn't expose requestIdleCallback; the
// `on: 'idle'` branch of `lazyHydrate` falls back to `setTimeout(0)`, so
// we let the macrotask queue drain to observe the deferred hydration.

export default test({
	compileOptions: { dev: true },
	async test(assert, target) {
		const outer = /** @type {HTMLSpanElement} */ (target.querySelector('span'));
		const button = /** @type {HTMLButtonElement} */ (target.querySelector('button'));
		const inner = /** @type {HTMLParagraphElement} */ (target.querySelector('p'));

		// synchronously after hydration, outer is wired up but inner is still frozen
		button.click();
		flushSync();
		assert.equal(outer.textContent, 'outer: 1');
		assert.equal(inner.textContent, 'inner: 0');

		// flush the setTimeout(0) that stands in for requestIdleCallback
		await new Promise((resolve) => setTimeout(resolve, 10));
		flushSync();

		// inner is hydrated now and reflects the current count
		assert.equal(inner.textContent, 'inner: 1');
	}
});
