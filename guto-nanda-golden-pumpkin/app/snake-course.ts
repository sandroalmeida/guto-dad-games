export const SNAKE_COLS = 20;
export const SNAKE_LANES = 6;
export const SNAKE_CELL_W = 49;
export const SNAKE_CELL_H = 84;
export const SNAKE_GRID_X = 110;
export const SNAKE_GRID_Y = 58;
export const SNAKE_BANK_LEFT_X = 58;
export const SNAKE_BANK_RIGHT_X = 1146;
export const SNAKE_BITE_DELAY = 0.65;
export const SNAKE_HOP_TIME = 0.22;
export const SNAKE_WALK_TIME = 0.15;
export const SNAKE_MIN_FRACTION = 0.42;
export const SNAKE_MAX_FRACTION = 0.6;

export type SnakeCell = { col: number; lane: number };
export type SnakeKind = "root" | "snake";
export type SnakeBand = {
  id: number;
  kind: SnakeKind;
  cells: SnakeCell[];
  headAtEnd: boolean;
  tint: number;
  wobble: number;
};
export type SnakeMove = "forward" | "back" | "up" | "down";
export type SnakeMotion = {
  fromCol: number;
  fromLane: number;
  toCol: number;
  toLane: number;
  t: number;
  duration: number;
  hop: boolean;
};
export type SnakeLossReason = "bite" | "instant";

export type SnakeCourseState = {
  seed: number;
  layoutSeed: number;
  bands: SnakeBand[];
  grid: number[];
  col: number;
  lane: number;
  motion: SnakeMotion | null;
  awake: boolean;
  biteTimer: number;
  pendingMove: SnakeMove | null;
  facing: SnakeMove;
  reveals: number;
  hops: number;
  furthest: number;
  elapsed: number;
  won: boolean;
  lost: boolean;
  lossReason: SnakeLossReason | null;
  biterBand: number | null;
  shortestMoves: number;
};

export type SnakeEvent =
  | { type: "hop"; toCol: number; toLane: number }
  | { type: "walk"; toCol: number; toLane: number }
  | { type: "blocked"; move: SnakeMove }
  | { type: "wake"; band: number }
  | { type: "sleep" }
  | { type: "bank" }
  | { type: "won" }
  | { type: "lost"; reason: SnakeLossReason; band: number };

