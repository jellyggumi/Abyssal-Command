import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rendererStop = new Error("renderer seam reached");
const rendererOptions = [];

class Color {
  constructor() {
    this.r = 0;
    this.g = 0;
    this.b = 0;
  }
}

class DataTexture {}
class Vector4 {}

const fakeThree = {
  ClampToEdgeWrapping: Symbol("ClampToEdgeWrapping"),
  Color,
  DataTexture,
  LinearFilter: Symbol("LinearFilter"),
  RGBAFormat: Symbol("RGBAFormat"),
  Vector4,
  WebGLRenderer: class WebGLRenderer {
    constructor(options) {
      rendererOptions.push(options);
      throw rendererStop;
    }
  },
};

async function loadCreateLiquidEther() {
  const source = await readFile(new URL("../liquid-ether.js", import.meta.url), "utf8");
  const executable = source.replace(
    'import * as THREE from "./vendor/three.module.min.js";',
    "const THREE = globalThis.__liquidEtherTestThree;",
  );
  if (executable === source) throw new Error("liquid-ether Three.js import seam was not found");

  globalThis.__liquidEtherTestThree = fakeThree;
  try {
    const url = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;
    return (await import(url)).createLiquidEther;
  } finally {
    delete globalThis.__liquidEtherTestThree;
  }
}

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

const createLiquidEther = await loadCreateLiquidEther();

test("createLiquidEther returns null rather than accepting WebGL1 when WebGL2 is unavailable", () => {
  rendererOptions.length = 0;
  const contextRequests = [];
  const webgl1Context = {};
  const canvas = {
    getContext(...args) {
      contextRequests.push(args);
      return args[0] === "webgl" ? webgl1Context : null;
    },
  };
  const createdElements = [];
  const restoreDocument = replaceGlobal("document", {
    createElement(tagName) {
      createdElements.push(tagName);
      return canvas;
    },
  });
  const restoreWindow = replaceGlobal("window", {});

  try {
    assert.equal(createLiquidEther({}), null, "the public factory must preserve the static-background fallback");
  } finally {
    restoreWindow();
    restoreDocument();
  }

  assert.deepEqual(createdElements, ["canvas"], "the factory must probe the renderer canvas it creates");
  assert.deepEqual(
    contextRequests,
    [["webgl2", { antialias: true, alpha: true }]],
    "the factory must make one WebGL2-only context request with transparent antialiasing",
  );
  assert.equal(rendererOptions.length, 0, "an unavailable WebGL2 context must not construct a renderer");
});

test("createLiquidEther forwards its created canvas and exact WebGL2 context to WebGLRenderer", () => {
  rendererOptions.length = 0;
  const contextRequests = [];
  const webgl2Context = {};
  const canvas = {
    getContext(...args) {
      contextRequests.push(args);
      if (args[0] === "webgl2") return webgl2Context;
      return {};
    },
  };
  const createdElements = [];
  const container = { style: {} };
  const restoreDocument = replaceGlobal("document", {
    createElement(tagName) {
      createdElements.push(tagName);
      return canvas;
    },
  });
  const restoreWindow = replaceGlobal("window", {
    devicePixelRatio: 1,
    getComputedStyle: () => ({ position: "relative", overflow: "hidden" }),
  });

  try {
    assert.throws(
      () => createLiquidEther(container),
      (error) => error === rendererStop,
      "the factory must reach the controlled renderer seam",
    );
  } finally {
    restoreWindow();
    restoreDocument();
  }

  assert.deepEqual(createdElements, ["canvas"], "the renderer must use the canvas created by the factory");
  assert.deepEqual(
    contextRequests,
    [["webgl2", { antialias: true, alpha: true }]],
    "the factory must not probe or fall back to a WebGL1 context",
  );
  assert.equal(rendererOptions.length, 1, "the available WebGL2 context must construct one renderer");
  assert.deepEqual(
    Reflect.ownKeys(rendererOptions[0]).sort(),
    ["alpha", "antialias", "canvas", "context"],
    "the renderer options must contain only the requested canvas, context, and context attributes",
  );
  assert.equal(rendererOptions[0].canvas, canvas, "WebGLRenderer must receive the actual created canvas");
  assert.equal(rendererOptions[0].context, webgl2Context, "WebGLRenderer must receive the exact returned WebGL2 context");
  assert.equal(rendererOptions[0].antialias, true, "WebGLRenderer must preserve antialiasing");
  assert.equal(rendererOptions[0].alpha, true, "WebGLRenderer must preserve transparent composition");
});
