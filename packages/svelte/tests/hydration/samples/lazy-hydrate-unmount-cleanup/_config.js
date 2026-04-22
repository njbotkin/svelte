import { test } from '../../test';

let cleaned_up = false;
let trigger_called = false;

export default test({
	compileOptions: { dev: true },
	server_props: { trigger: () => {} },
	props: {
		trigger: (/** @type {() => void} */ _ready) => {
			trigger_called = true;
			// never actually call _ready during this test; return a cleanup fn
			return () => {
				cleaned_up = true;
			};
		}
	},
	before_test() {
		cleaned_up = false;
		trigger_called = false;
	},
	test(assert) {
		// trigger was registered during hydration
		assert.ok(trigger_called, 'trigger function was invoked');
		// cleanup has not fired yet
		assert.ok(!cleaned_up, 'cleanup has not yet fired');
	},
	after_test() {
		// after the shared runner calls component.$destroy(), cleanup should have fired
		if (!cleaned_up) {
			throw new Error('expected trigger cleanup to run on unmount');
		}
	}
});
