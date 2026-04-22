import { flushSync } from 'svelte';
import { test } from '../../test';

export default test({
	compileOptions: {
		dev: true
	},
	snapshot(target) {
		// capture the DOM nodes that were server-rendered inside the skip region
		const section = target.querySelector('section');
		return {
			section,
			h1: section?.querySelector('h1'),
			// the `<p>` inside the skip region was rendered on the server with count=0
			// and must remain the same node reference after hydration (no re-render)
			p: section?.querySelector('p')
		};
	},
	test(assert, target) {
		const section = /** @type {HTMLElement} */ (target.querySelector('section'));
		const p = /** @type {HTMLParagraphElement} */ (section.querySelector('p'));
		const outer = /** @type {HTMLSpanElement} */ (target.querySelector('span'));
		const button = /** @type {HTMLButtonElement} */ (target.querySelector('button'));

		// pre-click: outer reflects count=0, inner preserves server output
		assert.equal(outer.textContent, 'outer: 0');
		assert.equal(p.textContent, 'count is 0');

		button.click();
		flushSync();

		// outer reactivity works, inner is frozen because its effects never ran
		assert.equal(outer.textContent, 'outer: 1');
		assert.equal(p.textContent, 'count is 0');
	}
});
