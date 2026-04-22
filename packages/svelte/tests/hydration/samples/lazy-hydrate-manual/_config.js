import { flushSync } from 'svelte';
import { test } from '../../test';

/** @type {(() => void) | undefined} */
let ready;

export default test({
	compileOptions: { dev: true },
	// server render ignores `trigger`, so this works on both sides
	server_props: { trigger: () => {} },
	props: {
		trigger: (/** @type {() => void} */ r) => {
			ready = r;
		}
	},
	before_test() {
		ready = undefined;
	},
	test(assert, target) {
		const outer_span = /** @type {HTMLSpanElement} */ (target.querySelector('span'));
		const outer_btn = /** @type {HTMLButtonElement} */ (target.querySelector('button.outer'));
		const inner_p_before = /** @type {HTMLParagraphElement} */ (target.querySelector('p'));
		const inner_btn_before = /** @type {HTMLButtonElement} */ (
			target.querySelector('button.inner')
		);

		// outer hydrated; inner still the server-rendered nodes but not yet wired up
		assert.equal(outer_span.textContent, 'outer: 0');
		assert.equal(inner_p_before.textContent, 'inner: 0');

		// clicking outer should flow through reactive state; because the inner
		// snippet has not been hydrated yet, its reactive binding isn't live and
		// the text should stay as server-rendered
		outer_btn.click();
		flushSync();
		assert.equal(outer_span.textContent, 'outer: 1');
		assert.equal(inner_p_before.textContent, 'inner: 0');

		// clicking the inner button before deferred hydration does nothing
		inner_btn_before.click();
		flushSync();
		assert.equal(outer_span.textContent, 'outer: 1');

		// fire the lazy-hydration trigger
		ready?.();
		flushSync();

		// the inner snippet is now hydrated; its binding should reflect current state
		const inner_p_after = /** @type {HTMLParagraphElement} */ (target.querySelector('p'));
		const inner_btn_after = /** @type {HTMLButtonElement} */ (
			target.querySelector('button.inner')
		);
		assert.equal(inner_p_after.textContent, 'inner: 1');

		// DOM nodes should be preserved (not re-created)
		assert.ok(inner_p_after === inner_p_before, 'inner <p> node preserved after lazy hydration');
		assert.ok(
			inner_btn_after === inner_btn_before,
			'inner <button> node preserved after lazy hydration'
		);

		// clicking the inner button now works
		inner_btn_after.click();
		flushSync();
		assert.equal(outer_span.textContent, 'outer: 2');
		assert.equal(inner_p_after.textContent, 'inner: 2');
	}
});
