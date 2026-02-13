const GRID_SIZE = 10;
const MAX_YEAR = 50;
const CELL_SIZE = 64;
const ALPHA = 0.8;
const BETA = 0.3;
const EXP_K = 1.8;

const DIRS = {
  N: { x: 0, y: -1, opposite: "S" },
  E: { x: 1, y: 0, opposite: "W" },
  S: { x: 0, y: 1, opposite: "N" },
  W: { x: -1, y: 0, opposite: "E" },
};

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = Array(n).fill(0);
  }
  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }
  union(a, b) {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra] += 1;
  }
}

const mulberry32 = (seed) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

function rotatePoint({ x, y }, rotation) {
  switch (rotation % 360) {
    case 90:
      return { x: -y, y: x };
    case 180:
      return { x: -x, y: -y };
    case 270:
      return { x: y, y: -x };
    default:
      return { x, y };
  }
}

function rotateDirection(dir, rotation) {
  const order = ["N", "E", "S", "W"];
  const idx = order.indexOf(dir);
  const step = (rotation / 90) % 4;
  return order[(idx + step + 4) % 4];
}

function normalizeShape(shape) {
  const minX = Math.min(...shape.map((p) => p.x));
  const minY = Math.min(...shape.map((p) => p.y));
  return shape.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

function rotateShape(shape, rotation) {
  return normalizeShape(shape.map((p) => rotatePoint(p, rotation)));
}

function rotatePorts(ports, rotation, shapeBefore, shapeAfter) {
  const minX = Math.min(...shapeBefore.map((p) => rotatePoint(p, rotation).x));
  const minY = Math.min(...shapeBefore.map((p) => rotatePoint(p, rotation).y));
  void shapeAfter;
  return ports.map((port) => {
    const rp = rotatePoint(port, rotation);
    return {
      x: rp.x - minX,
      y: rp.y - minY,
      dir: rotateDirection(port.dir, rotation),
    };
  });
}

function seededTemplates(seed = 42) {
  const rnd = mulberry32(seed);
  const presets = [
    {
      id: "residential-line",
      name: "線形住宅棟",
      shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      ports: [
        { x: 0, y: 0, dir: "N" },
        { x: 1, y: 0, dir: "S" },
      ],
      growthType: "linear",
      baseThreshold: 20,
      baseCap: 4,
      autoConnect: false,
      range: 0,
    },
    {
      id: "industry-l",
      name: "工業Lブロック",
      shape: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      ports: [
        { x: 0, y: 0, dir: "E" },
        { x: 0, y: 1, dir: "N" },
        { x: 1, y: 1, dir: "W" },
      ],
      growthType: "linear",
      baseThreshold: 26,
      baseCap: 5,
      autoConnect: true,
      range: 2,
    },
    {
      id: "hub-cross",
      name: "ハブ交差塔",
      shape: [{ x: 0, y: 0 }],
      ports: [
        { x: 0, y: 0, dir: "N" },
        { x: 0, y: 0, dir: "E" },
        { x: 0, y: 0, dir: "S" },
        { x: 0, y: 0, dir: "W" },
      ],
      growthType: "linear",
      baseThreshold: 22,
      baseCap: 6,
      autoConnect: true,
      range: 3,
    },
    {
      id: "research-z",
      name: "指数研究区画",
      shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      ports: [
        { x: 0, y: 0, dir: "E" },
        { x: 1, y: 0, dir: "S" },
        { x: 1, y: 1, dir: "W" },
      ],
      growthType: "exponential",
      baseThreshold: 28,
      baseCap: 5,
      autoConnect: true,
      range: 2,
    },
    {
      id: "power-core",
      name: "指数エネルギー炉",
      shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      ports: [
        { x: 0, y: 0, dir: "W" },
        { x: 1, y: 0, dir: "N" },
        { x: 1, y: 0, dir: "S" },
        { x: 2, y: 0, dir: "E" },
      ],
      growthType: "exponential",
      baseThreshold: 34,
      baseCap: 7,
      autoConnect: true,
      range: 3,
    },
  ];

  return presets.map((p) => ({
    ...p,
    portCount: p.ports.length,
    decay: 0.7 + rnd() * 0.5,
    baseSupplyFunction: (level) =>
      p.growthType === "linear" ? level * 5 : Math.pow(level, 1.5) * 4,
  }));
}

function createGameState(seed = 42) {
  return {
    year: 1,
    seed,
    grid: Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null)),
    buildings: [],
    clusters: [],
    cumulativeSupply: 0,
    logs: [],
  };
}

const state = createGameState(42);
const templates = seededTemplates(state.seed);

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const templateSelect = document.getElementById("template-select");
const rotationLabel = document.getElementById("rotation");
const templateInfo = document.getElementById("template-info");
const yearLog = document.getElementById("year-log");

