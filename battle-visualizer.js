import * as THREE from "./vendor/three.module.min.js";

export class BattleVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animationFrameId = null;

    this.allies = [];
    this.enemies = [];
    this.particles = [];
    this.nodes = [];
    this.domainDome = null;

    this.onEnemyBreach = null; // Callback when enemy reaches ally portal
    this.isAssaulting = false;
    this.lastTime = 0;
    this.assaultTimer = 0;
    this.destroyed = false;
    this.resourceCache = {
      geometries: new Map(),
      materials: new Map()
    };
    this.allyPortal = null;
    this.bossPortal = null;
    this.bossMesh = null;
    this.resizeHandler = null;
  }

  getGeometry(key, create) {
    let geometry = this.resourceCache.geometries.get(key);
    if (!geometry) {
      geometry = create();
      this.resourceCache.geometries.set(key, geometry);
    }
    return geometry;
  }

  getMaterial(key, create) {
    let material = this.resourceCache.materials.get(key);
    if (!material) {
      material = create();
      this.resourceCache.materials.set(key, material);
    }
    return material;
  }

  getSparkMaterial(colorHex) {
    return this.getMaterial(`spark-${colorHex}`, () => new THREE.MeshBasicMaterial({ color: colorHex }));
  }

  removeMesh(mesh) {
    mesh?.removeFromParent();
  }

  collectResources(object, geometries, materials) {
    object?.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach(material => {
        if (material) materials.add(material);
      });
    });
  }

  init() {
    if (this.destroyed || this.scene) return this;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#060913");

    // Bird's-eye view perspective camera (tilted downward)
    const width = Math.max(this.canvas.clientWidth, 1);
    const height = Math.max(this.canvas.clientHeight, 1);
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 0.2, -0.5);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x70e5d0, 0.8);
    dirLight1.position.set(-5, 8, 2);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff7f79, 0.6);
    dirLight2.position.set(5, 8, -2);
    this.scene.add(dirLight2);

    // 3. Setup Grid Floor representing the dungeon lane
    const gridHelper = new THREE.GridHelper(24, 24, 0x3b4c68, 0x1b2740);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);

    this.resourceCache.geometries.set("floor", gridHelper.geometry);
    const floorMaterials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
    floorMaterials.forEach((material, index) => this.resourceCache.materials.set(`floor-${index}`, material));
    // Side glowing walls/rails
    const wallGeo = this.getGeometry("wall", () => new THREE.BoxGeometry(24, 0.1, 0.2));
    const wallMatAlly = this.getMaterial("wall-ally", () => new THREE.MeshBasicMaterial({ color: 0x70e5d0 }));
    const wallMatEnemy = this.getMaterial("wall-enemy", () => new THREE.MeshBasicMaterial({ color: 0xff7f79 }));

    const wallLeft = new THREE.Mesh(wallGeo, wallMatAlly);
    wallLeft.position.set(0, 0.05, 3.5);
    this.scene.add(wallLeft);

    const wallRight = new THREE.Mesh(wallGeo, wallMatEnemy);
    wallRight.position.set(0, 0.05, -3.5);
    this.scene.add(wallRight);

    // 4. Camp Portals
    // Ally Portal (Torus, left)
    const allyPortalGeo = this.getGeometry("ally-portal", () => new THREE.TorusGeometry(1.2, 0.15, 8, 24));
    const allyPortalMat = this.getMaterial("ally-portal", () => new THREE.MeshBasicMaterial({ color: 0x70e5d0, wireframe: true }));
    this.allyPortal = new THREE.Mesh(allyPortalGeo, allyPortalMat);
    this.allyPortal.rotation.y = Math.PI / 2;
    this.allyPortal.position.set(-8, 1, 0);
    this.scene.add(this.allyPortal);

    // Boss Portal (Cylinder, right)
    const bossPortalGeo = this.getGeometry("boss-portal", () => new THREE.CylinderGeometry(1.0, 1.4, 2.0, 4, 1, true));
    const bossPortalMat = this.getMaterial("boss-portal", () => new THREE.MeshBasicMaterial({ color: 0xff7f79, wireframe: true }));
    this.bossPortal = new THREE.Mesh(bossPortalGeo, bossPortalMat);
    this.bossPortal.position.set(8, 1, 0);
    this.scene.add(this.bossPortal);

    // 5. Boss Mesh
    const bossGeo = this.getGeometry("boss", () => new THREE.ConeGeometry(0.8, 1.6, 4));
    const bossMat = this.getMaterial("boss", () => new THREE.MeshStandardMaterial({ color: 0xff7f79, roughness: 0.2, metalness: 0.8 }));
    this.bossMesh = new THREE.Mesh(bossGeo, bossMat);
    this.bossMesh.position.set(8, 0.8, 0);
    this.scene.add(this.bossMesh);

    // Handle resizing
    this.resizeHandler = () => {
      if (this.destroyed || !this.renderer || !this.camera || !this.canvas) return;
      const width = Math.max(this.canvas.clientWidth, 1);
      const height = Math.max(this.canvas.clientHeight, 1);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener("resize", this.resizeHandler);

    // Start Rendering Loop
    this.lastTime = performance.now();
    this.animate();
  }

  spawnAlly(count = 2, isPossessed = false) {
    if (this.destroyed || !this.scene) return;
    const geo = this.getGeometry("ally", () => new THREE.SphereGeometry(0.25, 8, 8));
    const materialKey = isPossessed ? "ally-possessed" : "ally";
    const color = isPossessed ? 0xfff0a4 : 0x70e5d0;
    const mat = this.getMaterial(materialKey, () => new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.3
    }));

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      // Spawn slightly offset from ally portal
      mesh.position.set(
        -8 + (Math.random() - 0.5) * 0.5,
        0.25,
        (Math.random() - 0.5) * 2.0
      );

      this.scene.add(mesh);
      this.allies.push({
        mesh,
        speed: 1.5 + Math.random() * 0.5,
        hp: isPossessed ? 3 : 1,
        isPossessed
      });

      // Spawn summon particles
      this.createSparks(mesh.position, 10, 0x70e5d0);
    }
  }

  spawnEnemy(count = 3) {
    if (this.destroyed || !this.scene) return;
    const geo = this.getGeometry("enemy", () => new THREE.BoxGeometry(0.4, 0.4, 0.4));
    const mat = this.getMaterial("enemy", () => new THREE.MeshStandardMaterial({
      color: 0xff7f79,
      emissive: 0xff7f79,
      emissiveIntensity: 0.4,
      roughness: 0.5
    }));

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        8 + (Math.random() - 0.5) * 0.5,
        0.2,
        (Math.random() - 0.5) * 2.0
      );

      this.scene.add(mesh);
      this.enemies.push({
        mesh,
        speed: 1.0 + Math.random() * 0.4,
        hp: 1
      });

      this.createSparks(mesh.position, 8, 0xff7f79);
    }
  }

  triggerHunt() {
    // Spawn a glowing spoor spawner on the ground
    const pos = {
      x: -4 + Math.random() * 8,
      y: 0.05,
      z: (Math.random() - 0.5) * 4.0
    };
    this.createSparks(pos, 25, 0xffb85c);
  }

  triggerMaterialize(count = 2) {
    this.spawnAlly(count);
    this.createSparks({ x: -7.4, y: 0.3, z: 0 }, 18, 0x70e5d0);
  }
  triggerPossess() {
    if (this.destroyed || !this.scene) return;
    const ally = this.allies[0];
    if (ally) {
      ally.isPossessed = true;
      ally.hp = Math.max(ally.hp, 3);
      ally.mesh.material = this.getMaterial("ally-possessed", () => new THREE.MeshStandardMaterial({
        color: 0xfff0a4,
        emissive: 0xfff0a4,
        emissiveIntensity: 0.6,
        roughness: 0.3
      }));
    }
    this.createSparks(ally?.mesh.position ?? { x: -6.8, y: 0.3, z: 0 }, 22, 0xfff0a4);
  }

  triggerExtract() {
    if (this.destroyed || !this.scene) return;
    // Draw actual spark meshes so this effect remains visible while they travel home.
    for (let i = 0; i < 15; i++) {
      const startX = -2 + Math.random() * 4;
      const startZ = (Math.random() - 0.5) * 4.0;
      this.createSparks({ x: startX, y: 0.2, z: startZ }, 1, 0x70e5d0);
      const particle = this.particles[this.particles.length - 1];
      particle.velocity.set(-4.0 - Math.random() * 2.0, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5);
      particle.decay = 1.2;
    }
  }

  triggerCapture(nodeIndex, maxNodes) {
    if (this.destroyed || !this.scene) return;
    this.nodes.forEach(node => this.removeMesh(node));
    this.nodes = [];

    // Create glowing technical nodes
    const spacing = 10 / (maxNodes + 1);
    const geo = this.getGeometry("node", () => new THREE.CylinderGeometry(0.3, 0.3, 0.8, 6));
    const mat = this.getMaterial("node", () => new THREE.MeshStandardMaterial({
      color: 0x70e5d0,
      emissive: 0x70e5d0,
      emissiveIntensity: 0.8
    }));
    for (let i = 1; i <= nodeIndex; i++) {
      const x = -5 + i * spacing;
      const node = new THREE.Mesh(geo, mat);
      node.position.set(x, 0.4, 0);
      this.scene.add(node);
      this.nodes.push(node);
      this.createSparks(node.position, 15, 0x70e5d0);
    }
  }

  triggerDomain() {
    if (this.destroyed || !this.scene) return;
    this.removeMesh(this.domainDome);
    const geo = this.getGeometry("domain", () => new THREE.SphereGeometry(2.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    const mat = this.getMaterial("domain", () => new THREE.MeshBasicMaterial({
      color: 0xab68ff,
      transparent: true,
      opacity: 0.25,
      wireframe: true
    }));
    this.domainDome = new THREE.Mesh(geo, mat);
    this.domainDome.position.set(-8, 0, 0);
    this.scene.add(this.domainDome);
    this.domainDomeLife = 4.0; // 4 seconds duration
  }

  triggerAssault() {
    if (this.destroyed || !this.scene) return;
    this.isAssaulting = true;
    // Boost speed of all active allies and make them rush boss
    this.allies.forEach(a => {
      a.speed = 6.0;
    });

    // Boss portal takes massive spark explosion.
    window.clearTimeout(this.assaultTimer);
    this.assaultTimer = window.setTimeout(() => {
      if (!this.destroyed) this.createSparks({ x: 8, y: 1.0, z: 0 }, 50, 0xff7f79);
      this.isAssaulting = false;
    }, 1200);
  }

  createSparks(pos, count, colorHex) {
    if (this.destroyed || !this.scene) return;
    const geo = this.getGeometry("spark", () => new THREE.SphereGeometry(0.06, 4, 4));
    const mat = this.getSparkMaterial(colorHex);

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.0;
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0.8 + Math.random() * 2.0,
          Math.sin(angle) * speed
        ),
        color: colorHex,
        life: 1.0,
        decay: 1.5 + Math.random() * 1.5
      });
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    window.clearTimeout(this.assaultTimer);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);

    const geometries = new Set();
    const materials = new Set();
    this.collectResources(this.scene, geometries, materials);
    this.resourceCache.geometries.forEach(geometry => geometries.add(geometry));
    this.resourceCache.materials.forEach(material => materials.add(material));
    this.scene?.clear();
    geometries.forEach(geometry => geometry.dispose?.());
    materials.forEach(material => material.dispose?.());
    this.resourceCache.geometries.clear();
    this.resourceCache.materials.clear();

    this.renderer?.renderLists?.dispose?.();
    this.renderer?.dispose();
    this.allies = [];
    this.enemies = [];
    this.particles = [];
    this.nodes = [];
    this.domainDome = null;
    this.domainDomeLife = 0;
    this.isAssaulting = false;
    this.allyPortal = null;
    this.bossPortal = null;
    this.bossMesh = null;
    this.onEnemyBreach = null;
    this.resizeHandler = null;
    this.assaultTimer = 0;
    this.animationFrameId = null;
    this.lastTime = 0;
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.canvas = null;
  }

  animate() {
    if (this.destroyed) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.updateSimulation(dt);
    this.render();
  }

  updateSimulation(dt) {
    // 1. Update Domain Dome
    if (this.domainDome) {
      this.domainDomeLife -= dt;
      this.domainDome.rotation.y += dt * 0.5;
      if (this.domainDomeLife <= 0) {
        this.scene.remove(this.domainDome);
        this.domainDome = null;
      }
    }

    // 2. Rotate portals
    if (this.allyPortal) this.allyPortal.rotation.z += dt * 0.8;
    if (this.bossPortal) this.bossPortal.rotation.y += dt * 0.5;

    // 3. Move Allies (towards right, x increases)
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const ally = this.allies[i];
      ally.mesh.position.x += ally.speed * dt;

      // If reaches boss portal
      if (ally.mesh.position.x >= 7.8) {
        this.createSparks(ally.mesh.position, 6, 0x70e5d0);
        this.scene.remove(ally.mesh);
        this.allies.splice(i, 1);
      }
    }

    // 4. Move Enemies (towards left, x decreases)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.mesh.position.x -= enemy.speed * dt;

      // If reaches ally portal
      if (enemy.mesh.position.x <= -7.8) {
        this.createSparks(enemy.mesh.position, 8, 0xff7f79);
        this.scene.remove(enemy.mesh);
        this.enemies.splice(i, 1);

        // Breach trigger
        if (this.onEnemyBreach) {
          this.onEnemyBreach();
        }
      }
    }

    // 5. Check clashing (Ally vs Enemy collision)
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const ally = this.allies[i];
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];

        const dist = ally.mesh.position.distanceTo(enemy.mesh.position);
        if (dist < 0.6) {
          // Clash impact
          this.createSparks(ally.mesh.position, 4, 0xffb85c);

          ally.hp -= 1;
          enemy.hp -= 1;

          if (enemy.hp <= 0) {
            this.scene.remove(enemy.mesh);
            this.enemies.splice(j, 1);
          }
          if (ally.hp <= 0) {
            this.scene.remove(ally.mesh);
            this.allies.splice(i, 1);
            break; // Ally is dead, stop checking other enemies
          }
        }
      }
    }

    // 6. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * p.decay;

      if (p.mesh) {
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.velocity.y -= 9.8 * dt; // gravity
        if (p.mesh.position.y < 0.05) {
          p.mesh.position.y = 0.05;
          p.velocity.y = -p.velocity.y * 0.3; // bounce
        }

        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      } else {
        // Line/copy particles (used for extract)
        p.position.addScaledVector(p.velocity, dt);
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
