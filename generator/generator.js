import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TRAITS = {
  materials: {
    "Stone Series": [
      "Granite", "Marble", "Obsidian", "Basalt", "Slate", "Limestone",
      "Sandstone", "Jade", "Onyx", "Quartz", "Soapstone", "Moonstone",
      "Meteorite Rock", "Fossil Stone", "Ancient Ruins"
    ],
    "Crystal & Gem Series": [
      "Diamond", "Emerald", "Ruby", "Sapphire", "Amethyst", "Topaz",
      "Citrine", "Opal", "Aquamarine", "Garnet", "Peridot", "Black Crystal",
      "Prism Crystal", "Rainbow Crystal", "Ice Crystal", "Void Crystal"
    ],
    "Metal Series": [
      "Iron", "Steel", "Gold", "Rose Gold", "White Gold", "Platinum",
      "Silver", "Bronze", "Copper", "Titanium", "Chrome", "Mercury",
      "Black Metal", "Rusted Metal", "Damascus Steel"
    ],
    "Elemental Series": [
      "Fire", "Lava", "Magma", "Smoke", "Ash", "Ember", "Water", "Ice",
      "Frost", "Storm", "Lightning", "Wind", "Sand", "Mud", "Nature",
      "Poison", "Toxic Slime"
    ],
    "Cosmic Series": [
      "Galaxy", "Nebula", "Star Dust", "Black Hole", "Dark Matter",
      "Solar Flare", "Lunar", "Aurora", "Cosmic Energy", "Supernova",
      "Celestial", "Space Glass"
    ],
    "Ethereal Series": [
      "Ghost", "Spirit", "Shadow", "Phantom", "Soul Flame", "Void",
      "Dream", "Nightmare", "Astral", "Ethereal Light", "Angelic", "Demonic"
    ],
    "Organic Series": [
      "Flesh", "Bone", "Muscle", "Bark", "Moss", "Vine", "Coral",
      "Mushroom", "Flower Petals", "Leaves", "Bamboo", "Scales",
      "Chitin", "Feather", "Fur"
    ],
    "Fantasy Series": [
      "Candy", "Chocolate", "Honey", "Jelly", "Glass", "Liquid Gold",
      "Ink", "Paint", "Wax", "Clay", "Ceramic", "Porcelain", "Paper", "Origami"
    ],
    "Digital Series": [
      "Pixel", "Wireframe", "Matrix Code", "Binary", "Hologram", "Glitch",
      "Neon", "RGB", "Synthwave", "Vaporwave", "Cyber Grid", "AI Circuit", "Data Stream"
    ]
  },
  bodyTypes: {
    Classic: ["Classic", "Smooth", "Round", "Thick", "Slim", "Segmented", "Square", "Flat", "Tapered"],
    Dragon: [
      "Dragon Inspired", "Eastern Dragon", "Western Dragon", "Horned Dragon",
      "Feathered Dragon", "Sea Dragon", "Celestial Dragon", "Skeleton Dragon", "Ancient Dragon"
    ],
    Mechanical: [
      "Mechanical", "Robot", "Android", "Clockwork", "Steam Powered",
      "Hydraulic", "Cybernetic", "Industrial", "Nanobot", "Alien Machine"
    ],
    Mythical: [
      "Hydra", "Basilisk", "Leviathan", "Seraphic", "Phoenix Scaled",
      "Titan", "Serpent God", "Ouroboros", "Cosmic Serpent"
    ],
    Nature: [
      "Tree Root", "Vine", "Coral", "Bamboo", "Mushroom", "Flower Stem",
      "Thorned", "Moss Covered", "Ivy Wrapped"
    ],
    Ocean: ["Eel", "Koi", "Sea Serpent", "Octopus Tentacle", "Jellyfish", "Coral Snake", "Deep Sea", "Shark Skin"],
    Insect: ["Centipede", "Millipede", "Beetle Shell", "Ant Segments", "Scorpion Tail", "Spider Legs", "Wasp Armor"],
    Horror: [
      "Skeleton", "Zombie", "Parasite", "Eyeball Covered", "Teeth Covered",
      "Flesh Torn", "Rib Cage", "Eldritch", "Tentacle Hybrid"
    ],
    "Pixel Art Styles": ["8-bit", "16-bit", "Monochrome", "Retro Arcade", "CRT", "Hand Dithered", "LCD", "Voxel", "ASCII"],
    "Sci-Fi": [
      "Plasma Core", "Energy Conduit", "Quantum", "Anti-Matter",
      "Nano Swarm", "Liquid Metal", "Holographic", "AI Core", "Digital Virus"
    ]
  },
  auras: ["None", "Fire", "Frost", "Shadow", "Lightning", "Rainbow", "Smoke", "Poison", "Cosmic", "Neon", "Ghost", "Lava"],
  eyes: ["Single", "Twin", "Triple", "Glowing", "Crystal", "Mechanical", "Void", "Flame", "Pixel", "Blind"],
  accessories: [
    "None", "Crown", "Halo", "Horns", "Wings", "Spikes", "Fins", "Antlers",
    "Floating Orbs", "Chains", "Flowers", "Runes", "Glowing Eyes", "Third Eye",
    "Masks", "Back Crystals", "Tail Blade", "Floating Particles", "Smoke Aura",
    "Lightning Aura", "Fire Aura"
  ],
  animationStyles: ["Idle Glow", "Breathing", "Tail Flick", "Pulse", "Wave", "Shimmer", "Static Flicker", "Orbit", "Flame Lick", "Data Flow"]
};