function mulberry(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cellIndex(col: number, lane: number) {
  return col * SNAKE_LANES + lane;
}

export function bandAt(state: { grid: number[]; bands: SnakeBand[] }, col: number, lane: number) {
  if (col < 0 || col >= SNAKE_COLS || lane < 0 || lane >= SNAKE_LANES) return null;
  const id = state.grid[cellIndex(col, lane)];
  return id >= 0 ? state.bands[id] : null;
}

export function cellCenter(col: number, lane: number) {
  const x =
    col < 0
      ? SNAKE_BANK_LEFT_X
      : col >= SNAKE_COLS
        ? SNAKE_BANK_RIGHT_X
        : SNAKE_GRID_X + col * SNAKE_CELL_W + SNAKE_CELL_W / 2;
  const y = SNAKE_GRID_Y + lane * SNAKE_CELL_H + SNAKE_CELL_H / 2;
  return { x, y };
}

function generateBands(random: () => number) {
  const grid = new Array<number>(SNAKE_COLS * SNAKE_LANES).fill(-1);
  const bands: SnakeBand[] = [];
  const unassigned = () => {
    for (let col = 0; col < SNAKE_COLS; col += 1) {
      const lanes = Array.from({ length: SNAKE_LANES }, (_, lane) => lane);
      for (let i = lanes.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
      }
      for (const lane of lanes) {
        if (grid[cellIndex(col, lane)] === -1) return { col, lane };
      }
    }
    return null;
  };

  for (;;) {
    const start = unassigned();
    if (!start) break;
    const id = bands.length;
    const target = 2 + Math.floor(random() * 5);
    const cells: SnakeCell[] = [start];
    grid[cellIndex(start.col, start.lane)] = id;
    let current = start;
    let verticalBias = random() < 0.5 ? -1 : 1;
    while (cells.length < target) {
      const options: { cell: SnakeCell; weight: number }[] = [];
      const candidates = [
        { col: current.col, lane: current.lane + verticalBias, weight: 4 },
        { col: current.col, lane: current.lane - verticalBias, weight: 1.2 },
        { col: current.col + 1, lane: current.lane, weight: 1.4 },
        { col: current.col - 1, lane: current.lane, weight: 0.8 },
      ];
      for (const candidate of candidates) {
        if (candidate.col < 0 || candidate.col >= SNAKE_COLS) continue;
        if (candidate.lane < 0 || candidate.lane >= SNAKE_LANES) continue;
        if (grid[cellIndex(candidate.col, candidate.lane)] !== -1) continue;
        options.push({ cell: { col: candidate.col, lane: candidate.lane }, weight: candidate.weight });
      }
      if (options.length === 0) break;
      const total = options.reduce((sum, option) => sum + option.weight, 0);
      let pick = random() * total;
      let chosen = options[0].cell;
      for (const option of options) {
        pick -= option.weight;
        if (pick <= 0) {
          chosen = option.cell;
          break;
        }
      }
      if (chosen.col !== current.col) verticalBias = random() < 0.5 ? -1 : 1;
      cells.push(chosen);
      grid[cellIndex(chosen.col, chosen.lane)] = id;
      current = chosen;
    }
    bands.push({
      id,
      kind: "root",
      cells,
      headAtEnd: random() < 0.5,
      tint: random(),
      wobble: random() * Math.PI * 2,
    });
  }
  return { grid, bands };
}

type SearchState = { col: number; lane: number; onSnake: boolean };

function stateKey(state: SearchState) {
  return `${state.col}:${state.lane}:${state.onSnake ? 1 : 0}`;
}

export function legalTargets(
  layout: { grid: number[]; bands: SnakeBand[] },
  from: SearchState,
) {
  const targets: { move: SnakeMove; state: SearchState | "goal" | "bite" | "blocked" }[] = [];
  const currentBand = from.col >= 0 && from.col < SNAKE_COLS ? bandAt(layout, from.col, from.lane) : null;
  const land = (col: number, lane: number): SearchState | "goal" | "bite" => {
    if (col >= SNAKE_COLS) return "goal";
    if (col < 0) return { col: -1, lane, onSnake: false };
    const band = bandAt(layout, col, lane)!;
    if (band.kind === "root") return { col, lane, onSnake: false };
    if (from.onSnake) return "bite";
    return { col, lane, onSnake: true };
  };
  targets.push({ move: "forward", state: land(from.col + 1, from.lane) });
  if (from.col > -1) targets.push({ move: "back", state: land(from.col - 1, from.lane) });
  for (const move of ["up", "down"] as const) {
    const lane = from.lane + (move === "up" ? -1 : 1);
    if (lane < 0 || lane >= SNAKE_LANES) {
      targets.push({ move, state: "blocked" });
      continue;
    }
    if (from.col < 0 || from.col >= SNAKE_COLS) {
      targets.push({ move, state: { col: from.col, lane, onSnake: false } });
      continue;
    }
    const band = bandAt(layout, from.col, lane);
    if (!from.onSnake && currentBand && band && band.id === currentBand.id) {
      targets.push({ move, state: { col: from.col, lane, onSnake: false } });
    } else {
      targets.push({ move, state: "blocked" });
    }
  }
  return targets;
}

export function solve(
  layout: { grid: number[]; bands: SnakeBand[] },
  options: { allowBackOntoSnake?: boolean } = {},
) {
  const allowBackOntoSnake = options.allowBackOntoSnake ?? false;
  const queue: { state: SearchState; moves: number; lateral: number }[] = [];
  const seen = new Set<string>();
  for (let lane = 0; lane < SNAKE_LANES; lane += 1) {
    const start = { col: -1, lane, onSnake: false };
    queue.push({ state: start, moves: 0, lateral: 0 });
    seen.add(stateKey(start));
  }
  while (queue.length > 0) {
    const { state, moves, lateral } = queue.shift()!;
    for (const target of legalTargets(layout, state)) {
      if (target.state === "goal") return { solvable: true, moves: moves + 1, lateral };
      if (target.state === "bite" || target.state === "blocked") continue;
      if (!allowBackOntoSnake && target.move === "back" && target.state.onSnake) continue;
      const key = stateKey(target.state);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({
        state: target.state,
        moves: moves + 1,
        lateral: lateral + (target.move === "up" || target.move === "down" ? 1 : 0),
      });
    }
  }
  return { solvable: false, moves: Infinity, lateral: 0 };
}

export function straightLaneWorks(layout: { grid: number[]; bands: SnakeBand[] }, lane: number) {
  let onSnake = false;
  for (let col = 0; col < SNAKE_COLS; col += 1) {
    const band = bandAt(layout, col, lane)!;
    if (band.kind === "snake") {
      if (onSnake) return false;
      onSnake = true;
    } else {
      onSnake = false;
    }
  }
  return true;
}

export function snakeFraction(layout: { grid: number[]; bands: SnakeBand[] }) {
  let snakes = 0;
  for (const id of layout.grid) if (layout.bands[id].kind === "snake") snakes += 1;
  return snakes / layout.grid.length;
}

export function generateLayout(layoutSeed: number) {
  const random = mulberry(layoutSeed);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const layout = generateBands(random);
    layout.bands.forEach((band) => {
      band.kind = random() < 0.52 ? "snake" : "root";
    });
    const fraction = snakeFraction(layout);
    if (fraction < SNAKE_MIN_FRACTION || fraction > SNAKE_MAX_FRACTION) continue;
    const solution = solve(layout);
    if (!solution.solvable) continue;
    if (solution.lateral < 3) continue;
    if (solution.moves < SNAKE_COLS + 6) continue;
    let straight = false;
    for (let lane = 0; lane < SNAKE_LANES; lane += 1) {
      if (straightLaneWorks(layout, lane)) straight = true;
    }
    if (straight) continue;
    return { ...layout, attempts: attempt + 1, solution };
  }
  throw new Error("could not generate a snake layout");
}

