import { translate } from "./i18n.js";

function localizedLabel(key, values = {}) {
  let label = translate(key);
  for (const [name, value] of Object.entries(values)) {
    label = label.replaceAll(`{${name}}`, String(value));
  }
  return label;
}
/**
 * Shared tactical minimap controller for canvas#battle-minimap.
 * Consumes authoritative campaign/renderer snapshots and navigation.
 */

const GIMMICK_COLORS = Object.freeze({
  hazard: "rgba(239, 68, 68, 0.25)", // transparent red
  current: "rgba(6, 182, 212, 0.25)", // transparent cyan
  "high-ground": "rgba(234, 179, 8, 0.25)", // transparent gold
  cover: "rgba(34, 197, 94, 0.25)", // transparent green
  flank: "rgba(168, 85, 247, 0.25)", // transparent purple
  objective: "rgba(59, 130, 246, 0.25)", // transparent blue
  exposed: "rgba(249, 115, 22, 0.25)" // transparent orange
});

const ROUTE_COLORS = Object.freeze([
  "rgba(251, 146, 60, 0.75)", // Orange-red for Lane 1
  "rgba(74, 222, 128, 0.75)",  // Green for Lane 2
  "rgba(96, 165, 250, 0.75)"   // Blue for Lane 3
]);

export class TacticalMinimap {
  /**
   * @param {HTMLCanvasElement} canvas The canvas element
   * @param {Object} options Configuration options
   * @param {Function} [options.onFocusRequest] Callback for cell focus change: ({x, y}) => void
   * @param {boolean} [options.reducedMotion] Override prefers-reduced-motion media query
   */
  constructor(canvas, options = {}) {
    if (!canvas || canvas.tagName !== "CANVAS") {
      throw new Error("TacticalMinimap requires a valid canvas element.");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onFocusRequest = options.onFocusRequest || null;
    this.reducedMotion = typeof options.reducedMotion === "boolean"
      ? options.reducedMotion
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.snapshot = null;
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.keyboardFocusCell = { x: 12, y: 5 };

    this.overlayContainer = null;
    this.liveStatus = null;
    this.resize();
    this.setupEvents();
  }

  /**
   * Set up keyboard navigation and mouse click events.
   */
  setupEvents() {
    if (!this.canvas.hasAttribute("tabindex")) {
      this.canvas.setAttribute("tabindex", "0");
    }

    this.handleKeyDown = (e) => {
      let moved = false;
      switch (e.key) {
        case "ArrowLeft":
          this.keyboardFocusCell.x = Math.max(0, this.keyboardFocusCell.x - 1);
          moved = true;
          break;
        case "ArrowRight":
          this.keyboardFocusCell.x = Math.min(23, this.keyboardFocusCell.x + 1);
          moved = true;
          break;
        case "ArrowUp":
          this.keyboardFocusCell.y = Math.max(0, this.keyboardFocusCell.y - 1);
          moved = true;
          break;
        case "ArrowDown":
          this.keyboardFocusCell.y = Math.min(11, this.keyboardFocusCell.y + 1);
          moved = true;
          break;
        case "Enter":
        case " ":
          this.setFocusCell(this.keyboardFocusCell.x, this.keyboardFocusCell.y);
          this.announceFocus(this.keyboardFocusCell.x, this.keyboardFocusCell.y);
          e.preventDefault();
          break;
      }
      if (moved) {
        e.preventDefault();
        this.announceFocus(this.keyboardFocusCell.x, this.keyboardFocusCell.y);
        this.draw();
      }
    };

    this.handleClick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const cell = this.minimapToGrid(clickX, clickY);
      this.keyboardFocusCell = { ...cell };
      this.setFocusCell(cell.x, cell.y);
      this.announceFocus(cell.x, cell.y);
    };

    this.handleFocus = () => {
      this.announceFocus(this.keyboardFocusCell.x, this.keyboardFocusCell.y);
    };

    this.canvas.addEventListener("keydown", this.handleKeyDown);
    this.canvas.addEventListener("click", this.handleClick);
    this.canvas.addEventListener("focus", this.handleFocus);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.draw();
    });
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Triggers the focus change callback.
   * @param {number} x
   * @param {number} y
   */
  setFocusCell(x, y) {
    const cx = Math.max(0, Math.min(23, Math.floor(x)));
    const cy = Math.max(0, Math.min(11, Math.floor(y)));
    if (this.onFocusRequest) {
      this.onFocusRequest({ x: cx, y: cy });
    }
  }

  /**
   * Finds if there is a tactical landmark in the given grid cell.
   * @param {number} x
   * @param {number} y
   * @returns {Object|null}
   */
  getLandmark(x, y) {
    if (!this.snapshot) return null;
    const nav = this.snapshot.navigation;
    if (nav && nav.anchors) {
      const portal = nav.anchors.portal;
      if (portal && Math.floor(portal.x) === x && Math.floor(portal.y) === y) {
        return { type: "portal", name: translate("battle.minimap.landmark.portal") };
      }
      const boss = nav.anchors.boss;
      if (boss && Math.floor(boss.x) === x && Math.floor(boss.y) === y) {
        return { type: "boss", name: translate("battle.minimap.landmark.boss") };
      }
      const extractor = nav.anchors.extractor;
      if (extractor && Math.floor(extractor.x) === x && Math.floor(extractor.y) === y) {
        return { type: "extractor", name: translate("battle.minimap.landmark.extractor") };
      }
      if (nav.anchors.nodes) {
        const idx = nav.anchors.nodes.findIndex((node) => Math.floor(node.x) === x && Math.floor(node.y) === y);
        if (idx !== -1) {
          return {
            type: "node",
            name: localizedLabel("battle.minimap.landmark.node", { index: idx + 1 })
          };
        }
      }
    }
    if (this.snapshot.deployments) {
      const dep = this.snapshot.deployments.find((deployment) => {
        const dx = deployment.cell ? deployment.cell.x : deployment.x;
        const dy = deployment.cell ? deployment.cell.y : deployment.y;
        return Math.floor(dx) === x && Math.floor(dy) === y;
      });
      if (dep) {
        return {
          type: "deployment",
          name: translate(dep.kind === "tower"
            ? "battle.minimap.landmark.tower"
            : "battle.minimap.landmark.barricade")
        };
      }
    }
    return null;
  }

  /**
   * Announces the focused cell or landmark to screen readers and updates hint text.
   * @param {number} x
   * @param {number} y
   */
  announceFocus(x, y) {
    const landmark = this.getLandmark(x, y);
    let message = localizedLabel("battle.minimap.focusCell", { x, y });
    if (landmark) {
      message += ` · ${landmark.name}`;
    }

    if (!this.liveStatus) {
      this.liveStatus = document.createElement("div");
      this.liveStatus.className = "sr-only";
      this.liveStatus.setAttribute("aria-live", "polite");
      this.liveStatus.setAttribute("aria-atomic", "true");
      this.canvas.parentNode.insertBefore(this.liveStatus, this.canvas.nextSibling);
    }
    this.liveStatus.textContent = message;

    const hintEl = document.getElementById("battle-minimap-hint");
    if (hintEl) {
      const baseHint = translate("battle.minimapHint");
      hintEl.textContent = `${baseHint} (${message})`;
    }
  }

  /**
   * Recalculates canvas dimensions and scale factor based on container size and DPR.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(rect.width) || 240;
    const displayHeight = Math.floor(rect.height) || 120;

    if (this.canvas.width !== displayWidth * dpr || this.canvas.height !== displayHeight * dpr) {
      this.canvas.width = displayWidth * dpr;
      this.canvas.height = displayHeight * dpr;
      this.canvas.style.width = displayWidth + "px";
      this.canvas.style.height = displayHeight + "px";
    }

    this.dpr = dpr;
    this.width = displayWidth;
    this.height = displayHeight;

    // Preserve 24x12 aspect ratio (2:1)
    this.scale = Math.min(this.width / 24, this.height / 12);
    this.offsetX = (this.width - 24 * this.scale) / 2;
    this.offsetY = (this.height - 12 * this.scale) / 2;
  }

  /**
   * Maps 3D world coordinates to canvas pixel coordinates.
   * @param {number} worldX
   * @param {number} worldZ
   * @returns {{x: number, y: number}}
   */
  worldToMinimap(worldX, worldZ) {
    const gx = worldX + 12;
    const gy = worldZ + 6;
    const px = this.offsetX + gx * this.scale;
    const py = this.offsetY + gy * this.scale;
    return { x: px, y: py };
  }

  /**
   * Maps canvas pixel coordinates to grid cell coordinates.
   * @param {number} canvasX
   * @param {number} canvasY
   * @returns {{x: number, y: number}}
   */
  minimapToGrid(canvasX, canvasY) {
    const gx = (canvasX - this.offsetX) / this.scale;
    const gy = (canvasY - this.offsetY) / this.scale;
    return {
      x: Math.max(0, Math.min(23, Math.floor(gx))),
      y: Math.max(0, Math.min(11, Math.floor(gy)))
    };
  }

  /**
   * Maps grid coordinates to canvas pixel coordinates.
   * @param {number} gx
   * @param {number} gy
   * @param {boolean} [corner=false] If true, maps to top-left corner; else center.
   * @returns {{x: number, y: number}}
   */
  gridToMinimap(gx, gy, corner = false) {
    const offset = corner ? 0 : 0.5;
    const px = this.offsetX + (gx + offset) * this.scale;
    const py = this.offsetY + (gy + offset) * this.scale;
    return { x: px, y: py };
  }

  /**
   * Update snapshot and redraw the minimap.
   * @param {Object} snapshot
   */
  update(snapshot) {
    this.snapshot = snapshot;
    this.updateAccessibleOverlay(snapshot);
    this.draw();
  }

  /**
   * Render the minimap canvas elements.
   */
  draw() {
    if (!this.snapshot || !this.snapshot.navigation) return;

    const { ctx, dpr, scale, offsetX, offsetY } = this;
    const nav = this.snapshot.navigation;
    const cells = nav.cells;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = "#0f172a"; // Slate-900
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Draw heightfield / grid cells
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 24; c++) {
        const height = cells[r] ? cells[r][c] : -1;
        if (height >= 0) {
          // Elevation shades: 0 = dark, higher = lighter
          const shades = ["#1e293b", "#334155", "#475569", "#64748b"];
          ctx.fillStyle = shades[Math.min(height, shades.length - 1)];
          ctx.fillRect(offsetX + c * scale, offsetY + r * scale, scale, scale);
        }
      }
    }

    // 3. Draw gimmick zones
    if (nav.zones) {
      nav.zones.forEach((zone) => {
        const color = GIMMICK_COLORS[zone.kind] || "rgba(255, 255, 255, 0.1)";
        ctx.fillStyle = color;
        zone.cells.forEach((cell) => {
          ctx.fillRect(offsetX + cell.x * scale, offsetY + cell.y * scale, scale, scale);
        });
      });
    }

    // 4. Draw grid lines (subtle)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= 12; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * scale);
      ctx.lineTo(offsetX + 24 * scale, offsetY + r * scale);
      ctx.stroke();
    }
    for (let c = 0; c <= 24; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * scale, offsetY);
      ctx.lineTo(offsetX + c * scale, offsetY + 12 * scale);
      ctx.stroke();
    }

    // 5. Draw routes
    if (nav.routes) {
      nav.routes.forEach((route) => {
        ctx.beginPath();
        route.cells.forEach((cell, idx) => {
          const px = offsetX + (cell.x + 0.5) * scale;
          const py = offsetY + (cell.y + 0.5) * scale;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = ROUTE_COLORS[route.lane] || "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = Math.max(1.5, scale * 0.15);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      });
    }

    // 6. Draw anchors
    if (nav.anchors) {
      const anchors = nav.anchors;

      // Portal (Allied Base)
      if (anchors.portal) {
        const pos = this.gridToMinimap(anchors.portal.x, anchors.portal.y);
        ctx.fillStyle = "#3b82f6"; // Blue
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, scale * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Boss (Enemy Base)
      if (anchors.boss) {
        const pos = this.gridToMinimap(anchors.boss.x, anchors.boss.y);
        ctx.fillStyle = "#ef4444"; // Red
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, scale * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Extractor
      if (anchors.extractor) {
        const pos = this.gridToMinimap(anchors.extractor.x, anchors.extractor.y);
        ctx.fillStyle = "#eab308"; // Gold/Yellow
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - scale * 0.4);
        ctx.lineTo(pos.x + scale * 0.4, pos.y);
        ctx.lineTo(pos.x, pos.y + scale * 0.4);
        ctx.lineTo(pos.x - scale * 0.4, pos.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Nodes
      if (anchors.nodes) {
        anchors.nodes.forEach((node) => {
          const pos = this.gridToMinimap(node.x, node.y);
          ctx.fillStyle = "#a855f7"; // Purple
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, scale * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // Hostile Spawns
      if (anchors.hostileSpawns) {
        anchors.hostileSpawns.forEach((s) => {
          const pos = this.gridToMinimap(s.x, s.y);
          ctx.fillStyle = "#b91c1c"; // Dark Red
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, scale * 0.25, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // 7. Draw deployments (Towers & Barricades)
    if (this.snapshot.deployments) {
      this.snapshot.deployments.forEach((d) => {
        const dx = d.cell ? d.cell.x : d.x;
        const dy = d.cell ? d.cell.y : d.y;
        
        if (d.kind === "tower") {
          const pos = this.gridToMinimap(dx, dy);
          ctx.fillStyle = "#10b981"; // Green
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, scale * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (d.kind === "barricade") {
          ctx.fillStyle = "#78350f"; // Brown
          ctx.strokeStyle = "#451a03";
          ctx.lineWidth = 1.5;
          ctx.fillRect(
            offsetX + dx * scale + scale * 0.15,
            offsetY + dy * scale + scale * 0.15,
            scale * 0.7,
            scale * 0.7
          );
          ctx.strokeRect(
            offsetX + dx * scale + scale * 0.15,
            offsetY + dy * scale + scale * 0.15,
            scale * 0.7,
            scale * 0.7
          );
        }
      });
    }

    // 8. Draw units (Allied: Blue, Enemy: Red)
    if (this.snapshot.units) {
      this.snapshot.units.forEach((unit) => {
        const pos = this.worldToMinimap(unit.x, unit.z);
        // Ensure units stay within map bounds during rendering
        if (pos.x >= offsetX && pos.x <= offsetX + 24 * scale &&
            pos.y >= offsetY && pos.y <= offsetY + 12 * scale) {
          ctx.fillStyle = unit.team === 1 || unit.team === "allied" || unit.team === "player"
            ? "#2563eb" // Bright Allied Blue
            : "#dc2626"; // Bright Enemy Red
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, scale * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 9. Draw viewport bounding box if present
    if (this.snapshot.viewport) {
      const vp = this.snapshot.viewport; // expects { x, z, width, depth } or similar in world space
      if (typeof vp.x === "number" && typeof vp.z === "number") {
        const width = vp.width || 8;
        const depth = vp.depth || 4;
        const topLeft = this.worldToMinimap(vp.x - width / 2, vp.z - depth / 2);
        const bottomRight = this.worldToMinimap(vp.x + width / 2, vp.z + depth / 2);
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      }
    }

    // 10. Draw focus reticle/highlight
    if (this.snapshot.focus) {
      const fx = Math.floor(this.snapshot.focus.x);
      const fy = Math.floor(this.snapshot.focus.y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX + fx * scale, offsetY + fy * scale, scale, scale);
      
      if (!this.reducedMotion) {
        // Draw an outer glowing pulse
        const pulse = (Date.now() % 1000) / 1000;
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - pulse})`;
        ctx.lineWidth = 1;
        const pad = pulse * scale * 0.4;
        ctx.strokeRect(
          offsetX + fx * scale - pad,
          offsetY + fy * scale - pad,
          scale + pad * 2,
          scale + pad * 2
        );
      }
    }

    // 11. Draw active keyboard focus cell (if canvas has focus)
    if (document.activeElement === this.canvas) {
      ctx.strokeStyle = "#eab308"; // Gold
      ctx.lineWidth = 2;
      ctx.strokeRect(
        offsetX + this.keyboardFocusCell.x * scale + 1,
        offsetY + this.keyboardFocusCell.y * scale + 1,
        scale - 2,
        scale - 2
      );
    }

    ctx.restore();
  }

  /**
   * Updates an accessible visually hidden overlay container with screen-reader friendly buttons.
   */
  updateAccessibleOverlay(snapshot) {
    if (!this.overlayContainer) {
      this.overlayContainer = document.createElement("div");
      this.overlayContainer.style.position = "absolute";
      this.overlayContainer.style.width = "1px";
      this.overlayContainer.style.height = "1px";
      this.overlayContainer.style.padding = "0";
      this.overlayContainer.style.margin = "-1px";
      this.overlayContainer.style.overflow = "hidden";
      this.overlayContainer.style.clip = "rect(0, 0, 0, 0)";
      this.overlayContainer.style.border = "0";
      this.canvas.parentNode.insertBefore(this.overlayContainer, this.canvas.nextSibling);
    }

    this.overlayContainer.innerHTML = "";

    const nav = snapshot.navigation;
    if (!nav) return;

    const createButton = (name, x, y, deployment = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = localizedLabel(
        deployment ? "battle.minimap.deploymentLocation" : "battle.minimap.location",
        { name, x: Math.floor(x), y: Math.floor(y) }
      );
      button.addEventListener("click", (event) => {
        event.preventDefault();
        this.keyboardFocusCell = { x: Math.floor(x), y: Math.floor(y) };
        this.setFocusCell(x, y);
        this.canvas.focus();
        this.announceFocus(Math.floor(x), Math.floor(y));
        this.draw();
      });
      this.overlayContainer.appendChild(button);
    };

    if (nav.anchors) {
      const anchors = nav.anchors;
      if (anchors.portal) {
        createButton(translate("battle.minimap.landmark.portal"), anchors.portal.x, anchors.portal.y);
      }
      if (anchors.boss) {
        createButton(translate("battle.minimap.landmark.boss"), anchors.boss.x, anchors.boss.y);
      }
      if (anchors.extractor) {
        createButton(translate("battle.minimap.landmark.extractor"), anchors.extractor.x, anchors.extractor.y);
      }
      if (anchors.nodes) {
        anchors.nodes.forEach((node, index) => {
          createButton(
            localizedLabel("battle.minimap.landmark.node", { index: index + 1 }),
            node.x,
            node.y
          );
        });
      }
    }

    if (snapshot.deployments) {
      snapshot.deployments.forEach((deployment) => {
        const dx = deployment.cell ? deployment.cell.x : deployment.x;
        const dy = deployment.cell ? deployment.cell.y : deployment.y;
        const name = translate(deployment.kind === "tower"
          ? "battle.minimap.landmark.tower"
          : "battle.minimap.landmark.barricade");
        createButton(name, dx, dy, true);
      });
    }
  }

  /**
   * Cleanup event listeners and DOM elements.
   */
  destroy() {
    this.canvas.removeEventListener("keydown", this.handleKeyDown);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("focus", this.handleFocus);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
    }
    if (this.liveStatus && this.liveStatus.parentNode) {
      this.liveStatus.parentNode.removeChild(this.liveStatus);
    }
  }
}
