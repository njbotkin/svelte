import { flushSync } from 'svelte';
import { test } from '../../test';

/** @type {(() => void) | undefined} */
let ready;

export default test({
	html: `<button>+</button> <span>outer: 0</span> <p>inner: 0</p>`,
	ssrHtml: `<button>+</button> <span>outer: 0</span> <!--[~--><p>inner: 0</p><!--~]-->`,
	get props() {
		ready = undefined;
		return {
			trigger: (/** @type {() => void} */ r) => {
				ready = r;
			}
		};
	},
	// server render has no trigger so it just renders content inside markers
	server_props: { trigger: () => {} },

	test({ assert, target, variant }) {
		const button = /** @type {HTMLButtonElement} */ (target.querySelector('button'));
		const outer = /** @type {HTMLSpanElement} */ (target.querySelector('span'));
		const inner = /** @type {HTMLParagraphElement} */ (target.querySelector('p'));

		button.click();
		flushSync();

		assert.equal(outer.textContent, 'outer: 1');

		if (variant === 'hydrate') {
			// deferred: inner is still server HTML; effects not yet wired up
			assert.equal(inner.textContent, 'inner: 0');
			// fire the manual trigger
			ready?.();
			flushSync();
			assert.equal(inner.textContent, 'inner: 1');
		} else {
			// pure CSR mount: snippet runs immediately, fully reactive
			assert.equal(inner.textContent, 'inner: 1');
		}
	}
});