const RARITY_WEIGHTS = [
  { name: "Common",    weight: 520 },
  { name: "Uncommon",  weight: 260 },
  { name: "Rare",      weight: 140 },
  { name: "Epic",      weight: 60  },
  { name: "Legendary", weight: 18  },
  { name: "Mythic",    weight: 2   }
];

const SERIES_WEIGHTS = {
  "Stone Series":        135,
  "Organic Series":      125,
  "Metal Series":        120,
  "Fantasy Series":      110,
  "Elemental Series":    105,
  "Crystal & Gem Series": 95,
  "Digital Series":       90,
  "Ethereal Series":      70,
  "Cosmic Series":        55
};

const BODY_WEIGHTS = {
  Classic:           160,
  Nature:            120,
  Ocean:             110,
  Mechanical:        100,
  Dragon:             95,
  "Pixel Art Styles": 90,
  Insect:             80,
  "Sci-Fi":           75,
  Mythical:           55,
  Horror:             45
};

const PALETTES = {
  default:       ["#77d879", "#265c34", "#e8ffd9"],
  Fire:          ["#ff6b1a", "#7b1808", "#ffd166"],
  Lava:          ["#ff3d00", "#2b0703", "#ffb703"],
  Ice:           ["#a8f1ff", "#1d5d7a", "#ffffff"],
  Frost:         ["#d9fbff", "#487a96", "#ffffff"],
  Lightning:     ["#f9fb7d", "#4657ff", "#ffffff"],
  Water:         ["#30c5ff", "#064c72", "#c7f9ff"],
  Poison:        ["#baff29", "#3f5f0d", "#f0ff84"],
  "Toxic Slime": ["#6fff00", "#225400", "#d6ff5c"],
  Jade:          ["#00a878", "#064f3c", "#d8ffe8"],
  Obsidian:      ["#1a1625", "#06040a", "#6b5cff"],
  Onyx:          ["#111318", "#030406", "#c8ccd5"],
  Diamond:       ["#d8fbff", "#7fb5cc", "#ffffff"],
  Emerald:       ["#00c878", "#075636", "#b9ffd7"],
  Ruby:          ["#e61946", "#620015", "#ffc2ce"],
  Sapphire:      ["#2667ff", "#091d7a", "#c7dcff"],
  Amethyst:      ["#9d4edd", "#3c096c", "#f3d9ff"],
  Gold:          ["#f7b801", "#7a4d00", "#fff4b8"],
  "Rose Gold":   ["#f7a8a8", "#7f3636", "#ffe0d6"],
  Silver:        ["#d9e2ec", "#58616d", "#ffffff"],
  Chrome:        ["#dce5ef", "#2d3440", "#9fffff"],
  "Black Metal": ["#15171c", "#050507", "#b5bcc8"],
  Galaxy:        ["#6d5dfc", "#080414", "#ff7ad9"],
  Nebula:        ["#ff5fd2", "#1a0636", "#4be3ff"],
  Void:          ["#07000f", "#000000", "#9b5cff"],
  Hologram:      ["#65f7ff", "#3b2a86", "#ff75e6"],
  Glitch:        ["#00fff0", "#0b0b12", "#ff006e"],
  Neon:          ["#28ffbf", "#09111f", "#ff2bd6"],
  Matrix:        ["#36ff6f", "#031107", "#a8ffbf"],
  Bone:          ["#e8dcc5", "#6d6047", "#fff8e8"],
  Bark:          ["#8b5a2b", "#3d2412", "#c89b63"],
  Coral:         ["#ff7f6e", "#7b2e38", "#ffd1c7"],
  Candy:         ["#ff70c8", "#4b1d7a", "#b8fff7"],
  Glass:         ["#b8f7ff", "#3a7080", "#ffffff"],
  Ink:           ["#16151f", "#03030a", "#6688ff"],
  Pixel:         ["#8cff4a", "#183b1c", "#fbff87"]
};

