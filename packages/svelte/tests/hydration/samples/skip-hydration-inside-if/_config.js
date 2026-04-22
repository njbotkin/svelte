import { flushSync } from 'svelte';
import { test } from '../../test';

export default test({
	compileOptions: { dev: true },
	props: { show: true },
	snapshot(target) {
		// capture the node rendered inside the skip region; it should be preserved across hydration
		return { p: target.querySelector('p') };
	},
	test(assert, target) {
		const outer = /** @type {HTMLSpanElement} */ (target.querySelector('span'));
		const inner = /** @type {HTMLParagraphElement} */ (target.querySelector('p'));
		const button = /** @type {HTMLButtonElement} */ (target.querySelector('button'));

		assert.equal(outer.textContent, 'outer: 0');
		assert.equal(inner.textContent, 'inner: 0');

		button.click();
		flushSync();

		// reactivity for state outside the skip region still flows
		assert.equal(outer.textContent, 'outer: 1');
		// skip region was not hydrated, so its contents stay as server-rendered
		assert.equal(inner.textContent, 'inner: 0');
	}
});