let selectedTemplateId = templates[0].id;
let rotation = 0;
let previewCell = null;
let animationPulse = 0;

function getTemplate(id) {
  return templates.find((t) => t.id === id);
}

function getRotatedPlacement(templateId, rotationDeg, origin) {
  const tpl = getTemplate(templateId);
  const rotatedShape = rotateShape(tpl.shape, rotationDeg);
  const rotatedPorts = rotatePorts(tpl.ports, rotationDeg, tpl.shape, rotatedShape);
  return {
    cells: rotatedShape.map((p) => ({ x: origin.x + p.x, y: origin.y + p.y })),
    ports: rotatedPorts.map((p) => ({ x: origin.x + p.x, y: origin.y + p.y, dir: p.dir })),
    relativePorts: rotatedPorts,
    relativeShape: rotatedShape,
  };
}

function canPlace(templateId, rotationDeg, origin) {
  const placement = getRotatedPlacement(templateId, rotationDeg, origin);
  return placement.cells.every(
    (c) =>
      c.x >= 0 && c.x < GRID_SIZE && c.y >= 0 && c.y < GRID_SIZE &&
      state.grid[c.y][c.x] === null,
  );
}

function placeBuilding(templateId, rotationDeg, origin) {
  if (!canPlace(templateId, rotationDeg, origin)) return false;
  const template = getTemplate(templateId);
  const placement = getRotatedPlacement(templateId, rotationDeg, origin);
  const id = `b-${state.buildings.length + 1}`;
  const building = {
    id,
    templateId,
    rotation: rotationDeg,
    position: { ...origin },
    shape: placement.relativeShape,
    ports: placement.relativePorts,
    level: 1,
    storedSupply: 0,
    clusterId: null,
  };
  state.buildings.push(building);
  for (const c of placement.cells) {
    state.grid[c.y][c.x] = id;
  }
  recomputeConnections();
  return true;
}

function getAbsolutePorts(building) {
  return building.ports.map((p) => ({
    x: building.position.x + p.x,
    y: building.position.y + p.y,
    dir: p.dir,
  }));
}

function buildingCells(building) {
  return building.shape.map((p) => ({
    x: building.position.x + p.x,
    y: building.position.y + p.y,
  }));
}

function recomputeConnections() {
  const uf = new UnionFind(state.buildings.length);
  const links = [];

  for (let i = 0; i < state.buildings.length; i += 1) {
    for (let j = i + 1; j < state.buildings.length; j += 1) {
      const bi = state.buildings[i];
      const bj = state.buildings[j];
      const pi = getAbsolutePorts(bi);
      const pj = getAbsolutePorts(bj);

      let connected = false;
      for (const a of pi) {
        const d = DIRS[a.dir];
        for (const b of pj) {
          if (
            a.x + d.x === b.x &&
            a.y + d.y === b.y &&
            b.dir === d.opposite
          ) {
            connected = true;
            links.push({ a: i, b: j, type: "port", distance: 1, decay: 1 });
            break;
          }
        }
        if (connected) break;
      }

      if (!connected) {
        const ti = getTemplate(bi.templateId);
        const tj = getTemplate(bj.templateId);
        if (ti.autoConnect || tj.autoConnect) {
          const centersA = buildingCells(bi);
          const centersB = buildingCells(bj);
          let minManhattan = Infinity;
          for (const ca of centersA) {
            for (const cb of centersB) {
              const d = Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
              if (d < minManhattan) minManhattan = d;
            }
          }
          const range = Math.max(ti.range, tj.range);
          if (minManhattan <= range) {
            connected = true;
            const decay = (ti.decay + tj.decay) / 2;
            links.push({
              a: i,
              b: j,
              type: "auto",
              distance: minManhattan,
              decay,
            });
          }
        }
      }

      if (connected) uf.union(i, j);
    }
  }

  const clusterMap = new Map();
  for (let i = 0; i < state.buildings.length; i += 1) {
    const root = uf.find(i);
    if (!clusterMap.has(root)) clusterMap.set(root, []);
    clusterMap.get(root).push(i);
  }

  state.clusters = Array.from(clusterMap.entries()).map(([root, indexes], idx) => {
    const id = `c-${idx + 1}`;
    for (const bi of indexes) state.buildings[bi].clusterId = id;
    return {
      id,
      root,
      buildingIds: indexes.map((bi) => state.buildings[bi].id),
      indexes,
      totalSupply: 0,
      size: indexes.length,
      links: links.filter((l) => indexes.includes(l.a) && indexes.includes(l.b)),
    };
  });
}

