import { test } from '../../test';

export default test({
	compileOptions: { dev: true },
	// server renders with show=true (skip region rendered)
	server_props: { show: true },
	// client hydrates with show=false (skip region must be torn down)
	props: { show: false },
	test(assert, target) {
		// after hydration, only the else branch remains
		assert.htmlEqual(
			target.innerHTML,
			`<main><em>branch-b</em><!----><span>after</span></main>`
		);
	}
});
