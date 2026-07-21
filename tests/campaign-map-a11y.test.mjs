import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { translations } from "../i18n.js";

async function renderReactGameUiContract() {
  const source = await readFile(new URL("../react-game-ui.js", import.meta.url), "utf8");
  let root = null;
  const container = { style: {} };
  const createElement = (type, props, ...children) => {
    if (typeof type === "function") return type(props ?? {});
    return { type, props: props ?? {}, children: children.flat(Infinity) };
  };
  const context = vm.createContext({
    CustomEvent: class CustomEvent {},
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => (id === "react-game-root" ? container : null),
    },
    window: {
      React: { createElement },
      ReactDOM: {
        render(value) {
          root = value;
        },
      },
      dispatchEvent() {},
    },
  });
  vm.runInContext(source, context, { filename: "react-game-ui.js" });
  assert.ok(root, "the React shell must render its public element tree");
  return root;
}

function findReactElementsByClassName(root, className, matches = []) {
  if (!root || typeof root !== "object") return matches;
  const declared = root.props?.className;
  if (typeof declared === "string" && declared.split(/\s+/).includes(className)) {
    matches.push(root);
  }
  for (const child of root.children ?? []) findReactElementsByClassName(child, className, matches);
  return matches;
}

test("the campaign map scroll container is keyboard-focusable and localized", async () => {
  const root = await renderReactGameUiContract();
  const [grid] = findReactElementsByClassName(root, "campaign-map-grid");
  assert.ok(grid, "the campaign map grid container must be present in the rendered tree");
  assert.equal(grid.props.tabIndex, 0, "the scroll container must join the tab order so keyboard users can reach it");
  assert.equal(grid.props.role, "group", "the scroll container must expose a group role for assistive tech");
  assert.equal(
    grid.props["data-i18n-aria"],
    "map.ariaLabel",
    "the scroll container must be localized via the standard data-i18n-aria hook",
  );
  assert.equal(typeof grid.props["aria-label"], "string", "the scroll container must ship a default aria-label");
  assert.ok(grid.props["aria-label"].length > 0, "the default aria-label must not be empty");
});

test("the campaign map grid keeps its ten stage nodes as children of the focusable container", async () => {
  const root = await renderReactGameUiContract();
  const [grid] = findReactElementsByClassName(root, "campaign-map-grid");
  const nodes = findReactElementsByClassName(grid, "map-node");
  assert.equal(nodes.length, 10, "all ten campaign stage nodes must remain nested inside the scroll container");
});

test("react-game-ui.css exposes a visible focus-visible outline for the campaign map scroll container", async () => {
  const css = await readFile(new URL("../react-game-ui.css", import.meta.url), "utf8");
  const rule = css.match(/\.(?:campaign-map-grid|war-table-grid):focus-visible\s*\{[^}]*\}/);
  assert.ok(rule, "react-game-ui.css must define a :focus-visible rule for the campaign map scroll container");
  assert.match(rule[0], /outline(?:-width)?\s*:\s*(?!none)[^;]+;/, "the focus-visible rule must set a visible outline");
  assert.match(rule[0], /outline-offset\s*:/, "the focus-visible rule should offset the outline from the container edge");
});

test("both language dictionaries own the campaign map aria label used by the scroll container", async () => {
  for (const locale of ["ko", "en"]) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(translations[locale], "map.ariaLabel"),
      `${locale} must own map.ariaLabel for the campaign map scroll container`,
    );
    assert.equal(typeof translations[locale]["map.ariaLabel"], "string");
    assert.ok(translations[locale]["map.ariaLabel"].length > 0);
  }
});
