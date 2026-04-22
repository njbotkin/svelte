import { flushSync } from 'svelte';
import { test } from '../../test';

export default test({
	html: `<button>+</button> <span>outer: 0</span> <p>inner: 0</p>`,

	ssrHtml: `<button>+</button> <span>outer: 0</span> <!--[~--><p>inner: 0</p><!--~]-->`,

	test({ assert, target, variant }) {
		const button = /** @type {HTMLButtonElement} */ (target.querySelector('button'));
		const outer = /** @type {HTMLSpanElement} */ (target.querySelector('span'));
		const inner = /** @type {HTMLParagraphElement} */ (target.querySelector('p'));

		button.click();
		flushSync();

		assert.equal(outer.textContent, 'outer: 1');

		if (variant === 'hydrate') {
			// inner snippet was skipped on hydration; its effects never ran
			assert.equal(inner.textContent, 'inner: 0');
		} else {
			// on pure CSR mount the snippet runs normally and is reactive
			assert.equal(inner.textContent, 'inner: 1');
		}
	}
});