// ─── RNG ─────────────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input) {
  const text = String(input);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weightedPick(entries, random) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries.at(-1);
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function flattenSeries(seriesMap) {
  return Object.entries(seriesMap).flatMap(([series, values]) =>
    values.map((value) => ({ series, value }))
  );
}

function rarityBoostedPick(items, seriesWeights, random, rarity) {
  const rarityBias = {
    Common: 0.3, Uncommon: 0.55, Rare: 0.8,
    Epic: 1.05, Legendary: 1.35, Mythic: 1.7
  }[rarity.name];

  return weightedPick(
    items.map((item, index) => {
      const base = seriesWeights[item.series] ?? 100;
      const tailBoost = 1 + (index / items.length) * rarityBias;
      return { ...item, weight: base / tailBoost + tailBoost * 12 };
    }),
    random
  );
}

// ─── SNAKE PATH ──────────────────────────────────────────────────────────────

/**
 * Generates a snake path on a pixel grid.
 * Each segment is exactly pixelSize apart (true to the game).
 * The snake travels horizontally and turns on whole-cell Y increments.
 */
function makePixelSnake(random, options = {}) {
  const length = options.length ?? 34 + Math.floor(random() * 28);
  const pixelSize = options.pixelSize ?? 28;
  const canvasSize = options.canvasSize ?? 900;
  const margin = 82;
  const walkLimit = 20;
  const maxSpan = Math.floor((canvasSize - margin * 2) / pixelSize);
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
  ];

  const keyFor = (block) => `${block.x},${block.y}`;
  const isSameDirection = (a, b) => a.x === b.x && a.y === b.y;
  const hasClearHeadSpace = (blocks, finalDirection, occupiedCells) => {
    const head = blocks.at(-1);
    const frontOne = { x: head.x + finalDirection.x, y: head.y + finalDirection.y };
    const frontTwo = { x: head.x + finalDirection.x * 2, y: head.y + finalDirection.y * 2 };
    return !occupiedCells.has(keyFor(frontOne)) && !occupiedCells.has(keyFor(frontTwo));
  };
  const touchesBodyTooClosely = (candidate, current, occupiedCells) => {
    const adjacent = [
      { x: candidate.x + 1, y: candidate.y },
      { x: candidate.x - 1, y: candidate.y },
      { x: candidate.x, y: candidate.y + 1 },
      { x: candidate.x, y: candidate.y - 1 }
    ];
    return adjacent.some((neighbor) => {
      return keyFor(neighbor) !== keyFor(current) && occupiedCells.has(keyFor(neighbor));
    });
  };
  const exceedsClusterLimit = (candidate, blocks) => {
    return [...blocks, candidate].some((center) => {
      const count = blocks.reduce((total, block) => {
        const inside = Math.abs(block.x - center.x) <= 1 && Math.abs(block.y - center.y) <= 1;
        return total + (inside ? 1 : 0);
      }, Math.abs(candidate.x - center.x) <= 1 && Math.abs(candidate.y - center.y) <= 1 ? 1 : 0);
      return count > 4;
    });
  };
  const exceedsCanvasSpan = (candidate, blocks) => {
    const nextBlocks = [...blocks, candidate];
    const xs = nextBlocks.map((block) => block.x);
    const ys = nextBlocks.map((block) => block.y);
    return Math.max(...xs) - Math.min(...xs) > maxSpan || Math.max(...ys) - Math.min(...ys) > maxSpan;
  };

  const makeAttempt = () => {
    let direction = pick(directions, random);
    const local = [{ x: 0, y: 0 }];
    const occupied = new Set(["0,0"]);
    let straightRun = 1;

    for (let i = 1; i < length; i++) {
      const current = local.at(-1);
      const left = { x: -direction.y, y: direction.x };
      const right = { x: direction.y, y: -direction.x };
      const back = { x: -direction.x, y: -direction.y };
      const turnFirst = random() < 0.16 || straightRun >= 12;
      const firstTurn = random() < 0.5 ? left : right;
      const secondTurn = firstTurn === left ? right : left;
      const candidates = turnFirst
        ? [firstTurn, secondTurn, direction, back]
        : [direction, firstTurn, secondTurn, back];

      const nextDirection = candidates.find((candidate) => {
        const nx = current.x + candidate.x;
        const ny = current.y + candidate.y;
        const key = `${nx},${ny}`;
        const next = { x: nx, y: ny };
        return (
          Math.abs(nx) <= walkLimit &&
          Math.abs(ny) <= walkLimit &&
          !occupied.has(key) &&
          !touchesBodyTooClosely(next, current, occupied) &&
          !exceedsClusterLimit(next, local) &&
          !exceedsCanvasSpan(next, local)
        );
      });

      if (!nextDirection) break;
      straightRun = isSameDirection(direction, nextDirection) ? straightRun + 1 : 1;
      direction = nextDirection;
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      local.push(next);
      occupied.add(keyFor(next));
    }

    while (local.length > 2 && !hasClearHeadSpace(local, direction, occupied)) {
      const removed = local.pop();
      occupied.delete(keyFor(removed));
    }

    return local;
  };

  let local = makeAttempt();
  for (let attempt = 1; attempt < 60 && local.length < length; attempt++) {
    const candidate = makeAttempt();
    if (candidate.length > local.length) local = candidate;
  }

  const minX = Math.min(...local.map((block) => block.x));
  const maxX = Math.max(...local.map((block) => block.x));
  const minY = Math.min(...local.map((block) => block.y));
  const maxY = Math.max(...local.map((block) => block.y));
  const minOffsetX = margin - minX * pixelSize;
  const maxOffsetX = canvasSize - margin - maxX * pixelSize;
  const minOffsetY = margin - minY * pixelSize;
  const maxOffsetY = canvasSize - margin - maxY * pixelSize;
  const offsetCellsX = Math.floor(minOffsetX / pixelSize) + Math.floor(random() * (Math.floor(maxOffsetX / pixelSize) - Math.floor(minOffsetX / pixelSize) + 1));
  const offsetCellsY = Math.floor(minOffsetY / pixelSize) + Math.floor(random() * (Math.floor(maxOffsetY / pixelSize) - Math.floor(minOffsetY / pixelSize) + 1));
  const offsetX = offsetCellsX * pixelSize;
  const offsetY = offsetCellsY * pixelSize;

  return local.map((block, index) => ({
    index,
    x: offsetX + block.x * pixelSize,
    y: offsetY + block.y * pixelSize
  }));
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getPalette(material, aura) {
  return PALETTES[material] ?? PALETTES[aura] ?? PALETTES.default;
}

