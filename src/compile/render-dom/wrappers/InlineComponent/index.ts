import Wrapper from '../shared/Wrapper';
import Renderer from '../../Renderer';
import Block from '../../Block';
import Node from '../../../nodes/shared/Node';
import InlineComponent from '../../../nodes/InlineComponent';
import FragmentWrapper from '../Fragment';
import { quoteNameIfNecessary, quotePropIfNecessary } from '../../../../utils/quoteIfNecessary';
import stringifyProps from '../../../../utils/stringifyProps';
import addToSet from '../../../../utils/addToSet';
import deindent from '../../../../utils/deindent';
import Attribute from '../../../nodes/Attribute';
import getObject from '../../../../utils/getObject';
import Binding from '../../../nodes/Binding';

export default class InlineComponentWrapper extends Wrapper {
	var: string;
	_slots: Set<string>; // TODO lose the underscore
	node: InlineComponent;
	fragment: FragmentWrapper;

	constructor(
		renderer: Renderer,
		block: Block,
		parent: Wrapper,
		node: InlineComponent,
		stripWhitespace: boolean,
		nextSibling: Wrapper
	) {
		super(renderer, block, parent, node);

		this.cannotUseInnerHTML();

		if (this.node.expression) {
			block.addDependencies(this.node.expression.dependencies);
		}

		this.node.attributes.forEach(attr => {
			block.addDependencies(attr.dependencies);
		});

		this.node.bindings.forEach(binding => {
			if (binding.isContextual) {
				// we need to ensure that the each block creates a context including
				// the list and the index, if they're not otherwise referenced
				const { name } = getObject(binding.expression.node);
				const eachBlock = block.contextOwners.get(name);

				eachBlock.hasBinding = true;
			}

			block.addDependencies(binding.expression.dependencies);
		});

		this.node.handlers.forEach(handler => {
			if (handler.expression) {
				block.addDependencies(handler.expression.dependencies);
			}
		});

		this.var = (
			this.node.name === 'svelte:self' ? renderer.component.name :
			this.node.name === 'svelte:component' ? 'switch_instance' :
			this.node.name
		).toLowerCase();

		if (this.node.children.length) {
			this._slots = new Set(['default']);
			this.fragment = new FragmentWrapper(renderer, block, node.children, this, stripWhitespace, nextSibling);
		}

		block.addOutro();
	}