function thresholdFor(building, level) {
  const tpl = getTemplate(building.templateId);
  return tpl.growthType === "linear"
    ? tpl.baseThreshold * level
    : tpl.baseThreshold * Math.pow(level, EXP_K);
}

function growthCapFor(building) {
  const tpl = getTemplate(building.templateId);
  const cluster = state.clusters.find((c) => c.id === building.clusterId);
  const clusterSize = cluster ? cluster.size : 1;
  const hubBonus = tpl.portCount >= 4 ? 2 : 0;
  return tpl.baseCap + Math.floor(clusterSize * 0.8) + hubBonus;
}

function shortestDistances(indexes, links) {
  const graph = new Map(indexes.map((i) => [i, []]));
  for (const l of links) {
    const w = l.type === "port" ? 1 : l.distance * l.decay;
    graph.get(l.a).push([l.b, w]);
    graph.get(l.b).push([l.a, w]);
  }
  const out = {};
  for (const start of indexes) {
    const dist = new Map(indexes.map((i) => [i, Infinity]));
    dist.set(start, 0);
    const q = [{ node: start, d: 0 }];
    while (q.length) {
      q.sort((a, b) => a.d - b.d);
      const cur = q.shift();
      if (cur.d > dist.get(cur.node)) continue;
      for (const [nxt, w] of graph.get(cur.node)) {
        const nd = cur.d + w;
        if (nd < dist.get(nxt)) {
          dist.set(nxt, nd);
          q.push({ node: nxt, d: nd });
        }
      }
    }
    out[start] = dist;
  }
  return out;
}

function supplyPhase() {
  for (const cluster of state.clusters) {
    const supplyByBuilding = cluster.indexes.map((idx) => {
      const b = state.buildings[idx];
      return getTemplate(b.templateId).baseSupplyFunction(b.level);
    });
    const S = supplyByBuilding.reduce((a, b) => a + b, 0);
    cluster.totalSupply = S;
    state.cumulativeSupply += S;

    const dists = shortestDistances(cluster.indexes, cluster.links);
    const weights = cluster.indexes.map((idx) => {
      const b = state.buildings[idx];
      const tpl = getTemplate(b.templateId);
      const distMap = dists[idx];
      let nearest = Infinity;
      for (const [j, d] of distMap.entries()) {
        if (j !== idx && d < nearest) nearest = d;
      }
      const dist = Number.isFinite(nearest) ? nearest : 0;
      const weight = tpl.portCount * Math.pow(b.level, ALPHA) * (1 / (1 + dist * BETA));
      return Math.max(0.01, weight);
    });
    const sumW = weights.reduce((a, b) => a + b, 0);

    cluster.indexes.forEach((idx, localIdx) => {
      const share = S * (weights[localIdx] / sumW);
      state.buildings[idx].storedSupply += share;
    });
  }
}

function levelUpPhase() {
  for (const b of state.buildings) {
    let guard = 0;
    while (b.level < growthCapFor(b) && b.storedSupply >= thresholdFor(b, b.level) && guard < 999) {
      b.storedSupply -= thresholdFor(b, b.level);
      b.level += 1;
      guard += 1;
    }
  }
}

function computeScore() {
  const scoreLevel = state.buildings.reduce((s, b) => s + b.level, 0);
  const scoreEconomy = state.cumulativeSupply * 0.1;
  const complexitySum = state.buildings.reduce((sum, b) => {
    const tpl = getTemplate(b.templateId);
    const dirs = new Set(tpl.ports.map((p) => p.dir)).size;
    let c = tpl.shape.length + tpl.portCount * 1.5 + dirs * 2;
    if (tpl.growthType === "exponential") c += b.level * 2;
    return sum + c;
  }, 0);
  return scoreLevel + scoreEconomy + complexitySum;
}

function nextYear() {
  if (state.year > MAX_YEAR) return;
  recomputeConnections();
  supplyPhase();
  levelUpPhase();
  const summary = `Year ${state.year}: clusters=${state.clusters.length}, supply=${state.clusters
    .reduce((s, c) => s + c.totalSupply, 0)
    .toFixed(2)}, topLv=${Math.max(0, ...state.buildings.map((b) => b.level))}`;
  state.logs.unshift(summary);
  state.logs = state.logs.slice(0, 100);
  state.year += 1;
  animationPulse = 1;
  render();
}

function resetGame() {
  const fresh = createGameState(state.seed);
  Object.assign(state, fresh);
  rotation = 0;
  render();
}