export function makeSnakeCourse(layoutSeed = 5): SnakeCourseState {
  const layout = generateLayout(layoutSeed);
  return {
    seed: layoutSeed,
    layoutSeed,
    bands: layout.bands,
    grid: layout.grid,
    col: -1,
    lane: 2,
    motion: null,
    awake: false,
    biteTimer: 0,
    pendingMove: null,
    facing: "forward",
    reveals: 0,
    hops: 0,
    furthest: -1,
    elapsed: 0,
    won: false,
    lost: false,
    lossReason: null,
    biterBand: null,
    shortestMoves: layout.solution.moves,
  };
}

export function snakeHead(band: SnakeBand) {
  const head = band.headAtEnd ? band.cells[band.cells.length - 1] : band.cells[0];
  const neck =
    band.cells.length > 1
      ? band.headAtEnd
        ? band.cells[band.cells.length - 2]
        : band.cells[1]
      : null;
  return { head, neck };
}

export function playerPosition(state: SnakeCourseState) {
  if (!state.motion) return cellCenter(state.col, state.lane);
  const from = cellCenter(state.motion.fromCol, state.motion.fromLane);
  const to = cellCenter(state.motion.toCol, state.motion.toLane);
  const t = Math.min(1, state.motion.t);
  const ease = t * t * (3 - 2 * t);
  return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease };
}

function arrive(state: SnakeCourseState, events: SnakeEvent[]) {
  const motion = state.motion!;
  state.motion = null;
  state.col = motion.toCol;
  state.lane = motion.toLane;
  state.furthest = Math.max(state.furthest, state.col);
  if (state.col >= SNAKE_COLS) {
    state.awake = false;
    state.won = true;
    events.push({ type: "bank" });
    events.push({ type: "won" });
    return;
  }
  if (state.col < 0) {
    if (state.awake) events.push({ type: "sleep" });
    state.awake = false;
    events.push({ type: "bank" });
    return;
  }
  const band = bandAt(state, state.col, state.lane)!;
  if (band.kind === "root") {
    if (state.awake) events.push({ type: "sleep" });
    state.awake = false;
    return;
  }
  if (state.awake) {
    state.lost = true;
    state.lossReason = "instant";
    state.biterBand = band.id;
    events.push({ type: "lost", reason: "instant", band: band.id });
    return;
  }
  state.awake = true;
  state.biteTimer = SNAKE_BITE_DELAY;
  state.reveals += 1;
  events.push({ type: "wake", band: band.id });
}

export function stepSnakeCourse(state: SnakeCourseState, dt: number): SnakeEvent[] {
  const events: SnakeEvent[] = [];
  state.elapsed += dt;
  if (state.won || state.lost) {
    state.pendingMove = null;
    return events;
  }

  if (state.motion) {
    state.motion.t += dt / state.motion.duration;
    if (state.motion.t >= 1) arrive(state, events);
    if (state.won || state.lost) return events;
  }

  if (!state.motion && state.awake) {
    state.biteTimer -= dt;
    if (state.biteTimer <= 0) {
      const band = bandAt(state, state.col, state.lane)!;
      state.lost = true;
      state.lossReason = "bite";
      state.biterBand = band.id;
      events.push({ type: "lost", reason: "bite", band: band.id });
      return events;
    }
  }

  const move = state.pendingMove;
  if (move && !state.motion) {
    state.pendingMove = null;
    const targets = legalTargets(state, { col: state.col, lane: state.lane, onSnake: state.awake });
    const target = targets.find((candidate) => candidate.move === move);
    if (!target || target.state === "blocked") {
      events.push({ type: "blocked", move });
      return events;
    }
    const toCol = move === "forward" ? state.col + 1 : move === "back" ? state.col - 1 : state.col;
    const toLane = move === "up" ? state.lane - 1 : move === "down" ? state.lane + 1 : state.lane;
    const currentBand = state.col >= 0 && state.col < SNAKE_COLS ? bandAt(state, state.col, state.lane) : null;
    const nextBand = toCol >= 0 && toCol < SNAKE_COLS ? bandAt(state, toCol, toLane) : null;
    const walking =
      !state.awake &&
      ((currentBand !== null && nextBand !== null && currentBand.id === nextBand.id && currentBand.kind === "root") ||
        (state.col < 0 && toCol < 0) ||
        (state.col >= SNAKE_COLS && toCol >= SNAKE_COLS));
    state.facing = move;
    state.motion = {
      fromCol: state.col,
      fromLane: state.lane,
      toCol,
      toLane,
      t: 0,
      duration: walking ? SNAKE_WALK_TIME : SNAKE_HOP_TIME,
      hop: !walking,
    };
    if (walking) events.push({ type: "walk", toCol, toLane });
    else {
      state.hops += 1;
      events.push({ type: "hop", toCol, toLane });
    }
  }
  return events;
}