	render(
		block: Block,
		parentNode: string,
		parentNodes: string
	) {
		const { renderer } = this;
		const { component } = renderer;

		const name = this.var;

		const componentInitProperties = [];

		if (this.fragment) {
			const slots = Array.from(this._slots).map(name => `${quoteNameIfNecessary(name)}: @createFragment()`);
			componentInitProperties.push(`slots: { ${slots.join(', ')} }`);

			this.fragment.nodes.forEach((child: Wrapper) => {
				child.render(block, `${this.var}.$$slotted.default`, 'nodes');
			});
		}

		const statements: string[] = [];

		const name_initial_data = block.getUniqueName(`${name}_initial_data`);
		const name_changes = block.getUniqueName(`${name}_changes`);
		let name_updating: string;

		const updates: string[] = [];

		const usesSpread = !!this.node.attributes.find(a => a.isSpread);

		const attributeObject = usesSpread
			? '{}'
			: stringifyProps(
				this.node.attributes.map(attr => `${quoteNameIfNecessary(attr.name)}: ${attr.getValue()}`)
			);

		if (this.node.attributes.length || this.node.bindings.length) {
			componentInitProperties.push(`props: ${name_initial_data}`);
		}

		if (!usesSpread && (this.node.attributes.filter(a => a.isDynamic).length || this.node.bindings.length)) {
			updates.push(`var ${name_changes} = {};`);
		}

		if (this.node.attributes.length) {
			if (usesSpread) {
				const levels = block.getUniqueName(`${this.var}_spread_levels`);

				const initialProps = [];
				const changes = [];

				const allDependencies = new Set();

				this.node.attributes.forEach(attr => {
					addToSet(allDependencies, attr.dependencies);
				});

				this.node.attributes.forEach(attr => {
					const { name, dependencies } = attr;

					// TODO probably need to account for $$BAIL$$ but
					// not totally sure how. will come back to it
					const condition = dependencies.size > 0 && (dependencies.size !== allDependencies.size)
						? `(${[...dependencies].map(d => `changed.${d}`).join(' || ')})`
						: null;

					if (attr.isSpread) {
						const value = attr.expression.snippet;
						initialProps.push(value);

						changes.push(condition ? `${condition} && ${value}` : value);
					} else {
						const obj = `{ ${quoteNameIfNecessary(name)}: ${attr.getValue()} }`;
						initialProps.push(obj);

						changes.push(condition ? `${condition} && ${obj}` : obj);
					}
				});

				block.builders.init.addBlock(deindent`
					var ${levels} = [
						${initialProps.join(',\n')}
					];
				`);

				statements.push(deindent`
					for (var #i = 0; #i < ${levels}.length; #i += 1) {
						${name_initial_data} = @assign(${name_initial_data}, ${levels}[#i]);
					}
				`);

				const conditions = [...allDependencies].map(dep => `changed.${dep}`).join(' || ');

				updates.push(deindent`
					var ${name_changes} = ${allDependencies.size === 1 ? `${conditions}` : `(${conditions})`} ? @getSpreadUpdate(${levels}, [
						${changes.join(',\n')}
					]) : {};
				`);
			} else {
				this.node.attributes
					.filter((attribute: Attribute) => attribute.isDynamic)
					.forEach((attribute: Attribute) => {
						if (attribute.dependencies.size > 0) {
							updates.push(deindent`
								if (${[...attribute.dependencies]
									.map(dependency => `changed.${dependency}`)
									.join(' || ')}) ${name_changes}${quotePropIfNecessary(attribute.name)} = ${attribute.getValue()};
							`);
						}
					});
				}
		}

		const munged_bindings = this.node.bindings.map(binding => {
			const name = component.getUniqueName(`${this.var}_${binding.name}_binding`);
			component.declarations.push(name);

			const contextual_dependencies = Array.from(binding.expression.contextual_dependencies);
			const dependencies = Array.from(binding.expression.dependencies);

			let lhs = component.source.slice(binding.expression.node.start, binding.expression.node.end).trim();

			if (binding.isContextual && binding.expression.node.type === 'Identifier') {
				// bind:x={y} — we can't just do `y = x`, we need to
				// to `array[index] = x;
				const { name } = binding.expression.node;
				const { object, property, snippet } = block.bindings.get(name)();
				lhs = snippet;
				contextual_dependencies.push(object, property);
			}

			const args = ['value'];
			if (contextual_dependencies.length > 0) {
				args.push(`{ ${contextual_dependencies.join(', ')} }`);

				block.builders.init.addBlock(deindent`
					function ${name}(value) {
						ctx.${name}.call(null, value, ctx);
					}
				`);
			}

			const body = deindent`
				function ${name}(${args.join(', ')}) {
					${lhs} = value;
					${dependencies.map(dep => `$$make_dirty('${dep}');`)}
				}
			`;

			component.partly_hoisted.push(body);

			return contextual_dependencies.length > 0
				? `${this.var}.$$bind('${binding.name}', ${name});`
				: `${this.var}.$$bind('${binding.name}', ctx.${name});`;
		});

		if (this.node.bindings.length) {
			name_updating = block.alias(`${name}_updating`);
			block.addVariable(name_updating, '{}');

			this.node.bindings.forEach((binding: Binding) => {
				statements.push(deindent`
					if (${binding.expression.snippet} !== void 0) {
						${name_initial_data}${quotePropIfNecessary(binding.name)} = ${binding.expression.snippet};
						${name_updating}${quotePropIfNecessary(binding.name)} = true;
					}`
				);

				updates.push(deindent`
					if (!${name_updating}${quotePropIfNecessary(binding.name)} && ${[...binding.expression.dependencies].map((dependency: string) => `changed.${dependency}`).join(' || ')}) {
						${name_changes}${quotePropIfNecessary(binding.name)} = ${binding.expression.snippet};
						${name_updating}${quotePropIfNecessary(binding.name)} = ${binding.expression.snippet} !== void 0;
					}
				`);
			});

			block.maintainContext = true; // TODO put this somewhere more logical
		}

		const munged_handlers = this.node.handlers.map(handler => {
			if (handler.expression) {
				handler.expression.declarations.forEach(declaration => {
					block.builders.init.addBlock(declaration);
				});
			}

			return `${name}.$on("${handler.name}", ${handler.snippet});`;
		});

		if (this.node.name === 'svelte:component') {
			const switch_value = block.getUniqueName('switch_value');
			const switch_props = block.getUniqueName('switch_props');

			const { snippet } = this.node.expression;

			block.builders.init.addBlock(deindent`
				var ${switch_value} = ${snippet};

				function ${switch_props}(ctx) {
					${(this.node.attributes.length || this.node.bindings.length) && deindent`
					var ${name_initial_data} = ${attributeObject};`}
					${statements}
					return {
						${componentInitProperties.join(',\n')}
					};
				}

				if (${switch_value}) {
					var ${name} = new ${switch_value}(${switch_props}(ctx));

					${munged_bindings}
					${munged_handlers}
				}
			`);

			block.builders.create.addLine(
				`if (${name}) ${name}.$$fragment.c();`
			);

			if (parentNodes && this.renderer.options.hydratable) {
				block.builders.claim.addLine(
					`if (${name}) ${name}.$$fragment.l(${parentNodes});`
				);
			}

			block.builders.mount.addBlock(deindent`
				if (${name}) {
					${name}.$$mount(${parentNode || '#target'}, ${parentNode ? 'null' : 'anchor'});
					${this.node.ref && `#component.$$refs.${this.node.ref.name} = ${name};`}
				}
			`);

			const anchor = this.getOrCreateAnchor(block, parentNode, parentNodes);
			const updateMountNode = this.getUpdateMountNode(anchor);

			if (updates.length) {
				block.builders.update.addBlock(deindent`
					${updates}
				`);
			}

			block.builders.update.addBlock(deindent`
				if (${switch_value} !== (${switch_value} = ${snippet})) {
					if (${name}) {
						@groupOutros();
						const old_component = ${name};
						old_component.$$fragment.o(() => {
							old_component.$destroy();
						});
					}

					if (${switch_value}) {
						${name} = new ${switch_value}(${switch_props}(ctx));

						${munged_bindings}
						${munged_handlers}

						${name}.$$fragment.c();

						${this.fragment && this.fragment.nodes.map(child => child.remount(name))}
						${name}.$$mount(${updateMountNode}, ${anchor});

						${this.node.handlers.map(handler => deindent`
							${name}.$on("${handler.name}", ${handler.var});
						`)}

						${this.node.ref && `#component.$$refs.${this.node.ref.name} = ${name};`}
					} else {
						${name} = null;
						${this.node.ref && deindent`
						if (#component.$$refs.${this.node.ref.name} === ${name}) {
							#component.$$refs.${this.node.ref.name} = null;
						}`}
					}
				}
			`);

			if (updates.length) {
				block.builders.update.addBlock(deindent`
					else if (${switch_value}) {
						${name}.$set(${name_changes});
						${this.node.bindings.length && `${name_updating} = {};`}
					}
				`);
			}

			block.builders.destroy.addLine(`if (${name}) ${name}.$destroy(${parentNode ? '' : 'detach'});`);
		} else {
			const expression = this.node.name === 'svelte:self'
				? component.name
				: `ctx.${this.node.name}`;

			block.builders.init.addBlock(deindent`
				${(this.node.attributes.length || this.node.bindings.length) && deindent`
				var ${name_initial_data} = ${attributeObject};`}
				${statements}
				var ${name} = new ${expression}({
					${componentInitProperties.join(',\n')}
				});

				${munged_bindings}
				${munged_handlers}

				${this.node.ref && `#component.$$refs.${this.node.ref.name} = ${name};`}
			`);

			block.builders.create.addLine(`${name}.$$fragment.c();`);

			if (parentNodes && this.renderer.options.hydratable) {
				block.builders.claim.addLine(
					`${name}.$$fragment.l(${parentNodes});`
				);
			}

			block.builders.mount.addLine(
				`${name}.$$mount(${parentNode || '#target'}, ${parentNode ? 'null' : 'anchor'});`
			);

			if (updates.length) {
				block.builders.update.addBlock(deindent`
					${updates}
					${name}.$set(${name_changes});
					${this.node.bindings.length && `${name_updating} = {};`}
				`);
			}

			block.builders.destroy.addLine(deindent`
				${name}.$destroy(${parentNode ? '' : 'detach'});
				${this.node.ref && `if (#component.$$refs.${this.node.ref.name} === ${name}) #component.$$refs.${this.node.ref.name} = null;`}
			`);
		}

		block.builders.outro.addLine(
			`if (${name}) ${name}.$$fragment.o(#outrocallback);`
		);
	}

	remount(name: string) {
		return `${this.var}.$$mount(${name}.$$slotted.default, null);`;
	}
}

function isComputed(node: Node) {
	while (node.type === 'MemberExpression') {
		if (node.computed) return true;
		node = node.object;
	}

	return false;
}