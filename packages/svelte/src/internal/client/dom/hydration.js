/** @import { TemplateNode } from '#client' */

import { COMMENT_NODE } from '#client/constants';
import {
	HYDRATION_END,
	HYDRATION_ERROR,
	HYDRATION_SKIP_END,
	HYDRATION_SKIP_START,
	HYDRATION_START,
	HYDRATION_START_ELSE
} from '../../../constants.js';
import * as w from '../warnings.js';
import { get_next_sibling } from './operations.js';

/**
 * Use this variable to guard everything related to hydration code so it can be treeshaken out
 * if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
 */
export let hydrating = false;

/** @param {boolean} value */
export function set_hydrating(value) {
	hydrating = value;
}

/**
 * The node that is currently being hydrated. This starts out as the first node inside the opening
 * <!--[--> comment, and updates each time a component calls `$.child(...)` or `$.sibling(...)`.
 * When entering a block (e.g. `{#if ...}`), `hydrate_node` is the block opening comment; by the
 * time we leave the block it is the closing comment, which serves as the block's anchor.
 * @type {TemplateNode}
 */
export let hydrate_node;

/** @param {TemplateNode | null} node */
export function set_hydrate_node(node) {
	if (node === null) {
		w.hydration_mismatch();
		throw HYDRATION_ERROR;
	}

	return (hydrate_node = node);
}

export function hydrate_next() {
	return set_hydrate_node(get_next_sibling(hydrate_node));
}

/** @param {TemplateNode} node */
export function reset(node) {
	if (!hydrating) return;

	// If the node has remaining siblings, something has gone wrong
	if (get_next_sibling(hydrate_node) !== null) {
		w.hydration_mismatch();
		throw HYDRATION_ERROR;
	}

	hydrate_node = node;
}

/**
 * @param {HTMLTemplateElement} template
 */
export function hydrate_template(template) {
	if (hydrating) {
		// @ts-expect-error TemplateNode doesn't include DocumentFragment, but it's actually fine
		hydrate_node = template.content;
	}
}

export function next(count = 1) {
	if (hydrating) {
		var i = count;
		var node = hydrate_node;

		while (i--) {
			node = /** @type {TemplateNode} */ (get_next_sibling(node));
		}

		hydrate_node = node;
	}
}

/**
 * Skips or removes (depending on {@link remove}) all nodes starting at `hydrate_node` up until the next hydration end comment
 * @param {boolean} remove
 */
export function skip_nodes(remove = true) {
	var depth = 0;
	var node = hydrate_node;

	while (true) {
		if (node.nodeType === COMMENT_NODE) {
			var data = /** @type {Comment} */ (node).data;

			if (data === HYDRATION_END) {
				if (depth === 0) return node;
				depth -= 1;
			} else if (data === HYDRATION_SKIP_START) {
				// Treat user-defined skip regions as opaque: their contents may include
				// arbitrary comments (including `[` / `]`) that must not affect depth.
				node = find_skip_end(node);
			} else if (
				data === HYDRATION_START ||
				data === HYDRATION_START_ELSE ||
				// "[1", "[2", etc. for if blocks
				(data[0] === '[' && !isNaN(Number(data.slice(1))))
			) {
				depth += 1;
			}
		}

		var next = /** @type {TemplateNode} */ (get_next_sibling(node));
		if (remove) node.remove();
		node = next;
	}
}

/**
 * Given the `<!--[~-->` comment at the start of a hydration skip region, walk forward
 * to the matching `<!--~]-->` comment (handling nested skip regions) and return it.
 * @param {TemplateNode} start
 * @returns {TemplateNode}
 */
export function find_skip_end(start) {
	var depth = 1;
	var node = /** @type {TemplateNode | null} */ (get_next_sibling(start));

	while (node !== null) {
		if (node.nodeType === COMMENT_NODE) {
			var data = /** @type {Comment} */ (node).data;

			if (data === HYDRATION_SKIP_START) {
				depth += 1;
			} else if (data === HYDRATION_SKIP_END) {
				depth -= 1;
				if (depth === 0) return node;
			}
		}

		node = /** @type {TemplateNode | null} */ (get_next_sibling(node));
	}

	w.hydration_mismatch();
	throw HYDRATION_ERROR;
}

/**
 *
 * @param {TemplateNode} node
 */
export function read_hydration_instruction(node) {
	if (!node || node.nodeType !== COMMENT_NODE) {
		w.hydration_mismatch();
		throw HYDRATION_ERROR;
	}

	return /** @type {Comment} */ (node).data;
}
