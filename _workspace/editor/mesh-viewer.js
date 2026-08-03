/**
 * 3D asset viewer — GLB/GLTF, OBJ, FBX.
 *
 * A separate module because three plus its loaders is ~3 MB: `app.js` imports
 * this lazily the first time a mesh is inspected, so opening the editor to read
 * a markdown document never pays for it.
 *
 * three and the loaders come from the repo's own `vendor/` tree, the same build
 * `battle-realtime-three.js` renders the game with. That is deliberate: a
 * viewer on a different three version could show geometry the game cannot
 * load, which would make it a liar rather than a check.
 */

let THREE = null;
let loaders = null;

/** Load three + loaders once. Resolves to the module bag. */
async function ensureThree(base = '') {
  if (THREE && loaders) return { THREE, loaders };
  const v = `${base}/vendor`;
  const [three, gltf, obj, fbx, orbit] = await Promise.all([
    import(`${v}/three.module.js`),
    import(`${v}/loaders/GLTFLoader.js`),
    import(`${v}/loaders/OBJLoader.js`),
    import(`${v}/loaders/FBXLoader.js`),
    import(`${v}/controls/OrbitControls.js`),
  ]);
  THREE = three;
  loaders = {
    GLTFLoader: gltf.GLTFLoader,
    OBJLoader: obj.OBJLoader,
    FBXLoader: fbx.FBXLoader,
    OrbitControls: orbit.OrbitControls,
  };
  return { THREE, loaders };
}

export const MESH_EXT = new Set(['.glb', '.gltf', '.obj', '.fbx']);
export const canView = (path) => MESH_EXT.has(path.slice(path.lastIndexOf('.')).toLowerCase());

/**
 * One live viewer. Owns its renderer, so `dispose()` must be called before
 * dropping it -- WebGL contexts are a limited resource and the editor swaps
 * assets freely.
 */
class MeshView {
  constructor(mount, { THREE: T, loaders: L }) {
    this.T = T;
    this.L = L;
    this.mount = mount;
    this.disposed = false;

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0e131a);

    const w = mount.clientWidth || 640;
    const h = mount.clientHeight || 360;
    this.camera = new T.PerspectiveCamera(45, w / h, 0.01, 5000);

    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    mount.append(this.renderer.domElement);

    // Three-point-ish rig. Enough to read silhouette and surface without
    // pretending to match the game's authored lighting.
    this.scene.add(new T.HemisphereLight(0xbcd0e6, 0x1a2230, 1.1));
    const key = new T.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new T.DirectionalLight(0xe8a33d, 0.7);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    this.grid = new T.GridHelper(10, 10, 0x2a3644, 0x1a222c);
    this.scene.add(this.grid);

    this.controls = new L.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.mixer = null;
    this.clips = [];
    this.clock = new T.Clock();

    this.onResize = () => {
      if (this.disposed) return;
      const cw = mount.clientWidth || 640;
      const ch = mount.clientHeight || 360;
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch, false);
    };
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(mount);

    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  tick() {
    if (this.disposed) return;
    const dt = this.clock.getDelta();
    if (this.mixer) this.mixer.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  }

  /**
   * Frame the object and park the grid at its feet.
   *
   * `Box3.setFromObject` expands by geometry, so a bone-only hierarchy (an
   * animation-only FBX) yields an empty box and the camera would sit at the
   * origin looking at nothing. Fall back to bone world positions in that case.
   */
  frame(object) {
    const T = this.T;
    object.updateWorldMatrix(true, true);
    const box = new T.Box3().setFromObject(object);

    if (box.isEmpty()) {
      const p = new T.Vector3();
      let any = false;
      object.traverse((n) => {
        if (!n.isBone) return;
        n.getWorldPosition(p);
        box.expandByPoint(p);
        any = true;
      });
      if (!any) return { size: null, center: null };
      // A single-point box has zero extent; give it enough volume to frame.
      if (box.min.distanceTo(box.max) < 1e-6) box.expandByScalar(0.5);
    }

    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    const radius = Math.max(size.x, size.y, size.z) || 1;

    const dist = radius / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * 1.9;
    this.camera.position.set(center.x + dist * 0.7, center.y + radius * 0.45, center.z + dist * 0.7);
    this.camera.near = Math.max(radius / 1000, 0.001);
    this.camera.far = Math.max(radius * 100, 100);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();

    // Grid scaled to the model so a 3 cm prop and a 30 m terrain both read.
    const step = 10 ** Math.round(Math.log10(radius)) / 2;
    this.grid.geometry.dispose();
    this.scene.remove(this.grid);
    this.grid = new T.GridHelper(step * 20, 20, 0x2a3644, 0x1a222c);
    // Nudge below the model: a flat mesh sitting exactly at box.min.y is
    // coplanar with the grid and z-fights with it.
    this.grid.position.y = box.min.y - radius * 0.002;
    this.scene.add(this.grid);

    return { size, center };
  }

  /** Play a named clip, or the first one. */
  play(index = 0) {
    if (!this.clips.length) return null;
    const T = this.T;
    if (!this.mixer) this.mixer = new T.AnimationMixer(this.root);
    this.mixer.stopAllAction();
    const clip = this.clips[Math.max(0, Math.min(index, this.clips.length - 1))];
    this.mixer.clipAction(clip).reset().play();
    return clip.name || `clip ${index}`;
  }

  stop() {
    if (this.mixer) this.mixer.stopAllAction();
  }

  setWireframe(on) {
    this.root?.traverse((n) => {
      if (!n.isMesh) return;
      for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
        if (m) m.wireframe = on;
      }
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls?.dispose();
    this.mixer?.stopAllAction();
    this.scene?.traverse((n) => {
      if (n.isMesh) {
        n.geometry?.dispose();
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          if (!m) continue;
          for (const k of Object.keys(m)) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        }
      }
    });
    // SkeletonHelper owns its own line geometry/material, outside the mesh walk.
    this.skeleton?.geometry?.dispose();
    this.skeleton?.material?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}

