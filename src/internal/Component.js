import { after_render, flush, intro, schedule_update } from './scheduler.js';
import { set_current_component } from './lifecycle.js'
import { is_function, run, run_all, noop } from './utils.js';
import { blankObject } from './utils.js';

export class $$Component {
	constructor(options) {
		this.$$beforeRender = [];
		this.$$onMount = [];
		this.$$afterRender = [];
		this.$$onDestroy = [];

		this.$$bindings = blankObject();
		this.$$callbacks = blankObject();
		this.$$slotted = options.slots || {};

		set_current_component(this);
		const [get_state, inject_props, inject_refs] = this.$$init(
			key => {
				this.$$make_dirty(key);
				if (this.$$bindings[key]) this.$$bindings[key](get_state()[key]);
			}
		);

		this.$$ = { get_state, inject_props, inject_refs };

		this.$$refs = {};

		this.$$dirty = null;
		this.$$bindingGroups = []; // TODO find a way to not have this here?

		if (options.props) {
			this.$$.inject_props(options.props);
		}

		run_all(this.$$beforeRender);
		this.$$fragment = this.$$create_fragment(this, this.$$.get_state());

		if (options.target) {
			intro.enabled = !!options.intro;
			this.$$mount(options.target, options.anchor, options.hydrate);

			flush();
			intro.enabled = true;
		}
	}

	$destroy() {
		this.$$destroy(true);
		this.$$update = this.$$destroy = noop;
	}

	$on(type, callback) {
		const callbacks = (this.$$callbacks[type] || (this.$$callbacks[type] = []));
		callbacks.push(callback);

		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	$set(values) {
		if (this.$$) {
			this.$$.inject_props(values);
			for (const key in values) this.$$make_dirty(key);
		}
	}

	$$bind(name, callback) {
		this.$$bindings[name] = callback;
		callback(this.$$.get_state()[name]);
	}

	$$destroy(detach) {
		if (this.$$) {
			this.$$fragment.d(detach);
			run_all(this.$$onDestroy);

			// TODO null out other refs, including this.$$ (but need to
			// preserve final state?)
			this.$$onDestroy = this.$$fragment = null;
		}
	}

	$$make_dirty(key) {
		if (!this.$$dirty) {
			schedule_update(this);
			this.$$dirty = {};
		}
		this.$$dirty[key] = true;
	}

	$$mount(target, anchor, hydrate) {
		if (hydrate) {
			this.$$fragment.l(target.childNodes);
		} else {
			this.$$fragment.c();
			this.$$fragment[this.$$fragment.i ? 'i' : 'm'](target, anchor);
		}

		this.$$.inject_refs(this.$$refs);

		// onMount happens after the initial afterRender. Because
		// afterRender callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterRender callbacks
		after_render(() => {
			const onDestroy = this.$$onMount.map(run).filter(is_function);
			if (this.$$onDestroy) {
				this.$$onDestroy.push(...onDestroy);
			} else {
				// Edge case — component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(onDestroy);
			}
			this.$$onMount = [];
		});

		this.$$afterRender.forEach(after_render);
	}

	$$update() {
		run_all(this.$$beforeRender);
		this.$$fragment.p(this.$$dirty, this.$$.get_state());
		this.$$.inject_refs(this.$$refs);
		this.$$dirty = null;

		this.$$afterRender.forEach(after_render);
	}
}

export class $$ComponentDev extends $$Component {
	constructor(options) {
		if (!options || !options.target) {
			throw new Error(`'target' is a required option`);
		}

		super(options);
		this.$$checkProps();
	}

	$destroy() {
		super.$destroy();
		this.$$destroy = () => {
			console.warn(`Component was already destroyed`);
		};
	}

	$$checkProps() {
		// noop by default
	}
}