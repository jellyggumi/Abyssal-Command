# vendor/

Third-party runtime dependencies vendored locally so the offline-first service
worker can cache them (no CDN dependency at runtime).

- `three.module.min.js` — [three.js](https://github.com/mrdoob/three.js) r160,
  ES module build, MIT License. Pulled from
  `https://unpkg.com/three@0.160.0/build/three.module.min.js`. Used by
  `../liquid-ether.js` for the WebGL fluid-simulation background.