/** Count what actually arrived, so the caller can report facts not vibes. */
function summarise(root, T) {
  let meshes = 0, triangles = 0, materials = new Set(), textures = new Set(), bones = 0;
  root.traverse((n) => {
    if (n.isBone) bones++;
    if (!n.isMesh) return;
    meshes++;
    const g = n.geometry;
    if (g) {
      const idx = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
      triangles += Math.floor(idx / 3);
    }
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      if (!m) continue;
      materials.add(m.uuid);
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) textures.add(v.uuid);
      }
    }
  });
  return { meshes, triangles, materials: materials.size, textures: textures.size, bones };
}

/**
 * Load `url` into `mount` and return `{ view, info }`.
 *
 * @param {HTMLElement} mount   container; must have a layout size
 * @param {string} url          absolute or API-relative asset URL
 * @param {string} ext          lowercased extension, e.g. '.glb'
 * @param {object} [opts]
 * @param {string} [opts.base]  API base for the vendor import
 */
export async function loadMesh(mount, url, ext, { base = '' } = {}) {
  const { THREE: T, loaders: L } = await ensureThree(base);
  const view = new MeshView(mount, { THREE: T, loaders: L });

  let root = null;
  let clips = [];

  try {
    if (ext === '.glb' || ext === '.gltf') {
      const gltf = await new L.GLTFLoader().loadAsync(url);
      root = gltf.scene || gltf.scenes?.[0];
      clips = gltf.animations || [];
    } else if (ext === '.obj') {
      // OBJ carries no embedded material; without the sibling .mtl it renders
      // untextured, which is stated in the summary rather than hidden.
      root = await new L.OBJLoader().loadAsync(url);
    } else if (ext === '.fbx') {
      const fbx = await new L.FBXLoader().loadAsync(url);
      root = fbx;
      clips = fbx.animations || [];
    } else {
      throw new Error(`unsupported extension ${ext}`);
    }
  } catch (err) {
    view.dispose();
    throw err;
  }

  if (!root) {
    view.dispose();
    throw new Error('loader returned no scene');
  }

  // Two fixes for what these exports actually look like:
  //   - OBJ/FBX often ship no material at all, and render flat black.
  //   - Single-sided planes (terrain heightmaps exported in XY) are backface
  //     culled and vanish entirely -- the geometry is there, the viewer just
  //     could not show it. A viewer that hides valid geometry is a liar, so
  //     force DoubleSide here even though the game may legitimately cull.
  root.traverse((n) => {
    if (!n.isMesh) return;
    if (!n.material) {
      n.material = new T.MeshStandardMaterial({ color: 0x8c9bad, roughness: 0.7 });
    }
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      if (m) m.side = T.DoubleSide;
    }
  });

  view.root = root;
  view.clips = clips;
  view.scene.add(root);

  const counts = summarise(root, T);

  // Animation-only files are real and common here: `assets/motion/bench/` is a
  // Mixamo library whose FBX carry a skeleton and curves but no geometry. With
  // nothing drawn the canvas looks broken, so show the skeleton instead --
  // then "0 triangles, 37 bones" has something to look at.
  if (counts.meshes === 0 && counts.bones > 0) {
    view.skeleton = new T.SkeletonHelper(root);
    view.skeleton.material.linewidth = 2;
    view.scene.add(view.skeleton);
  }

  // Frame after the helper exists so a boneless-but-meshless file still gets a
  // sane camera from the bone positions.
  const framed = view.frame(root);

  return {
    view,
    info: {
      ...counts,
      clips: clips.map((c) => ({ name: c.name || '(unnamed)', duration: Number(c.duration.toFixed(3)) })),
      size: framed.size ? {
        x: Number(framed.size.x.toFixed(3)),
        y: Number(framed.size.y.toFixed(3)),
        z: Number(framed.size.z.toFixed(3)),
      } : null,
      untextured: counts.textures === 0,
    },
  };
}