function snakeStats(blocks) {
  const xs = blocks.map((b) => b.x);
  const ys = blocks.map((b) => b.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    length: blocks.length,
    bounds: {
      minX: +minX.toFixed(2), minY: +minY.toFixed(2),
      maxX: +maxX.toFixed(2), maxY: +maxY.toFixed(2),
      width:  +(maxX - minX).toFixed(2),
      height: +(maxY - minY).toFixed(2)
    }
  };
}

// ─── HEAD ─────────────────────────────────────────────────────────────────────

/**
 * Detects facing direction from the last two blocks and draws:
 *  - Head square with inner inset
 *  - Snout extending in the facing direction
 *  - Two pixel nostrils on snout
 *  - Forked tongue beyond snout
 *  - Two pixel eyes (with pupil + shine) on the opposite side
 */
function buildHead(blocks, pixelSize, palette) {
  const head = blocks.at(-1);
  const neck = blocks.at(-2) ?? blocks.at(-1);

  const dx = head.x - neck.x;
  const dy = head.y - neck.y;

  // Primary direction
  const facing = Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? "right" : "left")
    : (dy >= 0 ? "down" : "up");

  const hx = head.x;
  const hy = head.y;
  const hs = pixelSize;         // head square side
  const half = Math.floor(hs / 2);

  // Snout dimensions
  const snoutLen = 10;
  const snoutH   = Math.floor(hs * 0.55);
  const snoutOff = Math.floor((hs - snoutH) / 2); // centre snout on head face

  // Tongue dimensions
  const tongueBase = 10;
  const tongueFork = 9;
  const forkSpread = 5;

  // Nostril size
  const nw = 3, nh = 3;

  let parts = [];

  // ── HEAD SQUARE ──
  // Outer square
  parts.push(
    `<rect x="${hx - half}" y="${hy - half}" width="${hs}" height="${hs}" ` +
    `fill="${palette[0]}" stroke="#05070a" stroke-width="3" shape-rendering="crispEdges"/>`
  );
  // Inner inset (2 shades to give depth)
  const inset = 4;
  parts.push(
    `<rect x="${hx - half + inset}" y="${hy - half + inset}" ` +
    `width="${hs - inset * 2}" height="${hs - inset * 2}" ` +
    `fill="${palette[1]}" shape-rendering="crispEdges"/>`
  );

  if (facing === "right") {
    // ── SNOUT (right) ──
    const sx = hx + half - 2;
    const sy = hy - Math.floor(snoutH / 2);
    parts.push(
      `<rect x="${sx}" y="${sy}" width="${snoutLen}" height="${snoutH}" ` +
      `fill="${palette[0]}" stroke="#05070a" stroke-width="2" shape-rendering="crispEdges"/>`
    );
    // Nostrils
    parts.push(`<rect x="${sx + 2}" y="${sy + 2}" width="${nw}" height="${nh}" fill="#05070a" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${sx + 2}" y="${sy + snoutH - nh - 2}" width="${nw}" height="${nh}" fill="#05070a" shape-rendering="crispEdges"/>`);
    // Tongue base
    const tx = sx + snoutLen;
    const tmid = hy;
    parts.push(`<rect x="${tx}" y="${tmid - 2}" width="${tongueBase}" height="4" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    // Fork
    parts.push(`<rect x="${tx + tongueBase - 2}" y="${tmid - 2 - forkSpread}" width="${tongueFork}" height="3" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${tx + tongueBase - 2}" y="${tmid + 2 + forkSpread - 3}" width="${tongueFork}" height="3" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    // Eyes (left side of head)
    const ex = hx - half + 6;
    buildEyes(parts, ex, hy, "vertical", palette);

  } else if (facing === "left") {
    // ── SNOUT (left) ──
    const sx = hx - half - snoutLen + 2;
    const sy = hy - Math.floor(snoutH / 2);
    parts.push(
      `<rect x="${sx}" y="${sy}" width="${snoutLen}" height="${snoutH}" ` +
      `fill="${palette[0]}" stroke="#05070a" stroke-width="2" shape-rendering="crispEdges"/>`
    );
    // Nostrils
    parts.push(`<rect x="${sx + snoutLen - nw - 2}" y="${sy + 2}" width="${nw}" height="${nh}" fill="#05070a" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${sx + snoutLen - nw - 2}" y="${sy + snoutH - nh - 2}" width="${nw}" height="${nh}" fill="#05070a" shape-rendering="crispEdges"/>`);
    // Tongue base
    const tx = sx - tongueBase;
    const tmid = hy;
    parts.push(`<rect x="${tx}" y="${tmid - 2}" width="${tongueBase}" height="4" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    // Fork
    parts.push(`<rect x="${tx - tongueFork + 2}" y="${tmid - 2 - forkSpread}" width="${tongueFork}" height="3" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${tx - tongueFork + 2}" y="${tmid + 2 + forkSpread - 3}" width="${tongueFork}" height="3" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    // Eyes (right side of head)
    const ex = hx + half - 14;
    buildEyes(parts, ex, hy, "vertical", palette);

  } else if (facing === "down") {
    // ── SNOUT (down) ──
    const sx = hx - Math.floor(snoutH / 2);
    const sy = hy + half - 2;
    parts.push(
      `<rect x="${sx}" y="${sy}" width="${snoutH}" height="${snoutLen}" ` +
      `fill="${palette[0]}" stroke="#05070a" stroke-width="2" shape-rendering="crispEdges"/>`
    );
    // Nostrils
    parts.push(`<rect x="${sx + 2}" y="${sy + 2}" width="${nh}" height="${nw}" fill="#05070a" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${sx + snoutH - nh - 2}" y="${sy + 2}" width="${nh}" height="${nw}" fill="#05070a" shape-rendering="crispEdges"/>`);
    // Tongue
    const ty = sy + snoutLen;
    parts.push(`<rect x="${hx - 2}" y="${ty}" width="4" height="${tongueBase}" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${hx - 2 - forkSpread}" y="${ty + tongueBase - 2}" width="3" height="${tongueFork}" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${hx + 2 + forkSpread - 3}" y="${ty + tongueBase - 2}" width="3" height="${tongueFork}" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    // Eyes (top of head)
    buildEyes(parts, hx, hy - half + 6, "horizontal", palette);

  } else { // up
    // ── SNOUT (up) ──
    const sx = hx - Math.floor(snoutH / 2);
    const sy = hy - half - snoutLen + 2;
    parts.push(
      `<rect x="${sx}" y="${sy}" width="${snoutH}" height="${snoutLen}" ` +
      `fill="${palette[0]}" stroke="#05070a" stroke-width="2" shape-rendering="crispEdges"/>`
    );
    // Nostrils
    parts.push(`<rect x="${sx + 2}" y="${sy + snoutLen - nw - 2}" width="${nh}" height="${nw}" fill="#05070a" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${sx + snoutH - nh - 2}" y="${sy + snoutLen - nw - 2}" width="${nh}" height="${nw}" fill="#05070a" shape-rendering="crispEdges"/>`);
    // Tongue
    const ty = sy - tongueBase;
    parts.push(`<rect x="${hx - 2}" y="${ty}" width="4" height="${tongueBase}" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${hx - 2 - forkSpread}" y="${ty - tongueFork + 2}" width="3" height="${tongueFork}" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    parts.push(`<rect x="${hx + 2 + forkSpread - 3}" y="${ty - tongueFork + 2}" width="3" height="${tongueFork}" fill="#ff3a6e" shape-rendering="crispEdges"/>`);
    // Eyes (bottom of head)
    buildEyes(parts, hx, hy + half - 14, "horizontal", palette);
  }

  return parts.join("\n  ");
}

/**
 * Draws two pixel eyes at the given anchor position.
 * layout "vertical"   → eyes stacked top/bottom of anchor (used for left/right facing)
 * layout "horizontal" → eyes side by side left/right of anchor (used for up/down facing)
 */
function buildEyes(parts, ax, ay, layout, palette) {
  const eyeSize   = 8;
  const pupilSize = 4;
  const spread    = 9;

  let positions;
  if (layout === "vertical") {
    positions = [
      { x: ax, y: ay - spread },
      { x: ax, y: ay + spread }
    ];
  } else {
    positions = [
      { x: ax - spread, y: ay },
      { x: ax + spread, y: ay }
    ];
  }

  for (const { x, y } of positions) {
    const ex = x - Math.floor(eyeSize / 2);
    const ey = y - Math.floor(eyeSize / 2);
    // White
    parts.push(
      `<rect x="${ex}" y="${ey}" width="${eyeSize}" height="${eyeSize}" ` +
      `fill="${palette[2]}" stroke="#05070a" stroke-width="1.5" shape-rendering="crispEdges"/>`
    );
    // Pupil (bottom-right of eye for depth direction cue)
    const px = ex + eyeSize - pupilSize - 1;
    const py = ey + eyeSize - pupilSize - 1;
    parts.push(`<rect x="${px}" y="${py}" width="${pupilSize}" height="${pupilSize}" fill="#05070a" shape-rendering="crispEdges"/>`);
    // Shine (top-left pixel)
    parts.push(`<rect x="${ex + 1}" y="${ey + 1}" width="2" height="2" fill="#ffffff" shape-rendering="crispEdges"/>`);
  }
}

// ─── BODY ────────────────────────────────────────────────────────────────────

/**
 * Renders body segments in classic snake-game style:
 *  - Uniform square segments
 *  - 2px gap between segments
 *  - Alternating between palette[0] (primary) and a slight blend toward palette[1]
 *  - Tail tapers to ~60% size
 *  - Mechanical/Segmented bodies get a subtle inner border
 */
function buildBody(blocks, pixelSize, palette, bodyType) {
  const gap      = 0;
  const segSize  = pixelSize - gap;
  const isMech   = bodyType.includes("Mechanical") || bodyType.includes("Segmented") ||
                   bodyType.includes("Robot") || bodyType.includes("Clockwork");

  return blocks
    .map((block, index) => {
      const isHead = index === blocks.length - 1;
      if (isHead) return "";

      const isTail = index === 0;
      const progress = index / (blocks.length - 1); // 0 at tail, 1 at head

      // Size: tail tapers, then full size
      const size = isTail
        ? Math.round(segSize * 0.55)
        : index === 1
        ? Math.round(segSize * 0.75)
        : segSize;

      const half = Math.floor(size / 2);

      // Colour: alternate between palette[0] and palette[1], slight opacity fade toward tail
      const fill   = index % 2 === 0 ? palette[0] : palette[1];
      const opacity = (0.78 + progress * 0.22).toFixed(2);

      // Stroke: mechanical gets inner detail line
      const strokeColor = isMech ? palette[2] : palette[1];
      const strokeW     = isMech ? "2" : "1";

      // Tail gets rounded ends
      const rx = isTail ? "4" : "2";

      return (
        `<rect x="${block.x - half}" y="${block.y - half}" ` +
        `width="${size}" height="${size}" rx="${rx}" ` +
        `fill="${fill}" opacity="${opacity}" ` +
        `stroke="${strokeColor}" stroke-width="${strokeW}" ` +
        `shape-rendering="crispEdges"/>`
      );
    })
    .join("\n  ");
}

// ─── ACCESSORIES & AURA ──────────────────────────────────────────────────────

function decorativeLayer(accessory, blocks, palette) {
  const head = blocks.at(-1);
  const tail = blocks[0];
  const cx = head.x, cy = head.y;
  const tx = tail.x, ty = tail.y;

  if (accessory === "None") return "";

  if (accessory === "Crown") {
    return (
      `<path d="M ${cx-14} ${cy-20} L ${cx-7} ${cy-38} L ${cx} ${cy-20} ` +
      `L ${cx+7} ${cy-38} L ${cx+14} ${cy-20} Z" ` +
      `fill="#ffd166" stroke="#5c3b00" stroke-width="2" shape-rendering="crispEdges"/>`
    );
  }
  if (accessory === "Halo") {
    return (
      `<rect x="${cx-28}" y="${cy-38}" width="56" height="12" ` +
      `fill="none" stroke="#fff5a8" stroke-width="4" opacity=".9" shape-rendering="crispEdges"/>`
    );
  }
  if (accessory === "Horns" || accessory === "Antlers") {
    return (
      `<path d="M ${cx-13} ${cy-14} L ${cx-32} ${cy-40} ` +
      `M ${cx+13} ${cy-14} L ${cx+32} ${cy-40}" ` +
      `stroke="#f8f1df" stroke-width="6" stroke-linecap="round" fill="none"/>`
    );
  }
  if (accessory === "Wings") {
    return (
      `<path d="M ${cx-18} ${cy} C ${cx-90} ${cy-52} ${cx-72} ${cy+38} ${cx-26} ${cy+20}" ` +
      `fill="${palette[2]}" opacity=".35"/>` +
      `<path d="M ${cx+18} ${cy} C ${cx+90} ${cy-52} ${cx+72} ${cy+38} ${cx+26} ${cy+20}" ` +
      `fill="${palette[2]}" opacity=".35"/>`
    );
  }
  if (accessory === "Tail Blade") {
    return (
      `<path d="M ${tx} ${ty-28} L ${tx-22} ${ty+20} L ${tx+22} ${ty+20} Z" ` +
      `fill="${palette[2]}" stroke="${palette[1]}" stroke-width="3" shape-rendering="crispEdges"/>`
    );
  }
  if (accessory.includes("Aura") || accessory === "Floating Particles" || accessory === "Floating Orbs") {
    return blocks
      .filter((_, i) => i % 7 === 0)
      .map((b, i) => {
        const px = b.x + (i % 2 ? -20 : 20);
        const py = b.y + (i % 3 ? 14 : -14);
        const s  = 6 + (i % 3) * 2;
        return (
          `<rect x="${px - s/2}" y="${py - s/2}" width="${s}" height="${s}" ` +
          `fill="${palette[2]}" opacity=".6" shape-rendering="crispEdges"/>`
        );
      })
      .join("\n  ");
  }

  return "";
}

function auraLayer(aura, blocks, pixelSize, palette) {
  if (aura === "None") return "";
  const size = pixelSize * 2;
  return blocks
    .map((b) => (
      `<rect x="${b.x - size/2}" y="${b.y - size/2}" ` +
      `width="${size}" height="${size}" ` +
      `fill="${palette[2]}" shape-rendering="crispEdges"/>`
    ))
    .join("\n    ");
}

// ─── SVG RENDERER ────────────────────────────────────────────────────────────

function renderSnakeSvg({ traits, blocks }) {
  const size      = 900;
  const pixelSize = traits.bodyType.includes("Slim")  ? 24
                  : traits.bodyType.includes("Thick") ? 36
                  : 28;

  const palette     = getPalette(traits.material, traits.aura);
  const auraOpacity = traits.aura === "None" ? 0 : 0.22;

  const bodyHtml = buildBody(blocks, pixelSize, palette, traits.bodyType);
  const headHtml = buildHead(blocks, pixelSize, palette);
  const decoHtml = decorativeLayer(traits.accessory, blocks, palette);
  const auraHtml = auraLayer(traits.aura, blocks, pixelSize, palette);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Snakiox ${traits.material} ${traits.bodyType}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="${palette[1]}"/>
      <stop offset="58%" stop-color="#101522"/>
      <stop offset="100%" stop-color="#06070b"/>
    </radialGradient>
    <filter id="glow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="9" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="900" height="900" fill="url(#bg)"/>

  <!-- Checkerboard tile pattern -->
  <g opacity=".08" shape-rendering="crispEdges">
    ${Array.from({ length: 32 }, (_, row) =>
      Array.from({ length: 32 }, (_, col) => {
        const fill = (row + col) % 2 === 0 ? "#ffffff" : palette[2];
        const op   = (row + col) % 5 === 0 ? ".18" : ".07";
        return `<rect x="${col * 28}" y="${row * 28}" width="28" height="28" fill="${fill}" opacity="${op}"/>`;
      }).join("")
    ).join("")}
  </g>

  <!-- Grid lines -->
  <g opacity=".12" shape-rendering="crispEdges">
    ${Array.from({ length: 33 }, (_, i) => {
      const pos = i * 28;
      return `<path d="M ${pos} 0 V 900 M 0 ${pos} H 900" stroke="#ffffff" stroke-width="0.5"/>`;
    }).join("")}
  </g>

  <!-- Aura glow -->
  <g filter="url(#glow)" opacity="${auraOpacity}">
    ${auraHtml}
  </g>

  <!-- Accessories / decorations -->
  <g>${decoHtml}</g>

  <!-- Body segments -->
  <g>
  ${bodyHtml}
  </g>

  <!-- Head (drawn last, on top) -->
  <g>
  ${headHtml}
  </g>

</svg>`;
}

// ─── TOKEN ───────────────────────────────────────────────────────────────────

function createToken(seedInput, options = {}) {
  const random    = mulberry32(hashSeed(seedInput));
  const rarity    = weightedPick(RARITY_WEIGHTS, random);
  const materials = flattenSeries(TRAITS.materials);
  const bodyTypes = flattenSeries(TRAITS.bodyTypes);
  const material  = rarityBoostedPick(materials, SERIES_WEIGHTS, random, rarity);
  const bodyType  = rarityBoostedPick(bodyTypes, BODY_WEIGHTS, random, rarity);
  const aura           = pick(TRAITS.auras, random);
  const eyes           = pick(TRAITS.eyes, random);
  const accessory      = pick(TRAITS.accessories, random);
  const animationStyle = pick(TRAITS.animationStyles, random);

  const traits = {
    rarity:       rarity.name,
    materialSeries: material.series,
    material:     material.value,
    bodySeries:   bodyType.series,
    bodyType:     bodyType.value,
    aura,
    eyes,
    accessory,
    animationStyle
  };
  const pixelSize = traits.bodyType.includes("Slim") ? 24
                  : traits.bodyType.includes("Thick") ? 36
                  : 28;
  const blocks = options.blocks ?? makePixelSnake(random, { length: options.length, pixelSize });
  const stats  = snakeStats(blocks);

  const svg = renderSnakeSvg({ traits, blocks });

  const attributes = [
    { trait_type: "Rarity",           value: traits.rarity },
    { trait_type: "Material Series",  value: traits.materialSeries },
    { trait_type: "Material",         value: traits.material },
    { trait_type: "Body Series",      value: traits.bodySeries },
    { trait_type: "Body Type",        value: traits.bodyType },
    { trait_type: "Aura",             value: traits.aura },
    { trait_type: "Eyes",             value: traits.eyes },
    { trait_type: "Accessory",        value: traits.accessory },
    { trait_type: "Animation Style",  value: traits.animationStyle },
    { trait_type: "Snake Length",     value: stats.length, display_type: "number" }
  ];

  return {
    name: `Snakiox #${String(options.tokenId ?? seedInput).padStart(5, "0")}`,
    description: "A pixel-block snake NFT generated from rarity-weighted visual layers and a simple snake length.",
    seed: seedInput,
    traits,
    snake: { blocks, ...stats },
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    attributes,
    svg
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { count: 1, out: "output", seed: "snakiox" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--count")  args.count  = Number(argv[++i]);
    if (arg === "--out")    args.out    = argv[++i];
    if (arg === "--seed")   args.seed   = argv[++i];
    if (arg === "--length") args.length = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args       = parseArgs(process.argv.slice(2));
  const outputDir  = path.resolve(__dirname, args.out);
  const svgDir     = path.join(outputDir, "svg");
  const metaDir    = path.join(outputDir, "metadata");

  await mkdir(svgDir,  { recursive: true });
  await mkdir(metaDir, { recursive: true });

  for (let tokenId = 1; tokenId <= args.count; tokenId++) {
    const token = createToken(`${args.seed}-${tokenId}`, { tokenId, length: args.length });
    const id    = String(tokenId).padStart(5, "0");
    await writeFile(path.join(svgDir,  `${id}.svg`),  token.svg);
    const { svg, ...metadata } = token;
    await writeFile(path.join(metaDir, `${id}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
  }

  console.log(`Generated ${args.count} Snakiox token${args.count === 1 ? "" : "s"} in ${outputDir}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

export { TRAITS, createToken, makePixelSnake, renderSnakeSvg };