function renderHUD() {
  document.getElementById("year").textContent = String(Math.min(state.year, MAX_YEAR));
  document.getElementById("building-count").textContent = String(state.buildings.length);
  document.getElementById("cluster-count").textContent = String(state.clusters.length);
  document.getElementById("cumulative-supply").textContent = state.cumulativeSupply.toFixed(2);
  document.getElementById("score").textContent = computeScore().toFixed(2);
  rotationLabel.textContent = `${rotation}°`;

  const tpl = getTemplate(selectedTemplateId);
  templateInfo.innerHTML = `
    <p><strong>${tpl.name}</strong> (${tpl.id})</p>
    <p>成長: ${tpl.growthType}, port=${tpl.portCount}, baseCap=${tpl.baseCap}</p>
    <p>threshold=${tpl.baseThreshold}, auto=${tpl.autoConnect ? `ON(r=${tpl.range})` : "OFF"}</p>
  `;

  yearLog.innerHTML = state.logs
    .map((x) => `<li>${x}</li>`)
    .join("");
}

function clusterColor(clusterId) {
  const index = Math.max(0, state.clusters.findIndex((c) => c.id === clusterId));
  const hue = (index * 67) % 360;
  return `hsl(${hue},70%,50%)`;
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#25314e";
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
    ctx.stroke();
  }
}

function drawBuilding(building) {
  const color = clusterColor(building.clusterId);
  for (const c of buildingCells(building)) {
    ctx.fillStyle = color;
    ctx.fillRect(c.x * CELL_SIZE + 3, c.y * CELL_SIZE + 3, CELL_SIZE - 6, CELL_SIZE - 6);
  }
  const absPorts = getAbsolutePorts(building);
  for (const p of absPorts) {
    const cx = p.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = p.y * CELL_SIZE + CELL_SIZE / 2;
    const d = DIRS[p.dir];
    ctx.strokeStyle = "#eaf4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + d.x * 18, cy + d.y * 18);
    ctx.stroke();
  }

  const center = buildingCells(building)[0];
  ctx.fillStyle = "#021018";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`L${building.level}`, center.x * CELL_SIZE + 8, center.y * CELL_SIZE + 18);
}

function drawLinks() {
  const pulse = 0.4 + 0.6 * Math.sin(animationPulse * Math.PI);
  for (const c of state.clusters) {
    for (const link of c.links) {
      const a = buildingCells(state.buildings[link.a])[0];
      const b = buildingCells(state.buildings[link.b])[0];
      ctx.strokeStyle = link.type === "auto" ? `rgba(92,210,255,${0.25 * pulse})` : `rgba(255,255,255,${0.2 * pulse})`;
      ctx.lineWidth = link.type === "auto" ? 1.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x * CELL_SIZE + CELL_SIZE / 2, a.y * CELL_SIZE + CELL_SIZE / 2);
      ctx.lineTo(b.x * CELL_SIZE + CELL_SIZE / 2, b.y * CELL_SIZE + CELL_SIZE / 2);
      ctx.stroke();
    }
  }
}

function drawPreview() {
  if (!previewCell) return;
  const ok = canPlace(selectedTemplateId, rotation, previewCell);
  const placement = getRotatedPlacement(selectedTemplateId, rotation, previewCell);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ok ? "#58f59a" : "#f35b6b";
  for (const c of placement.cells) {
    if (c.x < 0 || c.x >= GRID_SIZE || c.y < 0 || c.y >= GRID_SIZE) continue;
    ctx.fillRect(c.x * CELL_SIZE + 6, c.y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12);
  }
  ctx.globalAlpha = 1;
}

function render() {
  recomputeConnections();
  drawGrid();
  drawLinks();
  state.buildings.forEach(drawBuilding);
  drawPreview();
  renderHUD();
}

templateSelect.innerHTML = templates
  .map((t) => `<option value="${t.id}">${t.name} (${t.growthType})</option>`)
  .join("");

templateSelect.addEventListener("change", (e) => {
  selectedTemplateId = e.target.value;
  render();
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_SIZE);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_SIZE);
  previewCell = { x, y };
  render();
});

canvas.addEventListener("mouseleave", () => {
  previewCell = null;
  render();
});

canvas.addEventListener("click", () => {
  if (!previewCell) return;
  placeBuilding(selectedTemplateId, rotation, previewCell);
  render();
});

document.getElementById("rotate-btn").addEventListener("click", () => {
  rotation = (rotation + 90) % 360;
  render();
});

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") {
    rotation = (rotation + 90) % 360;
    render();
  }
});

document.getElementById("next-year-btn").addEventListener("click", nextYear);
document.getElementById("run-all-btn").addEventListener("click", () => {
  while (state.year <= MAX_YEAR) nextYear();
  render();
});
document.getElementById("reset-btn").addEventListener("click", resetGame);

function animate() {
  if (animationPulse > 0) {
    animationPulse = Math.max(0, animationPulse - 0.05);
    render();
  }
  requestAnimationFrame(animate);
}

render();
animate();
