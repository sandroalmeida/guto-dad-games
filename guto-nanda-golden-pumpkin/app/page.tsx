"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EAGLE_GROUND_Y,
  EAGLE_HOLD_LIMIT,
  EAGLE_MAX_HEALTH,
  EAGLE_SAFE_LEFT,
  EAGLE_SAFE_RIGHT,
  makeEagleCourse,
  stepEagleCourse,
  threateningEagle,
  type Eagle,
  type EagleCourseState,
  type EagleEvent,
  type EagleLossReason,
} from "./eagle-course";
import {
  HIPPO_BACK_LIMIT,
  HIPPO_BANK_LEFT,
  HIPPO_BANK_RIGHT,
  HIPPO_BANK_Y,
  HIPPO_LENGTH,
  HIPPO_MAX_CHARGE,
  HIPPO_OVERCHARGE_START,
  HIPPO_PLAYER_START_X,
  HIPPO_SPLASH_Y,
  HIPPO_WATER_Y,
  makeHippoCourse,
  stepHippoCourse,
  zoneLimit,
  zoneSpan,
  type Hippo,
  type HippoCourseState,
  type HippoEvent,
  type HippoLossReason,
  type HippoZone,
} from "./hippo-course";
import {
  SNAKE_BITE_DELAY,
  SNAKE_CELL_H,
  SNAKE_CELL_W,
  SNAKE_COLS,
  SNAKE_GRID_X,
  SNAKE_GRID_Y,
  SNAKE_LANES,
  bandAt,
  cellCenter,
  makeSnakeCourse,
  playerPosition,
  snakeHead,
  stepSnakeCourse,
  type SnakeBand,
  type SnakeCourseState,
  type SnakeEvent,
  type SnakeLossReason,
  type SnakeMove,
} from "./snake-course";
import {
  PIG_BITE_CHUNK,
  PIG_CLIMB_LENGTH,
  PIG_CLIMB_TIME,
  PIG_FINISH_X,
  PIG_FLOOR_Y,
  PIG_LEDGE_Y,
  PIG_LOW_STILT,
  PIG_PLAYER_START_X,
  PIG_SAFE_LEFT,
  PIG_SAFE_RIGHT,
  PIG_STILT_FULL,
  PIG_STILT_SNAP,
  boulderTop,
  canClimbOut,
  chunksBitten,
  makePigCourse,
  stepPigCourse,
  type Boulder,
  type Pig,
  type PigCourseState,
  type PigEvent,
  type PigLossReason,
} from "./pig-course";
import {
  RIVER_CURRENT,
  RIVER_LEFT_BANK,
  RIVER_RIGHT_BANK,
  RIVER_SPIN_MAX,
  RIVER_START_X,
  RIVER_START_Y,
  RIVER_TOP,
  RIVER_WATERFALL_Y,
  logAxisAngle,
  makeRiverCourse,
  ridingLog,
  riverHeadroom,
  riverProgress,
  stepRiverCourse,
  type Piranha,
  type RiverCourseState,
  type RiverEvent,
  type RiverLog,
  type RiverLossReason,
} from "./river-course";
import {
  LION_BRANCH_Y,
  LION_FINISH_X,
  LION_GROUND_Y,
  LION_PATIENCE,
  LION_PATIENCE_JITTER,
  LION_PLAYER_START_X,
  LION_SAFE_LEFT,
  LION_SAFE_RIGHT,
  LION_SIGHT,
  inSafeZone,
  isSheltered,
  lionFacesPlayer,
  lionProgress,
  lionSeesPlayer,
  makeLionCourse,
  patienceLeft,
  stepLionCourse,
  type Lion,
  type LionCourseState,
  type LionEvent,
  type LionLossReason,
  type LionTree,
} from "./lion-course";

type Character = "guto" | "nanda";
type Overlay = "briefing" | "gameover" | "won" | null;
type CourseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Vine = {
  x: number;
  y: number;
  length: number;
  phase: number;
  amplitude: number;
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  attachedVine: number | null;
  vineRatio: number;
  climbMotion: number;
  canGrab: boolean;
  grabCooldown: number;
  onGround: boolean;
  onPlatform: number | null;
  pushRecovery: number;
};

type Monkey = {
  platformIndex: number;
  targetPlatformIndex: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  jumpCooldown: number;
  dizzyTimer: number;
  pushCooldown: number;
  phase: number;
};

type MonkeyPlatform = {
  x: number;
  y: number;
  width: number;
  tree: number;
  level: number;
};

type GameState = {
  course: CourseNumber;
  player: Player;
  monkeys: Monkey[];
  spikeTimer: number;
  spikeActive: boolean;
  eagle: EagleCourseState;
  hippo: HippoCourseState;
  snake: SnakeCourseState;
  pig: PigCourseState;
  river: RiverCourseState;
  lion: LionCourseState;
  notice: string;
  noticeTimer: number;
  running: boolean;
  elapsed: number;
  lastTime: number;
  won: boolean;
  lost: boolean;
};

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 620;
const GROUND_Y = 474;
const WATER_LEFT = 255;
const WATER_RIGHT = 1005;
const MONKEY_GROUND_Y = 548;
const MONKEY_SPIKE_LEFT = 148;
const MONKEY_SPIKE_RIGHT = 1052;
const MONKEY_SPIKE_LIMIT = 1;
const monkeyBarriers = [
  { x: 180, width: 28, top: 420, label: "CLIMB" },
  { x: 1012, width: 28, top: 420, label: "BRANCHES" },
] as const;

const vines: Vine[] = [
  { x: 335, y: 58, length: 320, phase: 0.2, amplitude: 0.68 },
  { x: 620, y: 72, length: 298, phase: 2.28, amplitude: 0.72 },
  { x: 900, y: 54, length: 324, phase: 4.42, amplitude: 0.67 },
];

const treeDefinitions = [
  { x: 250, lean: -0.025, crown: 94 },
  { x: 488, lean: 0.018, crown: 118 },
  { x: 725, lean: -0.014, crown: 82 },
  { x: 950, lean: 0.022, crown: 105 },
] as const;

const monkeyPlatforms: MonkeyPlatform[] = [
  { x: 158, y: 446, width: 178, tree: 0, level: 0 },
  { x: 198, y: 344, width: 176, tree: 0, level: 1 },
  { x: 156, y: 238, width: 168, tree: 0, level: 2 },
  { x: 390, y: 474, width: 184, tree: 1, level: 0 },
  { x: 438, y: 366, width: 184, tree: 1, level: 1 },
  { x: 394, y: 258, width: 180, tree: 1, level: 2 },
  { x: 618, y: 438, width: 190, tree: 2, level: 0 },
  { x: 672, y: 330, width: 184, tree: 2, level: 1 },
  { x: 624, y: 220, width: 184, tree: 2, level: 2 },
  { x: 842, y: 474, width: 192, tree: 3, level: 0 },
  { x: 806, y: 362, width: 190, tree: 3, level: 1 },
  { x: 870, y: 252, width: 184, tree: 3, level: 2 },
];

const monkeyStarts = [
  { platformIndex: 1, ratio: 0.62, phase: 0.2 },
  { platformIndex: 2, ratio: 0.34, phase: 1.7 },
  { platformIndex: 4, ratio: 0.55, phase: 2.8 },
  { platformIndex: 6, ratio: 0.6, phase: 4.2 },
  { platformIndex: 8, ratio: 0.38, phase: 5.1 },
  { platformIndex: 10, ratio: 0.55, phase: 6.4 },
  { platformIndex: 11, ratio: 0.7, phase: 7.6 },
] as const;

const courses = [
  {
    number: "01",
    animal: "Crocodile",
    title: "The Crocodile Canal",
    skill: "Swing, time & leap",
    icon: "🐊",
    status: "PLAYABLE",
    description: "Jump, catch, climb, and swing above the snapping water.",
  },
  {
    number: "02",
    animal: "Capuchin Monkeys",
    title: "The Pushing Monkeys",
    skill: "Climb, dodge & stomp",
    icon: "🐒",
    status: "PLAYABLE",
    description: "Clear two barriers through the branches before cumulative spike damage reaches one second.",
  },
  {
    number: "03",
    animal: "Hawk-Eagles",
    title: "The Diving Eagles",
    skill: "Shield & shake",
    icon: "🦅",
    status: "PLAYABLE",
    description: "Raise a rodent overhead to feed each diving eagle, and mash free if the talons close on you.",
  },
  {
    number: "04",
    animal: "Hippos",
    title: "The Hippo Crossing",
    skill: "Hop & time",
    icon: "🦛",
    status: "PLAYABLE",
    description: "Hop mouth-to-head-to-back across four restless hippos, or charge a long jump straight to the next back.",
  },
  {
    number: "05",
    animal: "Vipers",
    title: "The Sleeping Snakes",
    skill: "Memorize & hop",
    icon: "🐍",
    status: "PLAYABLE",
    description: "Seen from above, roots and sleeping snakes look alike. Wake them on purpose, hop back, and remember the way.",
  },
  {
    number: "06",
    animal: "Wild Pigs",
    title: "The Wild Pig Valley",
    skill: "Stilt-walk & vault",
    icon: "🐗",
    status: "PLAYABLE",
    description: "Drop into the valley on pea-leg stilts taller than its walls. Every pig bite chews them shorter — cross and climb out before they're too short.",
  },
  {
    number: "07",
    animal: "Piranhas",
    title: "The Piranha River",
    skill: "Spin & hop",
    icon: "🐟",
    status: "PLAYABLE",
    description: "Roll floating logs across a river that flows toward a waterfall. Spin the right log the right way, hop between them, and never fall in with the piranhas.",
  },
  {
    number: "08",
    animal: "Lion",
    title: "The Lion's Watch",
    skill: "Watch, climb & wait",
    icon: "🦁",
    status: "FINALE",
    description: "Cross the open savanna under the eyes of a lion. Jump for a branch and climb it to be safe; move only when the lion is looking away — the Golden Pumpkin waits at the far end.",
  },
];

function byCourse<T>(course: CourseNumber, one: T, two: T, three: T, four: T, five: T, six: T, seven: T, eight: T): T {
  return course === 1
    ? one
    : course === 2
      ? two
      : course === 3
        ? three
        : course === 4
          ? four
          : course === 5
            ? five
            : course === 6
              ? six
              : course === 7
                ? seven
                : eight;
}

function makeGame(course: CourseNumber = 1, snakeSeed = 5): GameState {
  const monkeys = monkeyStarts.map((start) => {
    const platform = monkeyPlatforms[start.platformIndex];
    return {
      platformIndex: start.platformIndex,
      targetPlatformIndex: null,
      x: platform.x + platform.width * start.ratio,
      y: platform.y,
      vx: start.phase % 2 > 1 ? -66 : 66,
      vy: 0,
      jumpCooldown: 0.45 + (start.phase % 0.4),
      dizzyTimer: 0,
      pushCooldown: 0,
      phase: start.phase,
    };
  });
  return {
    course,
    player: {
      x: course === 3 ? 105 : course === 4 ? HIPPO_PLAYER_START_X : course === 6 ? PIG_PLAYER_START_X : course === 7 ? RIVER_START_X : course === 8 ? LION_PLAYER_START_X : 125,
      y: byCourse(course, GROUND_Y, MONKEY_GROUND_Y, EAGLE_GROUND_Y, HIPPO_BANK_Y, SNAKE_GRID_Y + SNAKE_CELL_H * 2.5, PIG_LEDGE_Y, RIVER_START_Y, LION_GROUND_Y - 40),
      vx: 0,
      vy: 0,
      facing: 1,
      attachedVine: null,
      vineRatio: 0.9,
      climbMotion: 0,
      canGrab: false,
      grabCooldown: 0,
      onGround: true,
      onPlatform: null,
      pushRecovery: 0,
    },
    monkeys,
    spikeTimer: 0,
    spikeActive: false,
    eagle: makeEagleCourse(Math.floor(Math.random() * 1e9)),
    hippo: makeHippoCourse(Math.floor(Math.random() * 1e9)),
    snake: course === 5 ? makeSnakeCourse(snakeSeed) : makeSnakeCourse(1),
    pig: makePigCourse(Math.floor(Math.random() * 1e9)),
    river: makeRiverCourse(Math.floor(Math.random() * 1e9)),
    lion: makeLionCourse(Math.floor(Math.random() * 1e9)),
    notice: "",
    noticeTimer: 0,
    running: false,
    elapsed: 0,
    lastTime: 0,
    won: false,
    lost: false,
  };
}

function vinePoint(vine: Vine, elapsed: number) {
  const naturalFrequency = Math.sqrt(980 / vine.length) * 0.96;
  const primaryPhase = elapsed * naturalFrequency + vine.phase;
  const breezePhase = elapsed * 0.43 + vine.phase * 1.7;
  const angle =
    Math.sin(primaryPhase) * vine.amplitude +
    Math.sin(breezePhase) * 0.026;
  const angularVelocity =
    Math.cos(primaryPhase) * vine.amplitude * naturalFrequency +
    Math.cos(breezePhase) * 0.011;
  return {
    x: vine.x + Math.sin(angle) * vine.length,
    y: vine.y + Math.cos(angle) * vine.length,
    vx: Math.cos(angle) * vine.length * angularVelocity,
    vy: -Math.sin(angle) * vine.length * angularVelocity,
    angle,
    angularVelocity,
  };
}

function gripPoint(vine: Vine, elapsed: number, ratio: number) {
  const end = vinePoint(vine, elapsed);
  const dx = end.x - vine.x;
  const dy = end.y - vine.y;
  const ropeLength = Math.hypot(dx, dy);
  const bend =
    -end.angularVelocity *
    7.5 *
    Math.sin(Math.PI * ratio) *
    (0.35 + ratio * 0.65);
  const normalX = -dy / ropeLength;
  const normalY = dx / ropeLength;
  return {
    x: vine.x + dx * ratio + normalX * bend,
    y: vine.y + dy * ratio + normalY * bend,
    vx: end.vx * ratio,
    vy: end.vy * ratio,
  };
}

function nearestGrip(
  vine: Vine,
  elapsed: number,
  targetX: number,
  targetY: number,
) {
  const end = vinePoint(vine, elapsed);
  const dx = end.x - vine.x;
  const dy = end.y - vine.y;
  const rawRatio =
    ((targetX - vine.x) * dx + (targetY - vine.y) * dy) /
    (dx * dx + dy * dy);
  const ratio = Math.max(0.12, Math.min(0.98, rawRatio));
  const point = gripPoint(vine, elapsed, ratio);
  return {
    ratio,
    distance: Math.hypot(point.x - targetX, point.y - targetY),
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * 0.3, -size * 0.55, size, -size * 0.35, size, 0);
  ctx.bezierCurveTo(size * 0.72, size * 0.45, size * 0.18, size * 0.45, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,220,.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(size * 0.78, 0);
  ctx.stroke();
  ctx.restore();
}

type CharacterMotion =
  | "idle"
  | "run"
  | "jump"
  | "fall"
  | "hang"
  | "climb"
  | "wave"
  | "carry"
  | "lift";

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  feetY: number,
  character: Character,
  facing: number,
  elapsed: number,
  motion: CharacterMotion,
  speed = 0,
  scale = 1,
  climbMotion = 0,
) {
  const isGuto = character === "guto";
  const holding = motion === "carry" || motion === "lift";
  const running = motion === "run" || (holding && Math.abs(speed) > 24);
  const hanging = motion === "hang" || motion === "climb";
  const cycle =
    elapsed *
    (running ? 7.2 + Math.min(Math.abs(speed), 320) * 0.018 : motion === "climb" ? 6 : 2.2);
  const bob = running
    ? Math.abs(Math.sin(cycle)) * 2.4
    : motion === "idle" || motion === "wave" || holding
      ? Math.sin(elapsed * 2.1) * 0.9
      : 0;
  const lean = running
    ? Math.max(-0.18, Math.min(0.18, speed / 1350))
    : motion === "jump"
      ? 0.09
      : motion === "fall"
        ? -0.06
        : 0;

  const skin = "#a95f35";
  const skinLight = "#d48a55";
  const outline = "#18251f";
  const shirt = isGuto ? "#2878c8" : "#dc554d";
  const shirtDark = isGuto ? "#175196" : "#9d3837";
  const shorts = isGuto ? "#dba83b" : "#278d79";
  const shortsDark = isGuto ? "#9f6f22" : "#176353";
  const hair = "#231612";
  const pack = isGuto ? "#8c5a30" : "#785137";

  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(facing * scale, scale);

  if (motion === "idle" || motion === "run" || motion === "wave" || holding) {
    ctx.fillStyle = "rgba(5,27,24,.23)";
    ctx.beginPath();
    ctx.ellipse(0, 2, running ? 23 : 18, running ? 5 : 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(0, -bob);
  ctx.rotate(lean);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (!isGuto) {
    const ponyLift = running
      ? Math.sin(cycle + 1.2) * 4
      : hanging
        ? 5
        : Math.sin(elapsed * 2) * 1.5;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(-8, -72);
    ctx.quadraticCurveTo(-24, -75 - ponyLift, -27, -63 - ponyLift);
    ctx.stroke();
    ctx.strokeStyle = hair;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = "#d17b37";
    ctx.beginPath();
    ctx.arc(-10, -71, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = outline;
  roundedRect(ctx, -18, -54, 23, 33, 9);
  ctx.fill();
  ctx.fillStyle = pack;
  roundedRect(ctx, -16, -52, 19, 29, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,214,139,.34)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, -43);
  ctx.lineTo(-1, -43);
  ctx.stroke();

  const legPose = (side: number) => {
    const phase = cycle + (side > 0 ? Math.PI : 0);
    if (running) {
      const swing = Math.sin(phase) * 0.78;
      return {
        hipX: side * 6,
        kneeX: side * 5 + Math.sin(swing) * 13,
        kneeY: -13 + Math.cos(swing) * 3,
        footX: side * 5 + Math.sin(swing) * 21 - Math.max(0, Math.cos(phase)) * 4,
        footY: -2 - Math.max(0, Math.cos(phase)) * 5,
        bootAngle: swing * 0.45,
      };
    }
    if (motion === "jump") {
      return side < 0
        ? { hipX: -6, kneeX: -15, kneeY: -13, footX: -22, footY: -7, bootAngle: -0.28 }
        : { hipX: 6, kneeX: 10, kneeY: -10, footX: 16, footY: -13, bootAngle: 0.18 };
    }
    if (motion === "fall") {
      return {
        hipX: side * 6,
        kneeX: side * 12,
        kneeY: -11,
        footX: side * 18,
        footY: -5,
        bootAngle: side * 0.18,
      };
    }
    if (hanging) {
      const dangle = Math.sin(elapsed * 3.3 + side) * 4;
      return {
        hipX: side * 5,
        kneeX: side * 8 + dangle,
        kneeY: -12,
        footX: side * 12 + dangle,
        footY: -1,
        bootAngle: side * 0.1,
      };
    }
    return {
      hipX: side * 6,
      kneeX: side * 7,
      kneeY: -12,
      footX: side * 7,
      footY: -1,
      bootAngle: 0,
    };
  };

  const drawLeg = (side: number) => {
    const pose = legPose(side);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(pose.hipX, -22);
    ctx.lineTo(pose.kneeX, pose.kneeY);
    ctx.lineTo(pose.footX, pose.footY - 3);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.save();
    ctx.translate(pose.footX, pose.footY);
    ctx.rotate(pose.bootAngle);
    ctx.fillStyle = "#f0dfbc";
    roundedRect(ctx, -5, -7, 9, 7, 2);
    ctx.fill();
    ctx.fillStyle = outline;
    roundedRect(ctx, -8, -4, 19, 8, 3);
    ctx.fill();
    ctx.fillStyle = "#5a3825";
    roundedRect(ctx, -6, -3, 16, 5, 2);
    ctx.fill();
    ctx.strokeStyle = "#d6a255";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, -2);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.restore();
  };

  drawLeg(-1);
  drawLeg(1);

  ctx.fillStyle = outline;
  roundedRect(ctx, -14, -29, 29, 20, 6);
  ctx.fill();
  ctx.fillStyle = shorts;
  roundedRect(ctx, -12, -27, 25, 17, 5);
  ctx.fill();
  ctx.fillStyle = shortsDark;
  ctx.fillRect(-11, -21, 23, 3);
  ctx.strokeStyle = "rgba(255,242,195,.34)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(0, -12);
  ctx.stroke();

  const shirtGradient = ctx.createLinearGradient(-15, -53, 16, -24);
  shirtGradient.addColorStop(0, shirt);
  shirtGradient.addColorStop(1, shirtDark);
  ctx.fillStyle = outline;
  roundedRect(ctx, -16, -56, 33, 34, 10);
  ctx.fill();
  ctx.fillStyle = shirtGradient;
  roundedRect(ctx, -14, -54, 29, 30, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.17)";
  roundedRect(ctx, -9, -50, 5, 21, 2);
  ctx.fill();
  ctx.fillStyle = "#f0c750";
  ctx.beginPath();
  ctx.arc(7, -43, 2.5, 0, Math.PI * 2);
  ctx.fill();

  const armPose = (side: number) => {
    const phase = cycle + (side > 0 ? Math.PI : 0);
    if (motion === "lift") {
      const strain = Math.sin(elapsed * 5 + side) * 1.2;
      return { elbowX: side * 13, elbowY: -66, handX: side * 7, handY: -88 + strain };
    }
    if (motion === "carry") {
      return side < 0
        ? { elbowX: 3, elbowY: -41, handX: 13, handY: -33 }
        : { elbowX: 17, elbowY: -43, handX: 18, handY: -38 };
    }
    if (hanging) {
      const climbingOffset = motion === "climb" ? Math.sin(cycle + side) * 7 * Math.sign(climbMotion || 1) : 0;
      return {
        elbowX: side * 10,
        elbowY: -62 + climbingOffset * 0.35,
        handX: side * 3,
        handY: -77 + climbingOffset,
      };
    }
    if (running) {
      const swing = Math.sin(phase) * 12;
      return { elbowX: side * 7 - swing * 0.35, elbowY: -39, handX: side * 10 - swing, handY: -27 - Math.abs(swing) * 0.3 };
    }
    if (motion === "jump") {
      return side < 0
        ? { elbowX: -11, elbowY: -55, handX: -6, handY: -68 }
        : { elbowX: 14, elbowY: -54, handX: 20, handY: -63 };
    }
    if (motion === "fall") {
      return { elbowX: side * 18, elbowY: -48, handX: side * 28, handY: -42 };
    }
    if (motion === "wave" && side > 0) {
      return { elbowX: 16, elbowY: -60, handX: 12 + Math.sin(elapsed * 7) * 3, handY: -77 };
    }
    return { elbowX: side * 14, elbowY: -39, handX: side * 14, handY: -25 };
  };

  const drawArm = (side: number) => {
    const pose = armPose(side);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(side * 12, -48);
    ctx.quadraticCurveTo(pose.elbowX, pose.elbowY, pose.handX, pose.handY);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(side * 11, -48);
    ctx.lineTo(side * 13, -43);
    ctx.stroke();
    ctx.fillStyle = skinLight;
    ctx.beginPath();
    ctx.arc(pose.handX, pose.handY, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  drawArm(-1);
  drawArm(1);

  ctx.fillStyle = skin;
  roundedRect(ctx, -5, -62, 11, 13, 4);
  ctx.fill();
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.ellipse(0, -70, 15.5, 16.5, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinLight;
  ctx.beginPath();
  ctx.ellipse(1, -69, 13.5, 14.5, -0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-11, -69, 4.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(94,39,25,.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-11, -69, 2, -1.2, 1.4);
  ctx.stroke();

  ctx.fillStyle = hair;
  ctx.beginPath();
  if (isGuto) {
    ctx.moveTo(-13, -73);
    ctx.quadraticCurveTo(-9, -88, -2, -81);
    ctx.quadraticCurveTo(2, -89, 6, -79);
    ctx.quadraticCurveTo(13, -84, 13, -73);
    ctx.quadraticCurveTo(5, -78, -13, -66);
  } else {
    ctx.arc(-1, -74, 14, Math.PI, Math.PI * 2.04);
    ctx.quadraticCurveTo(10, -76, 12, -68);
    ctx.quadraticCurveTo(3, -74, -13, -66);
  }
  ctx.fill();

  const gazeY =
    hanging || motion === "jump" || motion === "lift" ? -1.2 : motion === "fall" ? 1.2 : 0;
  ctx.fillStyle = "#fff9e8";
  ctx.beginPath();
  ctx.ellipse(7.5, -70, 4.2, 3.6, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3c2418";
  ctx.beginPath();
  ctx.arc(8.8, -70 + gazeY, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(9.4, -70.7 + gazeY, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hair;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(4, -75);
  ctx.quadraticCurveTo(8, -77, 11, -75);
  ctx.stroke();

  ctx.fillStyle = skinLight;
  ctx.beginPath();
  ctx.moveTo(12, -69);
  ctx.quadraticCurveTo(17, -66, 11, -64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#71362a";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(7, -62.5, 5, 0.18, 1.22);
  ctx.stroke();
  ctx.restore();
}

function drawCrocodile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  elapsed: number,
  phase: number,
  playerX: number,
  playerY: number,
  scale = 1,
) {
  const drift = Math.sin(elapsed * 0.52 + phase) * 8;
  const bob = Math.sin(elapsed * 1.7 + phase) * 2.1;
  const crocX = x + drift;
  const distance = Math.abs(playerX - crocX);
  const alert =
    Math.max(0, 1 - distance / 270) *
    (playerY < y + 10 ? 1 : 0.25);
  const snapCycle = (Math.sin(elapsed * 2.15 + phase) + 1) / 2;
  const openness = Math.min(
    1,
    0.05 + Math.pow(snapCycle, 2.2) * 0.58 + alert * 0.38,
  );
  const jawAngle = openness * 0.48;
  const facing = playerX < crocX ? -1 : 1;
  const targetAngle = Math.atan2(playerY - 62 - y, Math.max(distance, 38));
  const lookAngle = Math.max(-0.42, Math.min(0.05, targetAngle));

  ctx.save();
  ctx.translate(crocX, y + bob);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "rgba(163,236,205,.28)";
  ctx.lineWidth = 2;
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.ellipse(
      -5,
      14,
      54 + ring * 18 + Math.sin(elapsed * 2 + phase) * 3,
      8 + ring * 3,
      0,
      Math.PI * 0.08,
      Math.PI * 0.92,
    );
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(facing, 1);
  ctx.fillStyle = "#173e36";
  ctx.beginPath();
  ctx.moveTo(-16, 7);
  ctx.bezierCurveTo(-53, -11, -88, 2, -104, 18);
  ctx.bezierCurveTo(-70, 12, -48, 26, -13, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2d6e49";
  ctx.beginPath();
  ctx.ellipse(-30, 10, 52, 21, -0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(111,161,83,.38)";
  ctx.beginPath();
  ctx.ellipse(-27, 3, 43, 10, -0.05, Math.PI, Math.PI * 2);
  ctx.fill();

  for (let i = -79; i < -10; i += 16) {
    const height = 8 + ((i + 80) % 3) * 2;
    ctx.fillStyle = i % 2 ? "#2f6f45" : "#3b8050";
    ctx.beginPath();
    ctx.moveTo(i, -1);
    ctx.lineTo(i + 7, -height);
    ctx.lineTo(i + 14, 1);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(18,52,42,.34)";
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      ctx.beginPath();
      ctx.ellipse(-55 + col * 15 + row * 5, 7 + row * 8, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(-1, 1);
  ctx.rotate(lookAngle);

  ctx.fillStyle = "#351f23";
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(58, -4);
  ctx.lineTo(62, 8);
  ctx.lineTo(0, 9);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.rotate(jawAngle * 0.62);
  const lowerGradient = ctx.createLinearGradient(0, 0, 58, 15);
  lowerGradient.addColorStop(0, "#2e7148");
  lowerGradient.addColorStop(1, "#4d9054");
  ctx.fillStyle = "#14362f";
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(16, 1, 61, 3);
  ctx.quadraticCurveTo(66, 8, 57, 13);
  ctx.quadraticCurveTo(19, 17, -8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lowerGradient;
  ctx.beginPath();
  ctx.moveTo(-6, 1);
  ctx.quadraticCurveTo(19, 4, 58, 5);
  ctx.quadraticCurveTo(60, 8, 55, 11);
  ctx.quadraticCurveTo(18, 14, -5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efdcae";
  for (let tooth = 2; tooth < 54; tooth += 10) {
    ctx.beginPath();
    ctx.moveTo(tooth, 4);
    ctx.lineTo(tooth + 4, -1 - openness * 2);
    ctx.lineTo(tooth + 7, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(-jawAngle * 0.38);
  const upperGradient = ctx.createLinearGradient(-8, -17, 60, 5);
  upperGradient.addColorStop(0, "#3c8751");
  upperGradient.addColorStop(0.7, "#62a45b");
  upperGradient.addColorStop(1, "#407e48");
  ctx.fillStyle = "#14362f";
  ctx.beginPath();
  ctx.moveTo(-13, 4);
  ctx.quadraticCurveTo(-7, -19, 14, -19);
  ctx.quadraticCurveTo(36, -13, 64, -6);
  ctx.quadraticCurveTo(68, -1, 59, 4);
  ctx.lineTo(-7, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = upperGradient;
  ctx.beginPath();
  ctx.moveTo(-10, 3);
  ctx.quadraticCurveTo(-4, -16, 14, -16);
  ctx.quadraticCurveTo(36, -11, 61, -5);
  ctx.quadraticCurveTo(64, -2, 58, 1);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efdcae";
  for (let tooth = 1; tooth < 55; tooth += 10) {
    ctx.beginPath();
    ctx.moveTo(tooth, 4);
    ctx.lineTo(tooth + 4, 10 + openness * 2);
    ctx.lineTo(tooth + 7, 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#d7c44c";
  ctx.beginPath();
  ctx.ellipse(7, -14, 6, 5.2, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#151b16";
  ctx.beginPath();
  ctx.ellipse(8.5, -15 - alert * 0.5, 2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff5ba";
  ctx.beginPath();
  ctx.arc(9, -16.5, 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#173c30";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(8, -24 + alert * 3, 16, -18);
  ctx.stroke();

  ctx.fillStyle = "#193f33";
  ctx.beginPath();
  ctx.arc(51, -7, 1.8, 0, Math.PI * 2);
  ctx.arc(57, -5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = "rgba(174,235,206,.55)";
  ctx.lineWidth = 1.2;
  for (let bubble = 0; bubble < 3; bubble += 1) {
    const bubblePhase = elapsed * 0.7 + phase + bubble * 2.1;
    if (Math.sin(bubblePhase) > 0.55) {
      ctx.beginPath();
      ctx.arc(-58 + bubble * 12, -5 - ((bubblePhase * 13) % 20), 2 + bubble * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}

function drawVine(
  ctx: CanvasRenderingContext2D,
  vine: Vine,
  elapsed: number,
  index: number,
  highlighted: boolean,
) {
  const samples = Array.from({ length: 21 }, (_, sample) =>
    gripPoint(vine, elapsed, sample / 20),
  );
  const traceRope = () => {
    ctx.beginPath();
    samples.forEach((point, sample) => {
      if (sample === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
  };

  ctx.save();
  if (highlighted) {
    ctx.shadowColor = "rgba(180,236,109,.72)";
    ctx.shadowBlur = 13;
  }
  ctx.strokeStyle = "rgba(8,38,27,.74)";
  ctx.lineWidth = 13;
  traceRope();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#2f6d3d";
  ctx.lineWidth = 9;
  traceRope();
  ctx.stroke();
  ctx.strokeStyle = "#79a650";
  ctx.lineWidth = 2.5;
  traceRope();
  ctx.stroke();
  ctx.setLineDash([4, 10]);
  ctx.strokeStyle = "rgba(220,231,144,.28)";
  ctx.lineWidth = 1.2;
  traceRope();
  ctx.stroke();
  ctx.setLineDash([]);

  [0.18, 0.38, 0.64].forEach((ratio, leafIndex) => {
    const point = gripPoint(vine, elapsed, ratio);
    const ahead = gripPoint(vine, elapsed, Math.min(1, ratio + 0.025));
    const tangent = Math.atan2(ahead.y - point.y, ahead.x - point.x);
    const side = (leafIndex + index) % 2 ? 1 : -1;
    drawLeaf(
      ctx,
      point.x,
      point.y,
      19 + leafIndex * 3,
      tangent + side * 1.15,
      leafIndex % 2 ? "#4f9151" : "#77a84f",
    );
  });

  ctx.fillStyle = "#193e2b";
  ctx.beginPath();
  ctx.ellipse(vine.x, vine.y - 5, 13, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  drawLeaf(ctx, vine.x - 4, vine.y + 7, 36, 2.65, "#4f8f4d");
  ctx.restore();
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#0a3439");
  sky.addColorStop(0.36, "#17584e");
  sky.addColorStop(0.7, "#4d8060");
  sky.addColorStop(1, "#d69a48");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sun = ctx.createRadialGradient(925, 98, 8, 925, 98, 250);
  sun.addColorStop(0, "rgba(255,229,149,.64)");
  sun.addColorStop(0.26, "rgba(255,210,103,.24)");
  sun.addColorStop(1, "rgba(255,210,103,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(635, 0, 565, 370);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255,222,145,.055)";
  for (let ray = 0; ray < 5; ray += 1) {
    ctx.beginPath();
    ctx.moveTo(900 + ray * 20, 0);
    ctx.lineTo(555 + ray * 95, 475);
    ctx.lineTo(660 + ray * 110, 475);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const drawRidge = (baseY: number, color: string, offset: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-30, WORLD_HEIGHT);
    ctx.lineTo(-30, baseY);
    for (let x = -30; x <= WORLD_WIDTH + 80; x += 90) {
      const crest =
        baseY -
        52 -
        Math.abs(Math.sin((x + offset) * 0.011)) * 88 -
        ((x + offset) % 3) * 8;
      ctx.quadraticCurveTo(x + 35, crest, x + 90, baseY - 12);
    }
    ctx.lineTo(WORLD_WIDTH + 80, WORLD_HEIGHT);
    ctx.closePath();
    ctx.fill();
  };
  drawRidge(372, "rgba(21,82,65,.30)", 33);
  drawRidge(414, "rgba(12,66,52,.46)", 127);

  ctx.fillStyle = "rgba(9,53,43,.48)";
  for (let i = 0; i < 12; i += 1) {
    const x = i * 112 - 35;
    const width = 22 + (i % 3) * 8;
    ctx.fillRect(x, 178 + (i % 4) * 22, width, 285);
    ctx.beginPath();
    ctx.moveTo(x - 7, 236);
    ctx.quadraticCurveTo(x - 48, 185, x - 64, 143);
    ctx.moveTo(x + width, 260);
    ctx.quadraticCurveTo(x + 72, 201, x + 82, 161);
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(9,53,43,.48)";
    ctx.stroke();
  }

  for (let i = 0; i < 48; i += 1) {
    const x = ((i * 157 + 39) % 1320) - 55;
    const y = 72 + ((i * 61) % 248);
    const depth = i % 3;
    drawLeaf(
      ctx,
      x,
      y,
      21 + depth * 7,
      (i % 7) * 0.72 + Math.sin(elapsed * 0.35 + i) * 0.025,
      depth === 0 ? "#164f3c" : depth === 1 ? "#266a45" : "#3f7f4c",
    );
  }

  const mist = ctx.createLinearGradient(0, 285, 0, 470);
  mist.addColorStop(0, "rgba(205,231,190,0)");
  mist.addColorStop(0.5, "rgba(205,231,190,.10)");
  mist.addColorStop(1, "rgba(205,231,190,0)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 270, WORLD_WIDTH, 210);

  ctx.strokeStyle = "#173e31";
  ctx.lineWidth = 23;
  ctx.beginPath();
  ctx.moveTo(-35, 234);
  ctx.bezierCurveTo(185, 132, 370, 238, 552, 133);
  ctx.bezierCurveTo(748, 25, 942, 178, 1230, 64);
  ctx.stroke();
  ctx.strokeStyle = "rgba(113,149,74,.35)";
  ctx.lineWidth = 5;
  ctx.stroke();

  const water = ctx.createLinearGradient(0, 442, 0, 620);
  water.addColorStop(0, "#217d75");
  water.addColorStop(0.28, "#176a68");
  water.addColorStop(1, "#082f42");
  ctx.fillStyle = water;
  ctx.fillRect(WATER_LEFT, 450, WATER_RIGHT - WATER_LEFT, 170);

  for (let band = 0; band < 8; band += 1) {
    const y = 462 + band * 20;
    ctx.strokeStyle =
      band % 2
        ? "rgba(158,224,192,.18)"
        : "rgba(245,205,111,.12)";
    ctx.lineWidth = band < 2 ? 2.4 : 1.3;
    ctx.beginPath();
    for (let x = WATER_LEFT; x <= WATER_RIGHT; x += 10) {
      const wave =
        Math.sin(x * (0.019 + band * 0.0015) + elapsed * (1.4 + band * 0.08)) *
        (3.7 - band * 0.18);
      if (x === WATER_LEFT) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const bankGradient = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_HEIGHT);
  bankGradient.addColorStop(0, "#5e4727");
  bankGradient.addColorStop(0.42, "#3d2b20");
  bankGradient.addColorStop(1, "#241e1a");
  ctx.fillStyle = bankGradient;
  roundedRect(ctx, -20, GROUND_Y, WATER_LEFT + 24, 146, 15);
  ctx.fill();
  roundedRect(ctx, WATER_RIGHT - 10, GROUND_Y, 230, 146, 15);
  ctx.fill();

  ctx.fillStyle = "rgba(213,161,88,.24)";
  for (let rock = 0; rock < 11; rock += 1) {
    const leftSide = rock < 6;
    const x = leftSide ? 18 + rock * 37 : 1026 + (rock - 6) * 39;
    const y = 505 + (rock % 3) * 32;
    ctx.beginPath();
    ctx.ellipse(x, y, 13 + (rock % 3) * 3, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const grass = ctx.createLinearGradient(0, 448, 0, 488);
  grass.addColorStop(0, "#77a348");
  grass.addColorStop(1, "#2d7245");
  ctx.fillStyle = grass;
  roundedRect(ctx, -25, GROUND_Y - 15, WATER_LEFT + 30, 29, 13);
  ctx.fill();
  roundedRect(ctx, WATER_RIGHT - 15, GROUND_Y - 15, 235, 29, 13);
  ctx.fill();

  for (let x = 2; x < WORLD_WIDTH; x += 30) {
    if (x > WATER_LEFT - 10 && x < WATER_RIGHT + 5) continue;
    drawLeaf(
      ctx,
      x,
      469,
      18 + (x % 4),
      -1.35 + Math.sin(elapsed * 0.8 + x) * 0.04,
      x % 3 ? "#679a43" : "#9eaa45",
    );
  }

  ctx.fillStyle = "#38271d";
  roundedRect(ctx, 1121, 351, 17, 117, 4);
  ctx.fill();
  ctx.fillStyle = "#d59a3d";
  roundedRect(ctx, 1064, 334, 130, 62, 7);
  ctx.fill();
  ctx.strokeStyle = "#8c5429";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,229,158,.24)";
  ctx.beginPath();
  ctx.moveTo(1075, 348);
  ctx.lineTo(1183, 348);
  ctx.moveTo(1074, 384);
  ctx.lineTo(1180, 384);
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "800 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TRAIL  →", 1129, 371);

  vines.forEach((vine, index) => {
    drawVine(
      ctx,
      vine,
      elapsed,
      index,
      player.canGrab || player.attachedVine === index,
    );
  });

  drawCrocodile(ctx, 419, 506, elapsed, 0.2, player.x, player.y, 1.03);
  drawCrocodile(ctx, 654, 527, elapsed, 2.1, player.x, player.y, 0.92);
  drawCrocodile(ctx, 875, 503, elapsed, 4.3, player.x, player.y, 1.08);

  ctx.strokeStyle = "rgba(183,235,211,.22)";
  ctx.lineWidth = 2;
  for (let foam = 0; foam < 9; foam += 1) {
    const x = WATER_LEFT + 38 + foam * 83;
    const y = 516 + (foam % 3) * 21;
    ctx.beginPath();
    ctx.moveTo(x - 23, y);
    ctx.quadraticCurveTo(x, y - 5 + Math.sin(elapsed * 2 + foam) * 2, x + 24, y);
    ctx.stroke();
  }

  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  drawCharacter(
    ctx,
    68,
    GROUND_Y,
    companion,
    1,
    elapsed,
    player.x > 215 ? "wave" : "idle",
    0,
    0.88,
  );

  if (player.x > 230) {
    const bubbleY = 357 + Math.sin(elapsed * 2.8) * 2;
    ctx.fillStyle = "rgba(247,232,186,.92)";
    roundedRect(ctx, 19, bubbleY, 154, 34, 13);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(63, bubbleY + 31);
    ctx.lineTo(72, bubbleY + 43);
    ctx.lineTo(79, bubbleY + 31);
    ctx.fill();
    ctx.fillStyle = "#244638";
    ctx.font = "800 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("YOU’VE GOT THIS!", 96, bubbleY + 21);
  }

  if (player.onGround && Math.abs(player.vx) > 120) {
    ctx.fillStyle = "rgba(224,190,121,.28)";
    for (let dust = 0; dust < 4; dust += 1) {
      const direction = player.vx > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.arc(
        player.x + direction * (14 + dust * 8),
        player.y - 2 - dust * 2,
        3 + dust,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  const playerMotion: CharacterMotion =
    player.attachedVine !== null
      ? Math.abs(player.climbMotion) > 0.05
        ? "climb"
        : "hang"
      : player.onGround
        ? Math.abs(player.vx) > 24
          ? "run"
          : "idle"
        : player.vy < 0
          ? "jump"
          : "fall";
  drawCharacter(
    ctx,
    player.x,
    player.y,
    activeCharacter,
    player.facing,
    elapsed,
    playerMotion,
    player.vx,
    1.08,
    player.climbMotion,
  );

  for (let glow = 0; glow < 10; glow += 1) {
    const flicker = (Math.sin(elapsed * (1.2 + glow * 0.03) + glow * 2.7) + 1) / 2;
    const x = 285 + ((glow * 113) % 690);
    const y = 138 + ((glow * 71) % 260);
    ctx.fillStyle = `rgba(247,211,91,${0.08 + flicker * 0.32})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + flicker * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLeaf(ctx, -22, 93, 94, 0.36, "rgba(7,48,35,.88)");
  drawLeaf(ctx, 1186, 165, 110, 2.72, "rgba(8,52,36,.86)");
  drawLeaf(ctx, -18, 570, 86, -0.45, "rgba(6,43,33,.92)");
  drawLeaf(ctx, 1190, 570, 92, 3.64, "rgba(6,43,33,.9)");

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function drawMonkeyBranch(
  ctx: CanvasRenderingContext2D,
  platform: MonkeyPlatform,
  elapsed: number,
) {
  const centerX = platform.x + platform.width / 2;
  const sway = Math.sin(elapsed * 0.7 + platform.tree * 1.4 + platform.level) * 1.2;
  ctx.save();
  ctx.translate(centerX, platform.y + sway);

  ctx.fillStyle = "rgba(5,35,30,.26)";
  ctx.beginPath();
  ctx.ellipse(2, 9, platform.width * 0.49, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const wood = ctx.createLinearGradient(0, -13, 0, 13);
  wood.addColorStop(0, "#95663c");
  wood.addColorStop(0.45, "#654126");
  wood.addColorStop(1, "#3b291f");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(-platform.width / 2, -4);
  ctx.quadraticCurveTo(-platform.width * 0.31, -17, -platform.width * 0.09, -9);
  ctx.quadraticCurveTo(platform.width * 0.18, -19, platform.width / 2, -5);
  ctx.quadraticCurveTo(platform.width * 0.32, 11, platform.width * 0.1, 8);
  ctx.quadraticCurveTo(-platform.width * 0.2, 15, -platform.width / 2, -4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2b241c";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = "rgba(233,185,91,.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-platform.width * 0.4, -3);
  ctx.quadraticCurveTo(-12, -9, platform.width * 0.38, -4);
  ctx.stroke();

  ctx.fillStyle = "#4d8747";
  ctx.beginPath();
  ctx.moveTo(-platform.width * 0.47, -8);
  ctx.quadraticCurveTo(-platform.width * 0.15, -20, platform.width * 0.12, -11);
  ctx.quadraticCurveTo(platform.width * 0.32, -18, platform.width * 0.47, -8);
  ctx.quadraticCurveTo(platform.width * 0.12, -2, -platform.width * 0.47, -8);
  ctx.fill();

  drawLeaf(ctx, -platform.width * 0.4, -10, 22, 2.75, "#6fa44e");
  drawLeaf(ctx, platform.width * 0.35, -9, 25, 0.35, "#3f8248");
  ctx.restore();
}

function drawMonkey(
  ctx: CanvasRenderingContext2D,
  monkey: Monkey,
  elapsed: number,
  playerX: number,
) {
  const dizzy = monkey.dizzyTimer > 0;
  const airborne = monkey.targetPlatformIndex !== null;
  const pushing = !dizzy && monkey.pushCooldown > 0.48;
  const facing = playerX < monkey.x ? -1 : 1;
  const pace = elapsed * 10.2 + monkey.phase;
  const bounce = dizzy || airborne ? 0 : Math.abs(Math.sin(pace)) * 2.5;
  const lean = dizzy
    ? -0.55
    : airborne
      ? Math.max(-0.22, Math.min(0.22, monkey.vx / 440))
      : Math.max(-0.16, Math.min(0.16, monkey.vx / 400));

  ctx.save();
  ctx.translate(monkey.x, monkey.y - bounce);
  ctx.scale(facing, 1);
  ctx.rotate(lean);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (!airborne) {
    ctx.fillStyle = "rgba(6,30,25,.24)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 21, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#2d241d";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-10, -38);
  ctx.bezierCurveTo(-32, -44, -39, -17, -27, -10);
  ctx.bezierCurveTo(-17, -3, -13, -14, -19, -20);
  ctx.stroke();
  ctx.strokeStyle = "#765239";
  ctx.lineWidth = 5;
  ctx.stroke();

  const legSwing = dizzy ? 0 : airborne ? 9 : Math.sin(pace) * 9;
  ctx.strokeStyle = "#30241c";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-8, -20);
  ctx.lineTo(-11 + legSwing, -5);
  ctx.moveTo(7, -20);
  ctx.lineTo(11 - legSwing, -5);
  ctx.stroke();
  ctx.strokeStyle = "#7d5739";
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = "#30241c";
  ctx.beginPath();
  ctx.ellipse(0, -30, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  const fur = ctx.createLinearGradient(-12, -49, 13, -15);
  fur.addColorStop(0, "#9b704b");
  fur.addColorStop(1, "#5b3e2d");
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, -30, 15.5, 19.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d0a16a";
  ctx.beginPath();
  ctx.ellipse(4, -25, 8, 11, 0.1, 0, Math.PI * 2);
  ctx.fill();

  const armReach = dizzy ? 4 : 12 + Math.abs(Math.sin(pace)) * 7;
  ctx.strokeStyle = "#30241c";
  ctx.lineWidth = 10;
  ctx.beginPath();
  if (pushing) {
    const thrust = 31 + Math.sin((0.8 - monkey.pushCooldown) * 18) * 4;
    ctx.moveTo(-10, -41);
    ctx.quadraticCurveTo(5, -35, thrust, -27);
    ctx.moveTo(11, -40);
    ctx.quadraticCurveTo(19, -34, thrust + 7, -31);
  } else {
    ctx.moveTo(-12, -38);
    ctx.quadraticCurveTo(-19, -27, -14 - armReach, -20);
    ctx.moveTo(12, -38);
    ctx.quadraticCurveTo(18, -29, 13 + armReach, -24);
  }
  ctx.stroke();
  ctx.strokeStyle = "#825b3d";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = "#c59362";
  ctx.beginPath();
  if (pushing) {
    const thrust = 31 + Math.sin((0.8 - monkey.pushCooldown) * 18) * 4;
    ctx.arc(thrust, -27, 4.5, 0, Math.PI * 2);
    ctx.arc(thrust + 7, -31, 4.5, 0, Math.PI * 2);
  } else {
    ctx.arc(-14 - armReach, -20, 4, 0, Math.PI * 2);
    ctx.arc(13 + armReach, -24, 4, 0, Math.PI * 2);
  }
  ctx.fill();

  if (pushing) {
    ctx.strokeStyle = "rgba(255,225,158,.58)";
    ctx.lineWidth = 2;
    for (let swipe = 0; swipe < 3; swipe += 1) {
      ctx.beginPath();
      ctx.moveTo(43 + swipe * 7, -38 + swipe * 7);
      ctx.lineTo(55 + swipe * 7, -36 + swipe * 7);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#30241c";
  ctx.beginPath();
  ctx.arc(0, -56, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8c6244";
  ctx.beginPath();
  ctx.arc(-13, -57, 7, 0, Math.PI * 2);
  ctx.arc(13, -57, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d2a572";
  ctx.beginPath();
  ctx.ellipse(2, -54, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ecd09a";
  ctx.beginPath();
  ctx.ellipse(7, -50, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3b251d";
  ctx.lineWidth = 2;
  if (dizzy) {
    ctx.beginPath();
    ctx.moveTo(-7, -59);
    ctx.lineTo(-2, -55);
    ctx.moveTo(-2, -59);
    ctx.lineTo(-7, -55);
    ctx.moveTo(5, -59);
    ctx.lineTo(10, -55);
    ctx.moveTo(10, -59);
    ctx.lineTo(5, -55);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#fff0cc";
    ctx.beginPath();
    ctx.ellipse(-3, -58, 4, 3.2, -0.18, 0, Math.PI * 2);
    ctx.ellipse(7, -58, 4, 3.2, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b1814";
    ctx.beginPath();
    ctx.ellipse(-2, -58, 1.4, 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse(6, -58, 1.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#321d17";
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.moveTo(-8, -64);
    ctx.lineTo(0, -60.5);
    ctx.moveTo(3, -60.5);
    ctx.lineTo(12, -64);
    ctx.stroke();
  }

  ctx.fillStyle = "#3b251d";
  ctx.beginPath();
  ctx.ellipse(12, -50, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!dizzy) {
    ctx.fillStyle = "#5a2d28";
    ctx.beginPath();
    ctx.ellipse(7, -46, 6.5, 3.4, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0dfb2";
    ctx.beginPath();
    ctx.moveTo(3, -48);
    ctx.lineTo(5, -44);
    ctx.lineTo(7, -48);
    ctx.moveTo(8, -48);
    ctx.lineTo(10, -44);
    ctx.lineTo(12, -48);
    ctx.fill();
  }

  if (dizzy) {
    ctx.fillStyle = "#f4cf54";
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    for (let star = 0; star < 3; star += 1) {
      const orbit = elapsed * 3.5 + monkey.phase + star * (Math.PI * 2 / 3);
      ctx.fillText("✦", Math.cos(orbit) * 25, -78 + Math.sin(orbit) * 7);
    }
  }
  ctx.restore();
}

function drawMonkeyWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#102f38");
  sky.addColorStop(0.46, "#376b5b");
  sky.addColorStop(1, "#d49a55");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const light = ctx.createRadialGradient(650, 72, 12, 650, 72, 330);
  light.addColorStop(0, "rgba(255,223,145,.6)");
  light.addColorStop(0.32, "rgba(250,197,91,.16)");
  light.addColorStop(1, "rgba(250,197,91,0)");
  ctx.fillStyle = light;
  ctx.fillRect(280, 0, 740, 410);

  ctx.fillStyle = "rgba(12,66,55,.46)";
  for (let i = 0; i < 16; i += 1) {
    const x = i * 85 - 34;
    const height = 180 + (i % 5) * 35;
    ctx.fillRect(x, 430 - height, 23 + (i % 3) * 9, height + 170);
  }

  for (let i = 0; i < 42; i += 1) {
    const x = ((i * 173 + 47) % 1300) - 50;
    const y = 55 + ((i * 79) % 300);
    drawLeaf(
      ctx,
      x,
      y,
      23 + (i % 4) * 7,
      i * 0.63 + Math.sin(elapsed * 0.45 + i) * 0.04,
      i % 3 === 0 ? "#1a5742" : i % 3 === 1 ? "#347249" : "#5d8f4b",
    );
  }

  treeDefinitions.forEach((tree, index) => {
    ctx.save();
    ctx.translate(tree.x, 0);
    ctx.rotate(tree.lean);
    const trunk = ctx.createLinearGradient(-45, 0, 55, 0);
    trunk.addColorStop(0, "#30251d");
    trunk.addColorStop(0.2, "#5b3b25");
    trunk.addColorStop(0.58, "#8a5b31");
    trunk.addColorStop(1, "#3d2b20");
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(-37, 620);
    ctx.bezierCurveTo(-28, 490, -26, 305, -19, 105);
    ctx.quadraticCurveTo(0, 78, 20, 105);
    ctx.bezierCurveTo(26, 315, 31, 495, 42, 620);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(34,28,22,.65)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(225,171,86,.22)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, 590);
    ctx.bezierCurveTo(-1, 450, -7, 300, 3, 120);
    ctx.stroke();
    for (let notch = 0; notch < 6; notch += 1) {
      const y = 150 + notch * 72 + index * 9;
      ctx.strokeStyle = "rgba(35,25,20,.38)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(index % 2 ? 5 : -6, y, 11, 0.25, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = index % 2 ? "#235e3f" : "#2e7045";
    ctx.beginPath();
    ctx.ellipse(tree.x, 86, tree.crown, 44, index % 2 ? 0.08 : -0.08, 0, Math.PI * 2);
    ctx.fill();
    drawLeaf(ctx, tree.x - 62, 95, 70, 3.05, "#4d8948");
    drawLeaf(ctx, tree.x + 18, 70, 76, 0.12, "#5d984c");
  });

  monkeyPlatforms.forEach((platform) => drawMonkeyBranch(ctx, platform, elapsed));

  ctx.fillStyle = "#31251f";
  ctx.fillRect(0, MONKEY_GROUND_Y, MONKEY_SPIKE_LEFT, WORLD_HEIGHT - MONKEY_GROUND_Y);
  ctx.fillRect(MONKEY_SPIKE_RIGHT, MONKEY_GROUND_Y, WORLD_WIDTH - MONKEY_SPIKE_RIGHT, WORLD_HEIGHT - MONKEY_GROUND_Y);
  const bankMoss = ctx.createLinearGradient(0, MONKEY_GROUND_Y - 15, 0, MONKEY_GROUND_Y + 14);
  bankMoss.addColorStop(0, "#8daa4d");
  bankMoss.addColorStop(1, "#397247");
  ctx.fillStyle = bankMoss;
  roundedRect(ctx, -12, MONKEY_GROUND_Y - 13, MONKEY_SPIKE_LEFT + 16, 26, 10);
  ctx.fill();
  roundedRect(ctx, MONKEY_SPIKE_RIGHT - 4, MONKEY_GROUND_Y - 13, 170, 26, 10);
  ctx.fill();

  const spikeBed = ctx.createLinearGradient(0, MONKEY_GROUND_Y + 2, 0, WORLD_HEIGHT);
  spikeBed.addColorStop(0, "#5f4f37");
  spikeBed.addColorStop(1, "#241f1d");
  ctx.fillStyle = spikeBed;
  ctx.fillRect(MONKEY_SPIKE_LEFT, MONKEY_GROUND_Y + 9, MONKEY_SPIKE_RIGHT - MONKEY_SPIKE_LEFT, WORLD_HEIGHT - MONKEY_GROUND_Y);
  for (let x = MONKEY_SPIKE_LEFT; x < MONKEY_SPIKE_RIGHT; x += 18) {
    const height = 24 + ((x / 18) % 4) * 5;
    const spike = ctx.createLinearGradient(x, MONKEY_GROUND_Y - height, x, MONKEY_GROUND_Y + 8);
    spike.addColorStop(0, "#f0d79b");
    spike.addColorStop(0.35, "#9b8b67");
    spike.addColorStop(1, "#3d3a32");
    ctx.fillStyle = spike;
    ctx.beginPath();
    ctx.moveTo(x - 2, MONKEY_GROUND_Y + 10);
    ctx.lineTo(x + 8, MONKEY_GROUND_Y - height);
    ctx.lineTo(x + 17, MONKEY_GROUND_Y + 10);
    ctx.closePath();
    ctx.fill();
  }

  monkeyBarriers.forEach((barrier, index) => {
    const barrierFill = ctx.createLinearGradient(
      barrier.x,
      0,
      barrier.x + barrier.width,
      0,
    );
    barrierFill.addColorStop(0, "#30251e");
    barrierFill.addColorStop(0.45, "#895b31");
    barrierFill.addColorStop(1, "#3a2b21");
    ctx.fillStyle = barrierFill;
    roundedRect(
      ctx,
      barrier.x,
      barrier.top,
      barrier.width,
      MONKEY_GROUND_Y - barrier.top + 12,
      6,
    );
    ctx.fill();
    ctx.strokeStyle = "#211d19";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#c8aa6e";
    ctx.beginPath();
    ctx.moveTo(barrier.x - 5, barrier.top + 4);
    ctx.lineTo(barrier.x + barrier.width / 2, barrier.top - 29);
    ctx.lineTo(barrier.x + barrier.width + 5, barrier.top + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4b3d2c";
    ctx.stroke();

    ctx.strokeStyle = "#b07a42";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(barrier.x - 12, barrier.top + 45);
    ctx.lineTo(barrier.x + barrier.width + 12, barrier.top + 72);
    ctx.moveTo(barrier.x + barrier.width + 12, barrier.top + 45);
    ctx.lineTo(barrier.x - 12, barrier.top + 72);
    ctx.stroke();

    ctx.save();
    ctx.translate(
      index === 0 ? barrier.x - 4 : barrier.x - 42,
      barrier.top + 20,
    );
    ctx.rotate(index === 0 ? -0.04 : 0.04);
    ctx.fillStyle = "#e2a84a";
    roundedRect(ctx, 0, 0, index === 0 ? 70 : 108, 28, 5);
    ctx.fill();
    ctx.strokeStyle = "#81502b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#3b291d";
    ctx.font = "900 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(barrier.label, index === 0 ? 35 : 54, 18);
    ctx.restore();

    for (let thorn = 0; thorn < 4; thorn += 1) {
      const thornY = barrier.top + 28 + thorn * 24;
      ctx.fillStyle = thorn % 2 ? "#608c43" : "#3f7542";
      ctx.beginPath();
      ctx.moveTo(barrier.x + (thorn % 2 ? 1 : barrier.width - 1), thornY);
      ctx.lineTo(
        barrier.x + (thorn % 2 ? -16 : barrier.width + 16),
        thornY - 8,
      );
      ctx.lineTo(
        barrier.x + (thorn % 2 ? -2 : barrier.width + 2),
        thornY + 6,
      );
      ctx.closePath();
      ctx.fill();
    }
  });

  ctx.fillStyle = "#593b22";
  roundedRect(ctx, 1110, 426, 17, 114, 4);
  ctx.fill();
  ctx.fillStyle = "#e1a644";
  roundedRect(ctx, 1058, 404, 130, 60, 7);
  ctx.fill();
  ctx.strokeStyle = "#8d5529";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "800 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SAFE TRAIL  →", 1123, 438);

  game.monkeys.forEach((monkey) => drawMonkey(ctx, monkey, elapsed, player.x));

  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  drawCharacter(
    ctx,
    70,
    MONKEY_GROUND_Y,
    companion,
    1,
    elapsed,
    player.x > 210 ? "wave" : "idle",
    0,
    0.88,
  );

  const playerMotion: CharacterMotion = player.onGround
    ? Math.abs(player.vx) > 24
      ? "run"
      : "idle"
    : player.vy < 0
      ? "jump"
      : "fall";
  drawCharacter(
    ctx,
    player.x,
    player.y,
    activeCharacter,
    player.facing,
    elapsed,
    playerMotion,
    player.vx,
    1.08,
  );

  if (game.spikeTimer > 0) {
    const remaining = Math.max(0, MONKEY_SPIKE_LIMIT - game.spikeTimer);
    ctx.fillStyle = "rgba(68,24,18,.9)";
    roundedRect(ctx, 485, 26, 230, 76, 12);
    ctx.fill();
    ctx.strokeStyle = remaining < 1 ? "#ff765f" : "#e4b34b";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      game.spikeActive ? "JUMP OFF — DAMAGE RISING!" : "SPIKE DAMAGE SAVED",
      600,
      51,
    );
    ctx.fillStyle = "rgba(255,245,215,.2)";
    roundedRect(ctx, 520, 63, 160, 13, 7);
    ctx.fill();
    ctx.fillStyle = remaining < 0.25 ? "#ff765f" : "#e4b34b";
    roundedRect(
      ctx,
      520,
      63,
      Math.max(4, 160 * (game.spikeTimer / MONKEY_SPIKE_LIMIT)),
      13,
      7,
    );
    ctx.fill();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 12px Arial";
    ctx.fillText(
      `${game.spikeTimer.toFixed(1)} / ${MONKEY_SPIKE_LIMIT.toFixed(1)} sec damage`,
      600,
      94,
    );
  }

  for (let mote = 0; mote < 12; mote += 1) {
    const flicker = (Math.sin(elapsed * 1.3 + mote * 2.1) + 1) / 2;
    ctx.fillStyle = `rgba(247,210,91,${0.1 + flicker * 0.3})`;
    ctx.beginPath();
    ctx.arc(160 + ((mote * 91) % 880), 118 + ((mote * 67) % 350), 1.2 + flicker, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLeaf(ctx, -25, 110, 110, 0.28, "rgba(7,45,34,.9)");
  drawLeaf(ctx, 1180, 118, 116, 2.8, "rgba(7,45,34,.9)");
  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function drawRodent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  elapsed: number,
  phase: number,
  size: number,
  moving: boolean,
  wriggle = 0,
  grounded = true,
) {
  const scurry = moving ? Math.sin(elapsed * 22 + phase) : 0;
  const squirm = wriggle ? Math.sin(elapsed * 9 + phase) * wriggle : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * size, size);
  ctx.rotate(squirm * 0.12);
  ctx.lineCap = "round";
  if (grounded) {
    ctx.fillStyle = "rgba(25,40,18,.22)";
    ctx.beginPath();
    ctx.ellipse(1, 1, 15, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#c98a86";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.quadraticCurveTo(-24, -5 + scurry * 2, -28, -15 - squirm * 4);
  ctx.stroke();
  ctx.strokeStyle = "#6e4c33";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-9 + scurry * 3, 0);
  ctx.moveTo(5, -4);
  ctx.lineTo(8 - scurry * 3, 0);
  ctx.stroke();
  ctx.fillStyle = "#8c6a4b";
  ctx.beginPath();
  ctx.ellipse(0, -7, 13, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#bd9a74";
  ctx.beginPath();
  ctx.ellipse(1, -4.5, 9, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8c6a4b";
  ctx.beginPath();
  ctx.arc(11, -9, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a07a5c";
  ctx.beginPath();
  ctx.arc(9, -14.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d8a4a0";
  ctx.beginPath();
  ctx.arc(9, -14.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e1410";
  ctx.beginPath();
  ctx.arc(13, -10, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d98b8b";
  ctx.beginPath();
  ctx.arc(16.6, -8, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,30,20,.55)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(15, -8);
  ctx.lineTo(22, -10.5);
  ctx.moveTo(15, -7);
  ctx.lineTo(22, -5.5);
  ctx.stroke();
  ctx.restore();
}

function drawFruit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: number,
  scale = 1,
  grounded = true,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (grounded) {
    ctx.fillStyle = "rgba(25,40,18,.22)";
    ctx.beginPath();
    ctx.ellipse(0, 1, 12, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 0) {
    const mango = ctx.createRadialGradient(-3, -13, 2, 0, -10, 14);
    mango.addColorStop(0, "#ffd45a");
    mango.addColorStop(0.55, "#f39a2e");
    mango.addColorStop(1, "#cf5a2a");
    ctx.fillStyle = mango;
    ctx.beginPath();
    ctx.ellipse(0, -10, 12, 9, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,40,10,.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawLeaf(ctx, 3, -19, 12, -0.9, "#4f8f4d");
  } else if (kind === 1) {
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8a6a22";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-13, -6);
    ctx.quadraticCurveTo(0, -20, 13, -7);
    ctx.stroke();
    ctx.strokeStyle = "#f4d24b";
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.quadraticCurveTo(0, -16, 9, -9);
    ctx.stroke();
    ctx.fillStyle = "#5a4218";
    ctx.beginPath();
    ctx.arc(-13.5, -5.5, 2, 0, Math.PI * 2);
    ctx.arc(13.5, -6.5, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const guava = ctx.createRadialGradient(-3, -13, 2, 0, -10, 12);
    guava.addColorStop(0, "#c9e37a");
    guava.addColorStop(0.6, "#7fbf4d");
    guava.addColorStop(1, "#4d8a35");
    ctx.fillStyle = guava;
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,70,20,.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#3f6f2a";
    ctx.beginPath();
    ctx.arc(0, -20, 1.8, 0, Math.PI * 2);
    ctx.fill();
    drawLeaf(ctx, 1, -20, 11, 0.4, "#5a9a4a");
  }
  ctx.restore();
}

const eaglePalettes = [
  { body: "#3b2718", wing: "#4a3220", wingFar: "#2c1d12", feather: "#7a5a3b", chest: "#efe2c4", crest: "#2b1a10", band: "#8f7554" },
  { body: "#5a3319", wing: "#6b3f21", wingFar: "#3f2513", feather: "#9a6a3d", chest: "#f1e5cf", crest: "#3e2313", band: "#b08858" },
  { body: "#26201b", wing: "#332a23", wingFar: "#171310", feather: "#5c4d3f", chest: "#e5d7bd", crest: "#141010", band: "#7d6d5b" },
] as const;

function drawEagleWing(
  ctx: CanvasRenderingContext2D,
  palette: (typeof eaglePalettes)[number],
  angle: number,
  far: boolean,
) {
  ctx.save();
  ctx.translate(-2, -6);
  ctx.rotate(angle);
  ctx.fillStyle = far ? palette.wingFar : palette.wing;
  ctx.beginPath();
  ctx.moveTo(4, 2);
  ctx.bezierCurveTo(-16, -14, -54, -22, -86, -16);
  ctx.lineTo(-96, -9);
  ctx.lineTo(-84, -4);
  ctx.lineTo(-92, 5);
  ctx.lineTo(-77, 5);
  ctx.lineTo(-82, 14);
  ctx.lineTo(-64, 12);
  ctx.bezierCurveTo(-42, 17, -18, 13, 6, 8);
  ctx.closePath();
  ctx.fill();
  if (!far) {
    ctx.strokeStyle = palette.feather;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let feather = 0; feather < 4; feather += 1) {
      ctx.moveTo(-14 - feather * 16, -2 + feather * 1.5);
      ctx.lineTo(-30 - feather * 16, 9 + feather * 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.bezierCurveTo(-16, -12, -54, -20, -86, -15);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEagle(ctx: CanvasRenderingContext2D, eagle: Eagle, elapsed: number) {
  const palette = eaglePalettes[eagle.tint];
  const diving = eagle.mode === "dive";
  const hovering = eagle.mode === "lock";
  const carrying = eagle.mode === "carryPrey" || eagle.mode === "carryPlayer";
  const climbing = eagle.mode === "retreat";
  const flapRate = hovering ? 9 : carrying ? 7.5 : climbing ? 6 : 2.4;
  const flapAmp = hovering ? 0.8 : carrying ? 0.7 : climbing ? 0.6 : 0.24;
  const flap = diving
    ? -0.9 + Math.sin(elapsed * 6 + eagle.phase) * 0.04
    : Math.sin(elapsed * flapRate + eagle.phase) * flapAmp -
      (eagle.mode === "circle" ? 0.12 : 0.05);
  const tilt = diving
    ? Math.max(-0.2, Math.min(0.85, Math.atan2(eagle.vy, Math.abs(eagle.vx) + 40) * 0.6))
    : carrying
      ? -0.14
      : Math.max(-0.22, Math.min(0.22, eagle.vy / 900));
  const legsOut = diving || hovering || carrying;

  ctx.save();
  ctx.translate(eagle.x, eagle.y);
  ctx.scale(eagle.facing * eagle.scale, eagle.scale);
  ctx.rotate(tilt);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawEagleWing(ctx, palette, flap * 0.85 + 0.18, true);

  ctx.fillStyle = palette.wing;
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.lineTo(-54, -11);
  ctx.lineTo(-58, 0);
  ctx.lineTo(-53, 10);
  ctx.lineTo(-22, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = palette.band;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-40, -8);
  ctx.lineTo(-42, 8);
  ctx.moveTo(-50, -10);
  ctx.lineTo(-52, 9);
  ctx.stroke();

  const bodyGradient = ctx.createLinearGradient(0, -14, 0, 14);
  bodyGradient.addColorStop(0, palette.body);
  bodyGradient.addColorStop(0.62, palette.wing);
  bodyGradient.addColorStop(1, palette.chest);
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 31, 13.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.chest;
  ctx.beginPath();
  ctx.ellipse(8, 5, 18, 7.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,35,20,.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let streak = 0; streak < 4; streak += 1) {
    ctx.moveTo(-2 + streak * 6, 2);
    ctx.lineTo(-1 + streak * 6, 8);
  }
  ctx.stroke();

  if (eagle.mode === "carryPrey") {
    ctx.save();
    ctx.translate(12, 30);
    ctx.rotate(Math.sin(elapsed * 8) * 0.18 + 0.9);
    drawRodent(ctx, 0, 6, 1, elapsed, eagle.phase, 0.85, false, 1, false);
    ctx.restore();
  }

  ctx.strokeStyle = "#e0b23f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (legsOut) {
    ctx.moveTo(6, 9);
    ctx.lineTo(13, 26);
    ctx.moveTo(14, 9);
    ctx.lineTo(20, 25);
  } else {
    ctx.moveTo(4, 9);
    ctx.lineTo(3, 15);
    ctx.moveTo(11, 9);
    ctx.lineTo(10, 15);
  }
  ctx.stroke();
  ctx.strokeStyle = "#2a1c12";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (legsOut) {
    [13, 20].forEach((footX, index) => {
      const footY = 26 - index;
      ctx.moveTo(footX, footY);
      ctx.quadraticCurveTo(footX + 6, footY + 2, footX + 7, footY + 7);
      ctx.moveTo(footX, footY);
      ctx.quadraticCurveTo(footX + 1, footY + 5, footX - 1, footY + 9);
      ctx.moveTo(footX, footY);
      ctx.quadraticCurveTo(footX - 5, footY + 3, footX - 7, footY + 6);
    });
  } else {
    ctx.moveTo(3, 15);
    ctx.lineTo(6, 18);
    ctx.moveTo(10, 15);
    ctx.lineTo(13, 18);
  }
  ctx.stroke();

  ctx.fillStyle = palette.crest;
  ctx.beginPath();
  ctx.moveTo(19, -12);
  ctx.lineTo(10, -30);
  ctx.lineTo(21, -18);
  ctx.lineTo(19, -33);
  ctx.lineTo(27, -18);
  ctx.lineTo(30, -28);
  ctx.lineTo(31, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.chest;
  ctx.beginPath();
  ctx.arc(28, -8, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.body;
  ctx.beginPath();
  ctx.moveTo(22, -14);
  ctx.quadraticCurveTo(30, -18, 38, -10);
  ctx.quadraticCurveTo(30, -12, 22, -9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e5b23a";
  ctx.beginPath();
  ctx.moveTo(36, -12);
  ctx.quadraticCurveTo(50, -11, 48, -2);
  ctx.quadraticCurveTo(45, 0, 41, -3);
  ctx.quadraticCurveTo(38, -6, 36, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a2410";
  ctx.beginPath();
  ctx.moveTo(48, -6);
  ctx.quadraticCurveTo(49, -2, 46, -1);
  ctx.quadraticCurveTo(47, -3, 46, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.ellipse(31, -10, 3.6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a120c";
  ctx.beginPath();
  ctx.arc(32.2, -10, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.crest;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(25, -15);
  ctx.lineTo(37, -12.5);
  ctx.stroke();

  drawEagleWing(ctx, palette, flap, false);
  ctx.restore();
}

function drawEagleShadow(ctx: CanvasRenderingContext2D, eagle: Eagle) {
  const height = Math.max(0, Math.min(1, (EAGLE_GROUND_Y - eagle.y) / 520));
  ctx.fillStyle = `rgba(12,30,14,${0.34 * (1 - height * 0.7)})`;
  ctx.beginPath();
  ctx.ellipse(
    eagle.x,
    EAGLE_GROUND_Y + 6,
    54 * eagle.scale * (1 - height * 0.5),
    9 * (1 - height * 0.4),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawEagleHud(ctx: CanvasRenderingContext2D, game: GameState) {
  const field = game.eagle;
  const { elapsed } = game;
  const caught = field.caughtBy !== null;
  const threat = threateningEagle(field);
  const pulse = (Math.sin(elapsed * 12) + 1) / 2;

  ctx.fillStyle = "rgba(20,44,30,.84)";
  roundedRect(ctx, 18, 18, 214, 58, 12);
  ctx.fill();
  ctx.strokeStyle = field.health <= 25 ? "#ff765f" : "rgba(255,240,200,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff2cf";
  ctx.font = "900 11px Arial";
  ctx.textAlign = "left";
  ctx.fillText("HEALTH", 34, 38);
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(field.health)} / ${EAGLE_MAX_HEALTH}`, 216, 38);
  ctx.fillStyle = "rgba(255,245,215,.2)";
  roundedRect(ctx, 34, 48, 182, 13, 7);
  ctx.fill();
  ctx.fillStyle =
    field.health <= 25 ? "#ff765f" : field.health <= 50 ? "#e4b34b" : "#7fd06a";
  roundedRect(
    ctx,
    34,
    48,
    Math.max(6, (182 * field.health) / EAGLE_MAX_HEALTH),
    13,
    7,
  );
  ctx.fill();

  const handsText = caught
    ? "TALONS LOCKED · MASH SPACE"
    : field.carrying?.kind === "rodent"
      ? field.overhead
        ? "RODENT RAISED ▲ FEED THE EAGLE"
        : "RODENT · HOLD Z TO RAISE"
      : field.carrying?.kind === "fruit"
        ? "FRUIT · HOLD Z TO EAT · SPACE DROPS"
        : "HANDS EMPTY · SPACE GRABS A RODENT";
  ctx.fillStyle = "rgba(20,44,30,.84)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 292, 18, 292, 58, 12);
  ctx.fill();
  ctx.strokeStyle = field.overhead ? "#b4ec6d" : "rgba(255,240,200,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.7)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("HANDS", WORLD_WIDTH - 18 - 276, 37);
  ctx.fillStyle = field.overhead ? "#d7ff9c" : "#fff2cf";
  ctx.font = "900 11px Arial";
  ctx.fillText(handsText, WORLD_WIDTH - 18 - 276, 58);

  if (caught) {
    const remaining = Math.max(0, EAGLE_HOLD_LIMIT - field.holdTime);
    ctx.fillStyle = "rgba(68,24,18,.92)";
    roundedRect(ctx, 415, 24, 370, 92, 14);
    ctx.fill();
    ctx.strokeStyle = remaining < 1 ? "#ff765f" : "#e4b34b";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff2cf";
    ctx.font = `900 ${13 + pulse * 2}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("MASH SPACE TO BREAK FREE!", 600, 50);
    ctx.fillStyle = "rgba(255,245,215,.2)";
    roundedRect(ctx, 450, 62, 300, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#8ee46f";
    roundedRect(ctx, 450, 62, Math.max(6, 300 * Math.min(1, field.struggle)), 12, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,245,215,.2)";
    roundedRect(ctx, 450, 80, 300, 8, 4);
    ctx.fill();
    ctx.fillStyle = remaining < 1 ? "#ff765f" : "#e4b34b";
    roundedRect(ctx, 450, 80, Math.max(4, 300 * (remaining / EAGLE_HOLD_LIMIT)), 8, 4);
    ctx.fill();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 11px Arial";
    ctx.fillText(`${remaining.toFixed(1)}s before the eagle flies off with you`, 600, 106);
  } else if (threat) {
    ctx.fillStyle = `rgba(150,30,22,${0.72 + pulse * 0.2})`;
    roundedRect(ctx, 468, 24, 264, 42, 12);
    ctx.fill();
    ctx.strokeStyle = "#ffb08a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      threat.mode === "lock" ? "EAGLE LOCKED ON — RAISE A RODENT!" : "EAGLE DIVING!",
      600,
      51,
    );
  }

  if (game.noticeTimer > 0 && game.notice) {
    const fade = Math.min(1, game.noticeTimer / 0.4);
    ctx.fillStyle = `rgba(20,44,30,${0.82 * fade})`;
    roundedRect(ctx, 420, 128, 360, 36, 10);
    ctx.fill();
    ctx.fillStyle = `rgba(255,242,207,${fade})`;
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(game.notice, 600, 151);
  }
}

function drawEagleWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  const field = game.eagle;
  const caught = field.caughtBy !== null;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#4f9fcf");
  sky.addColorStop(0.42, "#a9d8e8");
  sky.addColorStop(0.68, "#f1dfb0");
  sky.addColorStop(1, "#d4b072");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sun = ctx.createRadialGradient(300, 84, 10, 300, 84, 230);
  sun.addColorStop(0, "rgba(255,247,205,.95)");
  sun.addColorStop(0.12, "rgba(255,236,160,.6)");
  sun.addColorStop(1, "rgba(255,236,160,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(40, 0, 560, 340);

  ctx.fillStyle = "rgba(255,255,255,.78)";
  for (let cloud = 0; cloud < 5; cloud += 1) {
    const x = ((cloud * 263 + elapsed * (6 + cloud * 2)) % (WORLD_WIDTH + 260)) - 130;
    const y = 58 + (cloud % 3) * 46;
    for (let puff = 0; puff < 4; puff += 1) {
      ctx.beginPath();
      ctx.ellipse(
        x + puff * 26 - 39,
        y + (puff % 2) * 5,
        28 + (puff % 2) * 8,
        13 + (puff % 3) * 3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  const drawRidge = (baseY: number, color: string, offset: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-30, WORLD_HEIGHT);
    ctx.lineTo(-30, baseY);
    for (let x = -30; x <= WORLD_WIDTH + 80; x += 90) {
      const crest =
        baseY - 40 - Math.abs(Math.sin((x + offset) * 0.009)) * 74 - ((x + offset) % 3) * 6;
      ctx.quadraticCurveTo(x + 35, crest, x + 90, baseY - 10);
    }
    ctx.lineTo(WORLD_WIDTH + 80, WORLD_HEIGHT);
    ctx.closePath();
    ctx.fill();
  };
  drawRidge(372, "rgba(84,140,150,.38)", 60);
  drawRidge(404, "rgba(48,110,96,.5)", 190);

  ctx.fillStyle = "#2f6d45";
  for (let i = 0; i < 30; i += 1) {
    const r = 26 + (i % 4) * 7;
    ctx.beginPath();
    ctx.ellipse(i * 44 - 20, 418 - (i % 3) * 8, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3d8250";
  for (let i = 0; i < 26; i += 1) {
    ctx.beginPath();
    ctx.ellipse(i * 50 + 5, 432 - (i % 2) * 6, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const meadow = ctx.createLinearGradient(0, 430, 0, WORLD_HEIGHT);
  meadow.addColorStop(0, "#9ec455");
  meadow.addColorStop(0.45, "#6ea540");
  meadow.addColorStop(1, "#3f7a35");
  ctx.fillStyle = meadow;
  ctx.fillRect(0, 436, WORLD_WIDTH, WORLD_HEIGHT - 436);

  const path = ctx.createLinearGradient(0, 522, 0, 560);
  path.addColorStop(0, "#c9a267");
  path.addColorStop(0.5, "#b08556");
  path.addColorStop(1, "#8a6540");
  ctx.fillStyle = path;
  ctx.beginPath();
  ctx.moveTo(-10, 528);
  for (let x = 0; x <= WORLD_WIDTH; x += 60) {
    ctx.quadraticCurveTo(x + 30, 522 + ((x / 60) % 2) * 6, x + 60, 526);
  }
  ctx.lineTo(WORLD_WIDTH + 10, 560);
  for (let x = WORLD_WIDTH; x >= 0; x -= 60) {
    ctx.quadraticCurveTo(x - 30, 566 - ((x / 60) % 2) * 5, x - 60, 560);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(90,60,35,.35)";
  for (let stone = 0; stone < 22; stone += 1) {
    ctx.beginPath();
    ctx.ellipse(30 + stone * 54, 532 + (stone % 4) * 6, 4 + (stone % 3), 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let x = 8; x < WORLD_WIDTH; x += 26) {
    drawLeaf(
      ctx,
      x,
      522,
      14 + (x % 5),
      -1.4 + Math.sin(elapsed * 1.1 + x * 0.3) * 0.08,
      x % 3 ? "#7fb44a" : "#a6c655",
    );
  }
  for (let flower = 0; flower < 14; flower += 1) {
    ctx.fillStyle = flower % 2 ? "#f7d84c" : "#f08bb0";
    ctx.beginPath();
    ctx.arc(240 + flower * 55 + (flower % 3) * 9, 470 + (flower % 4) * 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawForestEdge = (side: -1 | 1) => {
    const edgeX = side < 0 ? 0 : WORLD_WIDTH;
    ctx.fillStyle = "rgba(12,44,30,.22)";
    ctx.fillRect(
      side < 0 ? -10 : EAGLE_SAFE_RIGHT,
      436,
      side < 0 ? EAGLE_SAFE_LEFT + 10 : WORLD_WIDTH - EAGLE_SAFE_RIGHT + 10,
      WORLD_HEIGHT - 436,
    );
    [
      [edgeX - side * 60, 34],
      [edgeX - side * 150, 22],
    ].forEach(([trunkX, width], index) => {
      const trunk = ctx.createLinearGradient(trunkX - width / 2, 0, trunkX + width / 2, 0);
      trunk.addColorStop(0, "#30251d");
      trunk.addColorStop(0.5, "#7d5230");
      trunk.addColorStop(1, "#3d2b20");
      ctx.fillStyle = trunk;
      ctx.beginPath();
      ctx.moveTo(trunkX - width / 2 - 6, 560);
      ctx.quadraticCurveTo(trunkX - width / 2, 300, trunkX - width / 2 + 4, 120 + index * 40);
      ctx.lineTo(trunkX + width / 2 - 4, 120 + index * 40);
      ctx.quadraticCurveTo(trunkX + width / 2, 300, trunkX + width / 2 + 6, 560);
      ctx.closePath();
      ctx.fill();
    });
    const canopyX = edgeX - side * 70;
    ctx.fillStyle = "#1f5a3a";
    ctx.beginPath();
    ctx.ellipse(canopyX, 120, 210, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2c6f45";
    ctx.beginPath();
    ctx.ellipse(canopyX - side * 90, 70, 150, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a7f4b";
    ctx.beginPath();
    ctx.ellipse(canopyX + side * 30, 190, 150, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let leaf = 0; leaf < 9; leaf += 1) {
      drawLeaf(
        ctx,
        canopyX - side * (leaf * 22 - 60),
        150 + (leaf % 4) * 30 + Math.sin(elapsed * 0.9 + leaf) * 3,
        40 + (leaf % 3) * 10,
        side < 0 ? 0.5 + leaf * 0.35 : 2.6 + leaf * 0.35,
        leaf % 2 ? "#4f9151" : "#77a84f",
      );
    }
  };
  drawForestEdge(-1);
  drawForestEdge(1);

  ctx.fillStyle = "#593b22";
  roundedRect(ctx, 182, 452, 12, 82, 3);
  ctx.fill();
  ctx.fillStyle = "#e1a644";
  roundedRect(ctx, 140, 426, 96, 38, 6);
  ctx.fill();
  ctx.strokeStyle = "#8d5529";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "center";
  ctx.fillText("EAGLES AHEAD", 188, 442);
  ctx.fillText("RODENTS = SHIELDS", 188, 456);

  ctx.fillStyle = "#593b22";
  roundedRect(ctx, 1118, 428, 15, 108, 4);
  ctx.fill();
  ctx.fillStyle = "#e1a644";
  roundedRect(ctx, 1064, 404, 122, 56, 7);
  ctx.fill();
  ctx.strokeStyle = "#8d5529";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "800 15px Arial";
  ctx.fillText("TRAIL  →", 1125, 438);

  field.eagles.forEach((eagle) => {
    if (!eagle.dormant && eagle.mode !== "away" && eagle.y > -40) drawEagleShadow(ctx, eagle);
  });

  const threat = threateningEagle(field);
  if (threat && !caught) {
    const pulse = (Math.sin(elapsed * 12) + 1) / 2;
    ctx.strokeStyle = `rgba(220,60,40,${0.45 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(player.x, EAGLE_GROUND_Y + 5, 34 + pulse * 6, 9 + pulse * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  field.fruits.forEach((fruit) => drawFruit(ctx, fruit.x, EAGLE_GROUND_Y, fruit.kind));
  field.rodents.forEach((rodent) =>
    drawRodent(
      ctx,
      rodent.x,
      EAGLE_GROUND_Y,
      rodent.vx >= 0 ? 1 : -1,
      elapsed,
      rodent.phase,
      rodent.size,
      rodent.pause <= 0,
    ),
  );

  if (field.carrying === null && player.onGround && !caught) {
    [...field.rodents.map((rodent) => rodent.x), ...field.fruits.map((fruit) => fruit.x)]
      .filter((x) => Math.abs(x - player.x) < 40)
      .forEach((x) => {
        ctx.strokeStyle = "rgba(255,244,170,.85)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(x, EAGLE_GROUND_Y + 3, 22, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
  }

  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  drawCharacter(
    ctx,
    62,
    EAGLE_GROUND_Y,
    companion,
    1,
    elapsed,
    player.x > EAGLE_SAFE_LEFT ? "wave" : "idle",
    0,
    0.88,
  );
  if (player.x > EAGLE_SAFE_LEFT && player.x < 620 && !caught) {
    const bubbleY = 372 + Math.sin(elapsed * 2.8) * 2;
    ctx.fillStyle = "rgba(247,232,186,.92)";
    roundedRect(ctx, 14, bubbleY, 150, 34, 13);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(58, bubbleY + 31);
    ctx.lineTo(66, bubbleY + 43);
    ctx.lineTo(74, bubbleY + 31);
    ctx.fill();
    ctx.fillStyle = "#244638";
    ctx.font = "800 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("RAISE A RODENT!", 89, bubbleY + 21);
  }

  if (!caught) {
    if (player.onGround && Math.abs(player.vx) > 120) {
      ctx.fillStyle = "rgba(224,190,121,.32)";
      for (let dust = 0; dust < 4; dust += 1) {
        const direction = player.vx > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.arc(player.x + direction * (14 + dust * 8), player.y - 2 - dust * 2, 3 + dust, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const playerMotion: CharacterMotion = !player.onGround
      ? player.vy < 0
        ? "jump"
        : "fall"
      : field.carrying
        ? field.overhead
          ? "lift"
          : "carry"
        : Math.abs(player.vx) > 24
          ? "run"
          : "idle";
    drawCharacter(
      ctx,
      player.x,
      player.y,
      activeCharacter,
      player.facing,
      elapsed,
      playerMotion,
      player.vx,
      1.08,
    );
    if (field.carrying?.kind === "rodent") {
      if (field.overhead) {
        drawRodent(
          ctx,
          player.x + player.facing * 2,
          player.y - 100,
          player.facing,
          elapsed,
          field.carrying.phase,
          field.carrying.size * 0.95,
          false,
          1,
          false,
        );
      } else {
        drawRodent(
          ctx,
          player.x + player.facing * 16,
          player.y - 31,
          player.facing,
          elapsed,
          field.carrying.phase,
          field.carrying.size * 0.9,
          false,
          0.6,
          false,
        );
      }
    } else if (field.carrying?.kind === "fruit") {
      const eating = field.eatProgress > 0;
      drawFruit(
        ctx,
        player.x + player.facing * (eating ? 12 : 17),
        eating ? player.y - 60 : player.y - 30,
        field.carrying.fruitKind,
        eating ? 1 - field.eatProgress * 0.5 : 1,
        false,
      );
    }
    if (field.landRecovery > 0 && player.onGround) {
      ctx.fillStyle = "#f4cf54";
      ctx.font = "900 14px Arial";
      ctx.textAlign = "center";
      for (let star = 0; star < 3; star += 1) {
        const orbit = elapsed * 4 + star * ((Math.PI * 2) / 3);
        ctx.fillText("✦", player.x + Math.cos(orbit) * 22, player.y - 96 + Math.sin(orbit) * 6);
      }
    }
  }

  field.eagles.forEach((eagle) => {
    if (eagle.dormant || eagle.mode === "away") return;
    if (eagle.mode === "carryPlayer") {
      drawCharacter(ctx, player.x, player.y, activeCharacter, player.facing, elapsed, "hang", 0, 1.08);
    }
    drawEagle(ctx, eagle, elapsed);
  });

  if (threat && !caught) {
    const bounce = Math.abs(Math.sin(elapsed * 9)) * 6;
    ctx.fillStyle = "#ff5a45";
    ctx.font = "900 26px Arial";
    ctx.textAlign = "center";
    ctx.fillText("!", player.x, player.y - 118 - bounce);
  }

  for (let x = -6; x < WORLD_WIDTH; x += 34) {
    drawLeaf(
      ctx,
      x,
      572 + (x % 3) * 6,
      26 + (x % 4) * 3,
      -1.5 + Math.sin(elapsed * 1.3 + x * 0.2) * 0.07,
      x % 2 ? "#3f7f3a" : "#568f3f",
    );
  }

  drawEagleHud(ctx, game);

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function drawHippo(
  ctx: CanvasRenderingContext2D,
  hippo: Hippo,
  elapsed: number,
  occupiedZone: HippoZone | null,
) {
  const sinkOffset = hippo.sink * 78;
  const shake = hippo.mode === "shake" ? Math.sin(elapsed * 42) * 5 : 0;
  const angry = hippo.mode === "chomp" || hippo.mode === "shake" || hippo.mode === "dive";
  const baseY = HIPPO_WATER_Y - 8 + hippo.bob + sinkOffset;
  const body = "#7d6d80";
  const shade = "#584a5c";
  const belly = "#a595a8";
  const outline = "#3a2f3d";

  ctx.save();
  ctx.translate(hippo.x, baseY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.moveTo(86, 6);
  ctx.quadraticCurveTo(92, -62, 140, -60);
  ctx.quadraticCurveTo(188, -62, 198, -18);
  ctx.lineTo(198, 30);
  ctx.lineTo(86, 30);
  ctx.closePath();
  ctx.fill();
  const backGradient = ctx.createLinearGradient(0, -60, 0, 30);
  backGradient.addColorStop(0, "#8f7f92");
  backGradient.addColorStop(0.55, body);
  backGradient.addColorStop(1, shade);
  ctx.fillStyle = backGradient;
  ctx.beginPath();
  ctx.moveTo(88, 6);
  ctx.quadraticCurveTo(94, -58, 140, -56);
  ctx.quadraticCurveTo(186, -58, 195, -18);
  ctx.lineTo(195, 28);
  ctx.lineTo(88, 28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,245,.16)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, -40);
  ctx.quadraticCurveTo(140, -52, 180, -36);
  ctx.stroke();
  ctx.fillStyle = "rgba(40,30,45,.22)";
  for (let fold = 0; fold < 3; fold += 1) {
    ctx.beginPath();
    ctx.ellipse(112 + fold * 24, -18 + fold * 4, 9, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = shade;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(192, -12);
  ctx.quadraticCurveTo(204, -4, 200, 12);
  ctx.stroke();

  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = outline;
  roundedRect(ctx, 42, -40, 56, 72, 16);
  ctx.fill();
  const headGradient = ctx.createLinearGradient(0, -40, 0, 30);
  headGradient.addColorStop(0, "#8b7b8e");
  headGradient.addColorStop(1, shade);
  ctx.fillStyle = headGradient;
  roundedRect(ctx, 44, -38, 52, 68, 15);
  ctx.fill();
  [56, 82].forEach((earX) => {
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(earX, -40, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(earX, -40, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d59aa7";
    ctx.beginPath();
    ctx.arc(earX, -40, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  [54, 76].forEach((eyeX) => {
    ctx.fillStyle = "#fff5e6";
    ctx.beginPath();
    ctx.ellipse(eyeX, -24, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1418";
    ctx.beginPath();
    ctx.arc(eyeX - 1.5, -24, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(eyeX - 2.5, -25.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    if (angry) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(eyeX - 7, -33);
      ctx.lineTo(eyeX + 6, -29);
      ctx.stroke();
    }
  });

  ctx.save();
  ctx.translate(46, -6);
  ctx.rotate(-hippo.mouthOpen * 0.28);
  ctx.translate(-46, 6);
  ctx.fillStyle = outline;
  roundedRect(ctx, -4, -22, 54, 28, 12);
  ctx.fill();
  const snoutGradient = ctx.createLinearGradient(0, -22, 0, 6);
  snoutGradient.addColorStop(0, "#8b7b8e");
  snoutGradient.addColorStop(1, body);
  ctx.fillStyle = snoutGradient;
  roundedRect(ctx, -2, -20, 52, 25, 11);
  ctx.fill();
  ctx.fillStyle = "#2f2430";
  ctx.beginPath();
  ctx.ellipse(8, -13, 3.2, 2.2, 0.2, 0, Math.PI * 2);
  ctx.ellipse(19, -14, 3.2, 2.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const jawAngle = hippo.mouthOpen * 0.78;
  ctx.save();
  ctx.translate(46, 4);
  ctx.rotate(jawAngle);
  ctx.fillStyle = "#d9788b";
  roundedRect(ctx, -50, -3, 50, 14, 6);
  ctx.fill();
  ctx.fillStyle = outline;
  roundedRect(ctx, -52, 2, 54, 18, 8);
  ctx.fill();
  ctx.fillStyle = belly;
  roundedRect(ctx, -50, 4, 50, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#f4ecd8";
  ctx.beginPath();
  ctx.moveTo(-44, 4);
  ctx.lineTo(-40, -6);
  ctx.lineTo(-36, 4);
  ctx.moveTo(-30, 4);
  ctx.lineTo(-27, -3);
  ctx.lineTo(-24, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (hippo.mouthOpen > 0.2) {
    ctx.fillStyle = "#f4ecd8";
    ctx.beginPath();
    ctx.moveTo(2, 4);
    ctx.lineTo(5, 12 * hippo.mouthOpen);
    ctx.lineTo(8, 4);
    ctx.moveTo(16, 4);
    ctx.lineTo(19, 9 * hippo.mouthOpen);
    ctx.lineTo(22, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (hippo.bird) {
    const hop = Math.abs(Math.sin(elapsed * 6 + hippo.id)) * 3;
    ctx.save();
    ctx.translate(150, -58 - hop);
    ctx.fillStyle = "#4b3a2e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, -4, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0432f";
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-14, -3);
    ctx.lineTo(-9, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3d69b";
    ctx.beginPath();
    ctx.arc(-6.5, -4.8, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e0432f";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2, 4);
    ctx.lineTo(-2, 7);
    ctx.moveTo(2, 4);
    ctx.lineTo(2, 7);
    ctx.stroke();
    ctx.restore();
  }

  if (occupiedZone) {
    const span = zoneSpan(hippo, occupiedZone);
    ctx.strokeStyle =
      occupiedZone === "back"
        ? "rgba(180,236,109,.55)"
        : occupiedZone === "head"
          ? "rgba(255,200,90,.6)"
          : "rgba(255,110,90,.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.ellipse((span.start + span.end) / 2 - hippo.x, span.y - baseY + 3, (span.end - span.start) / 2, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawHippoHud(ctx: CanvasRenderingContext2D, game: GameState) {
  const river = game.hippo;
  const { elapsed, player } = game;
  const standing = river.standing;

  ctx.fillStyle = "rgba(20,44,30,.84)";
  roundedRect(ctx, 18, 18, 318, 52, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.7)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("JUMPS", 34, 37);
  ctx.fillStyle = "#fff2cf";
  ctx.font = "900 11px Arial";
  ctx.fillText("SPACE short hop · hold Z + SPACE long jump", 34, 56);

  ctx.fillStyle = "rgba(20,44,30,.84)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 236, 18, 236, 52, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.3)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.7)";
  ctx.font = "900 10px Arial";
  ctx.fillText("LANDING SPOTS", WORLD_WIDTH - 18 - 220, 37);
  ctx.font = "900 11px Arial";
  ctx.fillStyle = "#ff9b86";
  ctx.fillText("MOUTH ✕", WORLD_WIDTH - 18 - 220, 56);
  ctx.fillStyle = "#ffd27a";
  ctx.fillText("HEAD 0.7s", WORLD_WIDTH - 18 - 150, 56);
  ctx.fillStyle = "#b4ec6d";
  ctx.fillText(`BACK ${HIPPO_BACK_LIMIT.toFixed(1)}s`, WORLD_WIDTH - 18 - 72, 56);

  if (standing && "hippo" in standing && !river.lost) {
    const hippo = river.hippos[standing.hippo];
    const limit = zoneLimit(standing.zone, hippo);
    const used = standing.zone === "back" ? river.backTime : river.zoneTimer;
    const remaining = Math.max(0, limit - used);
    const x = hippo.x + HIPPO_LENGTH / 2;
    const y = HIPPO_WATER_Y + hippo.bob - 124;
    const color =
      standing.zone === "back" ? (remaining < 0.8 ? "#ff765f" : "#b4ec6d") : standing.zone === "head" ? "#ffd27a" : "#ff765f";
    ctx.fillStyle = "rgba(20,44,30,.8)";
    roundedRect(ctx, x - 62, y - 14, 124, 30, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,245,215,.2)";
    roundedRect(ctx, x - 52, y - 4, 104, 8, 4);
    ctx.fill();
    ctx.fillStyle = color;
    roundedRect(ctx, x - 52, y - 4, Math.max(4, 104 * (remaining / limit)), 8, 4);
    ctx.fill();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      standing.zone === "mouth" ? "MOUTH — NO!" : standing.zone === "head" ? "HEAD — HOP NOW" : "BACK — REST, THEN GO",
      x,
      y + 12,
    );
  }

  if (river.chargeHeld > 0 && player.onGround && !river.lost) {
    const x = player.x;
    const y = player.y - 112;
    const fill = Math.min(1, river.charge / HIPPO_MAX_CHARGE);
    const over = river.chargeHeld > HIPPO_OVERCHARGE_START;
    const sweetStart = 1 / HIPPO_MAX_CHARGE;
    ctx.fillStyle = "rgba(20,44,30,.85)";
    roundedRect(ctx, x - 48, y - 12, 96, 26, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,245,215,.18)";
    roundedRect(ctx, x - 40, y - 4, 80, 8, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(180,236,109,.35)";
    ctx.fillRect(x - 40 + 80 * sweetStart - 4, y - 4, 10, 8);
    ctx.fillStyle = over ? "#ff765f" : river.charge >= 1 ? "#b4ec6d" : "#e4b34b";
    roundedRect(ctx, x - 40, y - 4, Math.max(3, 80 * fill), 8, 4);
    ctx.fill();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 8px Arial";
    ctx.textAlign = "center";
    ctx.fillText(over ? "TOO MUCH!" : river.charge >= 1 ? "LONG JUMP READY" : "CHARGING…", x, y + 10);
  }

  if (game.noticeTimer > 0 && game.notice) {
    const fade = Math.min(1, game.noticeTimer / 0.4);
    ctx.fillStyle = `rgba(20,44,30,${0.82 * fade})`;
    roundedRect(ctx, 420, 92, 360, 36, 10);
    ctx.fill();
    ctx.fillStyle = `rgba(255,242,207,${fade})`;
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(game.notice, 600, 115);
  }
  void elapsed;
}

function drawHippoWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  const river = game.hippo;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#f3b46b");
  sky.addColorStop(0.35, "#f0865a");
  sky.addColorStop(0.6, "#c86a63");
  sky.addColorStop(1, "#3d4a5a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sun = ctx.createRadialGradient(880, 300, 20, 880, 300, 260);
  sun.addColorStop(0, "rgba(255,240,190,.95)");
  sun.addColorStop(0.16, "rgba(255,210,130,.65)");
  sun.addColorStop(1, "rgba(255,190,120,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(560, 40, 640, 460);
  ctx.fillStyle = "#ffe9b3";
  ctx.beginPath();
  ctx.arc(880, 300, 44, 0, Math.PI * 2);
  ctx.fill();

  const drawRidge = (baseY: number, color: string, offset: number, height: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-30, WORLD_HEIGHT);
    ctx.lineTo(-30, baseY);
    for (let x = -30; x <= WORLD_WIDTH + 80; x += 90) {
      const crest = baseY - 20 - Math.abs(Math.sin((x + offset) * 0.008)) * height - ((x + offset) % 3) * 6;
      ctx.quadraticCurveTo(x + 35, crest, x + 90, baseY - 10);
    }
    ctx.lineTo(WORLD_WIDTH + 80, WORLD_HEIGHT);
    ctx.closePath();
    ctx.fill();
  };
  drawRidge(340, "rgba(120,70,100,.45)", 80, 90);
  drawRidge(372, "rgba(70,45,80,.6)", 260, 70);

  ctx.fillStyle = "#2f3a3a";
  for (let i = 0; i < 34; i += 1) {
    const x = i * 38 - 16;
    const height = 26 + (i % 4) * 9;
    ctx.beginPath();
    ctx.ellipse(x, 372 - height / 2, 22 + (i % 3) * 6, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 2, 372 - height / 2, 4, height / 2 + 20);
  }
  ctx.fillStyle = "#3b4a44";
  for (let i = 0; i < 40; i += 1) {
    ctx.beginPath();
    ctx.ellipse(i * 32 + 4, 394 - (i % 2) * 5, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const farShore = ctx.createLinearGradient(0, 398, 0, 420);
  farShore.addColorStop(0, "#6b7d4f");
  farShore.addColorStop(1, "#4d5f3b");
  ctx.fillStyle = farShore;
  ctx.fillRect(0, 398, WORLD_WIDTH, 24);
  for (let x = 0; x < WORLD_WIDTH; x += 14) {
    ctx.strokeStyle = x % 3 ? "#7d9552" : "#5a7a3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 412);
    ctx.quadraticCurveTo(x + 3 + Math.sin(elapsed * 1.3 + x) * 2, 398, x + 6, 386 - (x % 5) * 3);
    ctx.stroke();
  }

  const water = ctx.createLinearGradient(0, 418, 0, WORLD_HEIGHT);
  water.addColorStop(0, "#6f8f78");
  water.addColorStop(0.22, "#4c7a6a");
  water.addColorStop(0.6, "#2f5a58");
  water.addColorStop(1, "#1d3a42");
  ctx.fillStyle = water;
  ctx.fillRect(0, 418, WORLD_WIDTH, WORLD_HEIGHT - 418);
  const glint = ctx.createLinearGradient(700, 0, 1060, 0);
  glint.addColorStop(0, "rgba(255,214,140,0)");
  glint.addColorStop(0.5, "rgba(255,214,140,.32)");
  glint.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = glint;
  ctx.fillRect(700, 420, 360, 200);
  for (let band = 0; band < 7; band += 1) {
    const y = 430 + band * 26;
    ctx.strokeStyle = band % 2 ? "rgba(200,235,210,.16)" : "rgba(255,220,150,.12)";
    ctx.lineWidth = band < 2 ? 1.6 : 1.2;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += 12) {
      const wave = Math.sin(x * (0.02 + band * 0.002) + elapsed * (1.2 + band * 0.1)) * (2.6 - band * 0.2);
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const standing = river.standing;
  const occupiedHippo = standing && "hippo" in standing ? standing.hippo : null;
  const occupiedZone = standing && "hippo" in standing ? standing.zone : null;
  river.hippos.forEach((hippo) => {
    const baseY = HIPPO_WATER_Y + hippo.bob + hippo.sink * 78;
    ctx.strokeStyle = "rgba(220,240,225,.28)";
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 2; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(
        hippo.x + HIPPO_LENGTH / 2,
        HIPPO_WATER_Y + 8 + ring * 6,
        HIPPO_LENGTH * 0.58 + ring * 16 + Math.sin(elapsed * 2 + hippo.id) * 3,
        7 + ring * 3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (hippo.diver && (hippo.mode === "yawn" || hippo.mode === "submerged" || hippo.mode === "rising")) {
      ctx.strokeStyle = "rgba(230,245,235,.7)";
      ctx.lineWidth = 1.4;
      for (let bubble = 0; bubble < 6; bubble += 1) {
        const phase = (elapsed * 1.6 + bubble * 0.7) % 1;
        ctx.beginPath();
        ctx.arc(hippo.x + 40 + bubble * 24, HIPPO_WATER_Y + 24 - phase * 30, 2 + (bubble % 3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    drawHippo(ctx, hippo, elapsed, occupiedHippo === hippo.id ? occupiedZone : null);
    void baseY;
  });

  const surface = ctx.createLinearGradient(0, HIPPO_WATER_Y, 0, WORLD_HEIGHT);
  surface.addColorStop(0, "rgba(70,120,110,.55)");
  surface.addColorStop(0.3, "rgba(45,90,90,.8)");
  surface.addColorStop(1, "rgba(25,55,65,.95)");
  ctx.fillStyle = surface;
  ctx.fillRect(0, HIPPO_WATER_Y, WORLD_WIDTH, WORLD_HEIGHT - HIPPO_WATER_Y);
  ctx.strokeStyle = "rgba(225,245,230,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= WORLD_WIDTH; x += 10) {
    const wave = Math.sin(x * 0.03 + elapsed * 1.8) * 2.2;
    if (x === 0) ctx.moveTo(x, HIPPO_WATER_Y + wave);
    else ctx.lineTo(x, HIPPO_WATER_Y + wave);
  }
  ctx.stroke();

  const drawBank = (left: number, width: number, side: -1 | 1) => {
    ctx.fillStyle = "#3a2c22";
    roundedRect(ctx, left - 6, HIPPO_BANK_Y - 4, width + 12, WORLD_HEIGHT - HIPPO_BANK_Y + 20, 10);
    ctx.fill();
    const earth = ctx.createLinearGradient(0, HIPPO_BANK_Y, 0, WORLD_HEIGHT);
    earth.addColorStop(0, "#8a6a44");
    earth.addColorStop(0.35, "#5f4630");
    earth.addColorStop(1, "#2f241d");
    ctx.fillStyle = earth;
    roundedRect(ctx, left - 2, HIPPO_BANK_Y, width + 4, WORLD_HEIGHT - HIPPO_BANK_Y + 20, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,220,160,.18)";
    ctx.lineWidth = 2;
    for (let layer = 0; layer < 5; layer += 1) {
      ctx.beginPath();
      ctx.moveTo(left + 4, HIPPO_BANK_Y + 22 + layer * 28);
      ctx.lineTo(left + width - 4, HIPPO_BANK_Y + 26 + layer * 28);
      ctx.stroke();
    }
    const grass = ctx.createLinearGradient(0, HIPPO_BANK_Y - 14, 0, HIPPO_BANK_Y + 10);
    grass.addColorStop(0, "#8fb04c");
    grass.addColorStop(1, "#4f7a3a");
    ctx.fillStyle = grass;
    roundedRect(ctx, left - 4, HIPPO_BANK_Y - 12, width + 8, 24, 10);
    ctx.fill();
    for (let x = left + 6; x < left + width - 4; x += 16) {
      drawLeaf(ctx, x, HIPPO_BANK_Y - 6, 14 + (x % 4), -1.35 + Math.sin(elapsed * 0.9 + x) * 0.05, x % 3 ? "#6f9a44" : "#9bb14a");
    }
    const edgeX = side < 0 ? left + width : left;
    for (let reed = 0; reed < 6; reed += 1) {
      const rx = edgeX + side * (6 + reed * 9);
      const sway = Math.sin(elapsed * 1.4 + reed) * 3;
      ctx.strokeStyle = reed % 2 ? "#5f8a3d" : "#7aa347";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx, HIPPO_WATER_Y + 6);
      ctx.quadraticCurveTo(rx + sway, HIPPO_WATER_Y - 30, rx + sway * 1.5, HIPPO_WATER_Y - 62 - (reed % 3) * 12);
      ctx.stroke();
      ctx.fillStyle = "#6b4b2e";
      ctx.beginPath();
      ctx.ellipse(rx + sway * 1.5, HIPPO_WATER_Y - 66 - (reed % 3) * 12, 3, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawBank(-20, HIPPO_BANK_LEFT + 20, -1);
  drawBank(HIPPO_BANK_RIGHT, WORLD_WIDTH - HIPPO_BANK_RIGHT + 20, 1);

  ctx.fillStyle = "#593b22";
  roundedRect(ctx, 1122, 330, 15, 110, 4);
  ctx.fill();
  ctx.fillStyle = "#e1a644";
  roundedRect(ctx, 1068, 308, 122, 56, 7);
  ctx.fill();
  ctx.strokeStyle = "#8d5529";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "800 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TRAIL  →", 1129, 342);

  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  drawCharacter(ctx, 48, HIPPO_BANK_Y, companion, 1, elapsed, player.x > HIPPO_BANK_LEFT ? "wave" : "idle", 0, 0.88);
  if (player.x > HIPPO_BANK_LEFT && !river.lost && !river.won) {
    const bubbleY = 318 + Math.sin(elapsed * 2.8) * 2;
    ctx.fillStyle = "rgba(247,232,186,.92)";
    roundedRect(ctx, 8, bubbleY, 150, 34, 13);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(44, bubbleY + 31);
    ctx.lineTo(52, bubbleY + 43);
    ctx.lineTo(60, bubbleY + 31);
    ctx.fill();
    ctx.fillStyle = "#244638";
    ctx.font = "800 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("NOT THE MOUTH!", 83, bubbleY + 21);
  }

  if (river.lost) {
    const splashX = river.splashX;
    drawCharacter(ctx, splashX, HIPPO_SPLASH_Y + 16, activeCharacter, player.facing, elapsed, "fall", 0, 1.08);
    ctx.fillStyle = "rgba(60,100,105,.85)";
    ctx.fillRect(splashX - 60, HIPPO_WATER_Y + 2, 120, 60);
    ctx.strokeStyle = "rgba(235,250,245,.85)";
    ctx.lineWidth = 3;
    for (let drop = 0; drop < 7; drop += 1) {
      const angle = -2.6 + drop * 0.37;
      const reach = 26 + (drop % 3) * 10;
      ctx.beginPath();
      ctx.moveTo(splashX + Math.cos(angle) * 8, HIPPO_WATER_Y + Math.sin(angle) * 4);
      ctx.lineTo(splashX + Math.cos(angle) * reach, HIPPO_WATER_Y + Math.sin(angle) * reach * 0.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(splashX, HIPPO_WATER_Y + 4, 48, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SPLASH!", splashX, HIPPO_WATER_Y - 40);
  } else {
    const playerMotion: CharacterMotion = !player.onGround
      ? player.vy < 0
        ? "jump"
        : "fall"
      : Math.abs(player.vx) > 24
        ? "run"
        : river.chargeHeld > 0
          ? "carry"
          : "idle";
    drawCharacter(ctx, player.x, player.y, activeCharacter, player.facing, elapsed, playerMotion, player.vx, 1.08);
    if (standing && "hippo" in standing && standing.zone === "mouth") {
      ctx.fillStyle = "#ff5a45";
      ctx.font = "900 26px Arial";
      ctx.textAlign = "center";
      ctx.fillText("!", player.x, player.y - 112 - Math.abs(Math.sin(elapsed * 12)) * 6);
    }
  }

  drawHippoHud(ctx, game);

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function snakeMoveForCode(code: string): SnakeMove | null {
  if (code === "ArrowRight" || code === "KeyD" || code === "Space") return "forward";
  if (code === "ArrowLeft" || code === "KeyA") return "back";
  if (code === "ArrowUp" || code === "KeyW") return "up";
  if (code === "ArrowDown" || code === "KeyS") return "down";
  return null;
}

function bandColor(band: SnakeBand) {
  const hue = 22 + band.tint * 10;
  const light = 30 + band.tint * 9;
  return {
    body: `hsl(${hue} 42% ${light}%)`,
    dark: `hsl(${hue} 46% ${light - 14}%)`,
    light: `hsl(${hue + 6} 48% ${light + 16}%)`,
  };
}

function drawSnakeBand(
  ctx: CanvasRenderingContext2D,
  band: SnakeBand,
  elapsed: number,
  awake: boolean,
  biting: boolean,
) {
  const colors = bandColor(band);
  const wiggle = awake && band.kind === "snake" ? 2.4 : 0;
  const points = band.cells.map((cell, index) => {
    const center = cellCenter(cell.col, cell.lane);
    const phase = elapsed * 16 + band.wobble + index * 1.1;
    return { x: center.x + Math.sin(phase) * wiggle, y: center.y + Math.cos(phase * 0.8) * wiggle };
  });
  const trace = () => {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(10,6,3,.35)";
  ctx.lineWidth = 40;
  ctx.translate(3, 5);
  trace();
  ctx.stroke();
  ctx.translate(-3, -5);
  ctx.strokeStyle = "#20150e";
  ctx.lineWidth = 36;
  trace();
  ctx.stroke();
  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 29;
  trace();
  ctx.stroke();
  ctx.strokeStyle = colors.light;
  ctx.lineWidth = 7;
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = band.wobble * 10;
  trace();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = colors.dark;
  ctx.lineWidth = 2;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[index + 1] ?? points[index - 1] ?? point;
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    for (let tick = -1; tick <= 1; tick += 1) {
      const tx = point.x + (dx / length) * tick * 14;
      const ty = point.y + (dy / length) * tick * 14;
      ctx.beginPath();
      ctx.moveTo(tx + nx * 6, ty + ny * 6);
      ctx.lineTo(tx + nx * 12, ty + ny * 12);
      ctx.moveTo(tx - nx * 6, ty - ny * 6);
      ctx.lineTo(tx - nx * 12, ty - ny * 12);
      ctx.stroke();
    }
  }
  const ends = points.length > 1 ? [points[0], points[points.length - 1]] : [points[0]];
  ends.forEach((end) => {
    ctx.fillStyle = "#20150e";
    ctx.beginPath();
    ctx.arc(end.x, end.y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  });

  if (awake && band.kind === "snake") {
    ctx.strokeStyle = "rgba(255,226,150,.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 7]);
    trace();
    ctx.stroke();
    ctx.setLineDash([]);
    const { head, neck } = snakeHead(band);
    const headPoint = points[band.headAtEnd ? points.length - 1 : 0];
    const neckCenter = neck ? cellCenter(neck.col, neck.lane) : { x: headPoint.x - 1, y: headPoint.y };
    const headCenter = cellCenter(head.col, head.lane);
    const angle = Math.atan2(headPoint.y - neckCenter.y, headPoint.x - neckCenter.x);
    void headCenter;
    ctx.save();
    ctx.translate(headPoint.x, headPoint.y);
    ctx.rotate(angle);
    const open = biting ? 0.9 : 0.55 + Math.sin(elapsed * 14 + band.wobble) * 0.15;
    ctx.fillStyle = "#20150e";
    ctx.beginPath();
    ctx.ellipse(6, 0, 26, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(6, 0, 23, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9556b";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(30, -12 * open);
    ctx.quadraticCurveTo(34, 0, 30, 12 * open);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff6e6";
    ctx.beginPath();
    ctx.moveTo(24, -9 * open);
    ctx.lineTo(27, -2 * open);
    ctx.lineTo(21, -5 * open);
    ctx.moveTo(24, 9 * open);
    ctx.lineTo(27, 2 * open);
    ctx.lineTo(21, 5 * open);
    ctx.closePath();
    ctx.fill();
    const flick = 22 + Math.sin(elapsed * 26 + band.wobble) * 8;
    ctx.strokeStyle = "#e0323f";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(30 + flick, 0);
    ctx.lineTo(30 + flick + 6, -4);
    ctx.moveTo(30 + flick, 0);
    ctx.lineTo(30 + flick + 6, 4);
    ctx.stroke();
    [-8, 8].forEach((side) => {
      ctx.fillStyle = "#f5d34a";
      ctx.beginPath();
      ctx.ellipse(4, side, 5.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a120c";
      ctx.beginPath();
      ctx.ellipse(5, side, 1.6, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#20150e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-2, side * 1.6);
      ctx.lineTo(10, side * 1.1);
      ctx.stroke();
    });
    ctx.restore();
  }
  ctx.restore();
}

function drawTopDownCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  character: Character,
  facing: SnakeMove,
  elapsed: number,
  hop: number,
  moving: boolean,
) {
  const isGuto = character === "guto";
  const shirt = isGuto ? "#2878c8" : "#dc554d";
  const shirtDark = isGuto ? "#175196" : "#9d3837";
  const angle = facing === "forward" ? 0 : facing === "back" ? Math.PI : facing === "up" ? -Math.PI / 2 : Math.PI / 2;
  const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, hop)));
  const scale = 1 + lift * 0.38;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(5,10,8,${0.32 - lift * 0.18})`;
  ctx.beginPath();
  ctx.ellipse(2, 4, 20 - lift * 4, 14 - lift * 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(scale, scale);
  ctx.rotate(angle);
  const stride = moving ? Math.sin(elapsed * 22) * 5 : 0;
  ctx.fillStyle = "#18251f";
  ctx.beginPath();
  ctx.ellipse(-6 + stride * 0.3, -10, 5, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(-6 - stride * 0.3, 10, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#18251f";
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  const shirtGradient = ctx.createLinearGradient(-14, -18, 12, 18);
  shirtGradient.addColorStop(0, shirt);
  shirtGradient.addColorStop(1, shirtDark);
  ctx.fillStyle = shirtGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15.5, 20.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d48a55";
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(4 + stride * side * 0.4, side * 21, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = "#18251f";
  ctx.lineWidth = 1.5;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(4 + stride * side * 0.4, side * 21, 5, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (!isGuto) {
    ctx.fillStyle = "#231612";
    ctx.beginPath();
    ctx.ellipse(-16, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d17b37";
    ctx.beginPath();
    ctx.arc(-11, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#18251f";
  ctx.beginPath();
  ctx.arc(2, 0, 15.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d48a55";
  ctx.beginPath();
  ctx.ellipse(12, 0, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#231612";
  ctx.beginPath();
  ctx.arc(1, 0, 13.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,240,210,.22)";
  ctx.beginPath();
  ctx.ellipse(-3, -4, 6, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnakeWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed } = game;
  const maze = game.snake;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const floor = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  floor.addColorStop(0, "#2a2118");
  floor.addColorStop(0.5, "#33281c");
  floor.addColorStop(1, "#211a13");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  for (let leaf = 0; leaf < 70; leaf += 1) {
    const x = ((leaf * 173 + 31) % (WORLD_WIDTH + 40)) - 20;
    const y = ((leaf * 97 + 13) % (WORLD_HEIGHT + 40)) - 20;
    drawLeaf(ctx, x, y, 12 + (leaf % 4) * 4, leaf * 0.9, leaf % 3 === 0 ? "rgba(70,90,40,.35)" : leaf % 3 === 1 ? "rgba(110,80,40,.3)" : "rgba(50,70,35,.3)");
  }

  const gridWidth = SNAKE_COLS * SNAKE_CELL_W;
  const gridHeight = SNAKE_LANES * SNAKE_CELL_H;
  const path = ctx.createLinearGradient(0, SNAKE_GRID_Y, 0, SNAKE_GRID_Y + gridHeight);
  path.addColorStop(0, "#4a3927");
  path.addColorStop(1, "#3d2f21");
  ctx.fillStyle = path;
  roundedRect(ctx, SNAKE_GRID_X - 8, SNAKE_GRID_Y - 10, gridWidth + 16, gridHeight + 20, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,230,180,.08)";
  ctx.lineWidth = 1;
  for (let col = 1; col < SNAKE_COLS; col += 1) {
    const x = SNAKE_GRID_X + col * SNAKE_CELL_W;
    ctx.beginPath();
    ctx.setLineDash([4, 8]);
    ctx.moveTo(x, SNAKE_GRID_Y);
    ctx.lineTo(x, SNAKE_GRID_Y + gridHeight);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,230,180,.26)";
  ctx.font = "900 9px Arial";
  ctx.textAlign = "center";
  for (let col = 0; col < SNAKE_COLS; col += 1) {
    if (col % 5 !== 4 && col !== 0) continue;
    ctx.fillText(String(col + 1), SNAKE_GRID_X + col * SNAKE_CELL_W + SNAKE_CELL_W / 2, SNAKE_GRID_Y + gridHeight + 16);
  }
  for (let pebble = 0; pebble < 40; pebble += 1) {
    ctx.fillStyle = pebble % 2 ? "rgba(120,100,80,.35)" : "rgba(90,75,60,.4)";
    ctx.beginPath();
    ctx.ellipse(SNAKE_GRID_X + ((pebble * 211) % gridWidth), SNAKE_GRID_Y + ((pebble * 131) % gridHeight), 4 + (pebble % 3), 2.5, pebble, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawBank = (left: number, width: number) => {
    ctx.fillStyle = "#1d1711";
    roundedRect(ctx, left - 4, SNAKE_GRID_Y - 24, width + 8, gridHeight + 48, 12);
    ctx.fill();
    const stone = ctx.createLinearGradient(left, 0, left + width, 0);
    stone.addColorStop(0, "#77705f");
    stone.addColorStop(0.5, "#8d8571");
    stone.addColorStop(1, "#6e6758");
    ctx.fillStyle = stone;
    roundedRect(ctx, left, SNAKE_GRID_Y - 20, width, gridHeight + 40, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,25,18,.4)";
    ctx.lineWidth = 2;
    for (let line = 0; line < 14; line += 1) {
      const y = SNAKE_GRID_Y - 10 + line * 40;
      ctx.beginPath();
      ctx.moveTo(left + 6, y + 26);
      ctx.lineTo(left + width - 6, y - 4);
      ctx.stroke();
    }
    for (let tuft = 0; tuft < 9; tuft += 1) {
      drawLeaf(ctx, left + 8 + ((tuft * 37) % (width - 16)), SNAKE_GRID_Y - 12 + tuft * 60, 16, tuft * 1.3 + Math.sin(elapsed + tuft) * 0.05, tuft % 2 ? "#4f8a3f" : "#6ea34a");
    }
  };
  drawBank(0, SNAKE_GRID_X - 6);
  drawBank(SNAKE_GRID_X + gridWidth + 6, WORLD_WIDTH - SNAKE_GRID_X - gridWidth - 6);

  ctx.fillStyle = "#e1a644";
  roundedRect(ctx, 1108, 20, 78, 22, 5);
  ctx.fill();
  ctx.strokeStyle = "#8d5529";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "800 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TRAIL →", 1147, 35);

  const biter = maze.lost ? maze.biterBand : null;
  maze.bands.forEach((band) => {
    if (band.kind === "root") drawSnakeBand(ctx, band, elapsed, false, false);
  });
  const awakeNow = maze.awake || maze.lost;
  maze.bands.forEach((band) => {
    if (band.kind === "snake") drawSnakeBand(ctx, band, elapsed, awakeNow, biter === band.id);
  });

  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  const companionSpot = cellCenter(-1, 4);
  drawTopDownCharacter(ctx, companionSpot.x, companionSpot.y + 30, companion, "forward", elapsed, 0, false);

  const position = playerPosition(maze);
  const hop = maze.motion && maze.motion.hop ? maze.motion.t : 0;
  if (maze.lost) {
    ctx.fillStyle = "#ff5a45";
    ctx.font = "900 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BITTEN!", position.x, position.y - 44);
  }
  drawTopDownCharacter(ctx, position.x, position.y, activeCharacter, maze.facing, elapsed, hop, maze.motion !== null && !maze.motion.hop);

  if (maze.awake && !maze.lost) {
    const fraction = Math.max(0, maze.biteTimer / SNAKE_BITE_DELAY);
    ctx.fillStyle = "rgba(68,24,18,.9)";
    roundedRect(ctx, position.x - 44, position.y - 64, 88, 16, 6);
    ctx.fill();
    ctx.fillStyle = "#ff765f";
    roundedRect(ctx, position.x - 40, position.y - 60, Math.max(3, 80 * fraction), 8, 4);
    ctx.fill();
  }
  if (!maze.awake && !maze.lost && !maze.motion && maze.col >= 0 && maze.col < SNAKE_COLS) {
    const band = bandAt(maze, maze.col, maze.lane);
    if (band) {
      ctx.strokeStyle = "rgba(180,236,109,.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.ellipse(position.x, position.y + 4, 24, 17, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.fillStyle = "rgba(20,44,30,.86)";
  roundedRect(ctx, 18, 12, 170, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#fff2cf";
  ctx.font = "900 12px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`ROW ${Math.min(SNAKE_COLS, Math.max(0, maze.col + 1))} / ${SNAKE_COLS}`, 32, 35);
  ctx.fillStyle = "rgba(255,242,207,.7)";
  ctx.font = "900 9px Arial";
  ctx.fillText(`PEEKS ${maze.reveals}`, 128, 35);

  ctx.fillStyle = "rgba(20,44,30,.86)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 330, 12, 330, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#fff2cf";
  ctx.font = "900 11px Arial";
  ctx.textAlign = "left";
  ctx.fillText("←→ hop a row · ↑↓ walk the root · snakes bite in a blink", WORLD_WIDTH - 18 - 316, 35);

  if (maze.awake && !maze.lost) {
    const pulse = (Math.sin(elapsed * 14) + 1) / 2;
    ctx.fillStyle = `rgba(150,30,22,${0.75 + pulse * 0.2})`;
    roundedRect(ctx, 470, 10, 260, 38, 10);
    ctx.fill();
    ctx.strokeStyle = "#ffb08a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SNAKES AWAKE — HOP OFF!", 600, 35);
  } else if (game.noticeTimer > 0 && game.notice) {
    const fade = Math.min(1, game.noticeTimer / 0.4);
    ctx.fillStyle = `rgba(20,44,30,${0.82 * fade})`;
    roundedRect(ctx, 470, 10, 260, 38, 10);
    ctx.fill();
    ctx.fillStyle = `rgba(255,242,207,${fade})`;
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(game.notice, 600, 34);
  }

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

const pigPalettes = [
  { body: "#e9a9b4", belly: "#f6cdd3", dark: "#c77f8d", snout: "#d98594", hoof: "#7a4a4f" },
  { body: "#e7bda0", belly: "#f4dcc8", dark: "#c2916f", snout: "#d69f82", hoof: "#6f4d3a" },
  { body: "#d98f9c", belly: "#efbcc4", dark: "#b06976", snout: "#c9737f", hoof: "#6b3f45" },
] as const;

function drawPig(
  ctx: CanvasRenderingContext2D,
  pig: Pig,
  elapsed: number,
) {
  const palette = pigPalettes[Math.floor(pig.tint * pigPalettes.length) % pigPalettes.length];
  const chasing = pig.state === "chase";
  const chewing = pig.state === "chew";
  const trot = Math.sin(pig.trotPhase);
  const bob = Math.abs(Math.sin(pig.trotPhase)) * (chasing ? 2.6 : 1.4);
  const chomp = pig.chompTimer > 0 ? Math.min(1, pig.chompTimer / 0.3) : chewing ? (Math.sin(elapsed * 18) + 1) * 0.35 : 0;
  ctx.save();
  ctx.translate(pig.x, PIG_FLOOR_Y);
  ctx.scale(pig.facing * pig.size, pig.size);

  ctx.fillStyle = "rgba(25,40,18,.24)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 26, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);
  ctx.lineCap = "round";

  // Legs
  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = 4.4;
  const stride = chewing ? 0 : chasing ? 8 : 5;
  const legs = [
    { x: -13, swing: trot },
    { x: -6, swing: -trot },
    { x: 8, swing: -trot },
    { x: 15, swing: trot },
  ];
  legs.forEach((leg) => {
    const reach = stride * leg.swing;
    ctx.beginPath();
    ctx.moveTo(leg.x, -14);
    ctx.lineTo(leg.x + reach, -1);
    ctx.stroke();
  });
  ctx.fillStyle = palette.hoof;
  legs.forEach((leg) => {
    const reach = stride * leg.swing;
    ctx.beginPath();
    ctx.ellipse(leg.x + reach, 0, 2.4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Curly tail
  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-22, -22);
  ctx.quadraticCurveTo(-30, -26, -27, -31);
  ctx.quadraticCurveTo(-24, -35, -29, -37);
  ctx.stroke();

  // Body
  const body = ctx.createLinearGradient(0, -34, 0, -6);
  body.addColorStop(0, palette.body);
  body.addColorStop(1, palette.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-2, -20, 22, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.belly;
  ctx.beginPath();
  ctx.ellipse(-2, -15, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head (dips toward the ground while chewing a splinter)
  ctx.save();
  if (chewing) ctx.translate(2, 4);
  ctx.fillStyle = palette.body;
  ctx.beginPath();
  ctx.ellipse(18, -22, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = palette.dark;
  ctx.beginPath();
  ctx.moveTo(12, -33);
  ctx.lineTo(18, -30);
  ctx.lineTo(10, -27);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, -33);
  ctx.lineTo(27, -29);
  ctx.lineTo(19, -28);
  ctx.closePath();
  ctx.fill();

  // Snout
  ctx.fillStyle = palette.snout;
  ctx.beginPath();
  ctx.ellipse(30, -20 + chomp * 1.5, 6.5, 5 + chomp * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a3238";
  ctx.beginPath();
  ctx.arc(29, -20.5, 1.3, 0, Math.PI * 2);
  ctx.arc(32.5, -20.5, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Mouth / tusks while biting or chewing
  if (chomp > 0) {
    ctx.strokeStyle = "#4a2a2e";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(24, -14 + chomp * 2);
    ctx.lineTo(31, -13 + chomp * 3);
    ctx.stroke();
    ctx.fillStyle = "#fdf3e2";
    ctx.beginPath();
    ctx.moveTo(25, -14);
    ctx.lineTo(27, -14);
    ctx.lineTo(25.5, -10 - chomp * 2);
    ctx.closePath();
    ctx.fill();
  }
  if (chewing) {
    // The splinter of stilt it just bit off
    ctx.strokeStyle = "#a9793f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, -12 + chomp);
    ctx.lineTo(36, -16 + chomp);
    ctx.stroke();
  }

  // Eye
  ctx.fillStyle = "#26181a";
  ctx.beginPath();
  ctx.arc(19, -25, chasing ? 2.2 : 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.arc(19.7, -25.7, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawStiltWalker(
  ctx: CanvasRenderingContext2D,
  x: number,
  tipY: number,
  length: number,
  character: Character,
  facing: number,
  elapsed: number,
  motion: CharacterMotion,
  speed: number,
  bitten: number,
  snapped = 0,
) {
  const feetY = tipY - length;
  const moving = Math.abs(speed) > 24 && motion === "idle";
  const stepL = moving ? Math.max(0, Math.sin(elapsed * 11)) * 6 : 0;
  const stepR = moving ? Math.max(0, Math.sin(elapsed * 11 + Math.PI)) * 6 : 0;
  const lean = moving ? Math.max(-0.12, Math.min(0.12, (speed / 260) * 0.12)) : 0;
  const splintered = bitten > 0;

  // Ground shadow under the stilt tips
  ctx.save();
  ctx.fillStyle = "rgba(25,32,20,.26)";
  ctx.beginPath();
  ctx.ellipse(x, tipY + 2, 20, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, 0);
  ctx.rotate(lean);

  const poles = [
    { dx: -8, tip: tipY - stepL, side: -1 },
    { dx: 8, tip: tipY - stepR, side: 1 },
  ];
  poles.forEach((pole) => {
    ctx.save();
    if (snapped > 0) {
      // Snapped stilts splay outward from the ground as the walker drops
      ctx.translate(pole.dx, pole.tip);
      ctx.rotate(pole.side * snapped * 1.05);
      ctx.translate(-pole.dx, -pole.tip);
    }
    const top = feetY - 34;
    // Wooden pole, from the hand-grip down to the tip
    ctx.strokeStyle = "#a9793f";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pole.dx, top);
    ctx.lineTo(pole.dx, pole.tip - (splintered ? 3 : 0));
    ctx.stroke();
    ctx.strokeStyle = "#7c5326";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pole.dx + 1.6, top + 4);
    ctx.lineTo(pole.dx + 1.6, pole.tip - 4);
    ctx.stroke();
    // Foot-rest peg the boot stands on
    ctx.strokeStyle = "#6a4622";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(pole.dx, feetY + 1);
    ctx.lineTo(pole.dx + pole.side * 8, feetY + 4);
    ctx.stroke();
    // Bite notches climb the pole from the tip, one per chunk chewed away
    const notches = Math.min(8, bitten);
    for (let n = 0; n < notches; n += 1) {
      const ny = pole.tip - 8 - n * 9;
      if (ny < feetY + 10) break;
      ctx.fillStyle = n % 2 ? "#4f3216" : "#5e3b1a";
      ctx.beginPath();
      ctx.moveTo(pole.dx - 4, ny);
      ctx.lineTo(pole.dx + (n % 2 ? 5 : -5), ny - 3);
      ctx.lineTo(pole.dx + 4, ny + 3);
      ctx.closePath();
      ctx.fill();
    }
    if (splintered) {
      // Jagged, chewed end
      ctx.fillStyle = "#c9944f";
      ctx.beginPath();
      ctx.moveTo(pole.dx - 3.2, pole.tip - 6);
      ctx.lineTo(pole.dx - 1, pole.tip + 1);
      ctx.lineTo(pole.dx + 0.5, pole.tip - 4);
      ctx.lineTo(pole.dx + 2, pole.tip + 2);
      ctx.lineTo(pole.dx + 3.2, pole.tip - 6);
      ctx.closePath();
      ctx.fill();
    } else {
      // Fresh rubber tip
      ctx.fillStyle = "#5f3f1f";
      ctx.beginPath();
      ctx.ellipse(pole.dx, pole.tip, 3.4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  ctx.restore();

  const bodyFeetY = snapped > 0 ? feetY + (PIG_FLOOR_Y - 4 - feetY) * Math.min(1, snapped * 1.15) : feetY;
  drawCharacter(ctx, x, bodyFeetY, character, facing, elapsed, motion, speed, 1);
}

function drawPigBoulder(ctx: CanvasRenderingContext2D, boulder: Boulder) {
  const top = boulderTop(boulder);
  const cx = boulder.x + boulder.width / 2;
  ctx.save();
  ctx.fillStyle = "rgba(25,32,20,.28)";
  ctx.beginPath();
  ctx.ellipse(cx, PIG_FLOOR_Y + 3, boulder.width * 0.75, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const rock = ctx.createLinearGradient(0, top, 0, PIG_FLOOR_Y);
  rock.addColorStop(0, "#9aa0a4");
  rock.addColorStop(0.5, "#767c82");
  rock.addColorStop(1, "#4d5157");
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(boulder.x - 6, PIG_FLOOR_Y + 4);
  ctx.quadraticCurveTo(boulder.x - 14, top + 16, boulder.x + boulder.width * 0.28, top + 2);
  ctx.quadraticCurveTo(cx, top - 8, boulder.x + boulder.width * 0.74, top + 3);
  ctx.quadraticCurveTo(boulder.x + boulder.width + 14, top + 18, boulder.x + boulder.width + 6, PIG_FLOOR_Y + 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.beginPath();
  ctx.ellipse(cx - boulder.width * 0.16, top + 20, boulder.width * 0.24, 12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(35,38,42,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 6, top + 10);
  ctx.lineTo(cx + 2, top + 30);
  ctx.lineTo(cx - 8, PIG_FLOOR_Y - 6);
  ctx.stroke();
  // A little moss on top
  ctx.fillStyle = "#6f8a3f";
  ctx.beginPath();
  ctx.ellipse(cx + 6, top + 4, boulder.width * 0.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPigHud(ctx: CanvasRenderingContext2D, game: GameState) {
  const field = game.pig;
  const climbable = canClimbOut(field);

  ctx.fillStyle = "rgba(38,30,18,.84)";
  roundedRect(ctx, 18, 18, 250, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.72)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("STILT LEGS", 34, 38);
  ctx.textAlign = "right";
  ctx.fillStyle = climbable ? "rgba(255,242,207,.55)" : "#ff6b52";
  ctx.fillText(climbable ? "TALLER THAN THE WALL" : "TOO SHORT TO CLIMB", 250, 38);

  const barX = 34;
  const barW = 216;
  const fill = Math.max(0, Math.min(1, field.stilt / PIG_STILT_FULL));
  const wallAt = PIG_CLIMB_LENGTH / PIG_STILT_FULL;
  const snapAt = PIG_STILT_SNAP / PIG_STILT_FULL;
  ctx.fillStyle = "rgba(255,245,215,.18)";
  roundedRect(ctx, barX, 48, barW, 12, 6);
  ctx.fill();
  // Below the wall line the legs are too short; below the snap line they splinter
  ctx.fillStyle = "rgba(255,120,90,.22)";
  roundedRect(ctx, barX, 48, barW * wallAt, 12, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,60,40,.3)";
  roundedRect(ctx, barX, 48, barW * snapAt, 12, 6);
  ctx.fill();
  const low = field.stilt <= PIG_LOW_STILT;
  ctx.fillStyle = !climbable ? "#ff5a45" : low ? "#ff9b4a" : "#b4ec6d";
  roundedRect(ctx, barX, 48, Math.max(3, barW * fill), 12, 6);
  ctx.fill();
  // One tick per bite-sized chunk of wood
  for (let chunk = 1; chunk * PIG_BITE_CHUNK < PIG_STILT_FULL; chunk += 1) {
    ctx.fillStyle = "rgba(38,30,18,.55)";
    ctx.fillRect(barX + (barW * chunk * PIG_BITE_CHUNK) / PIG_STILT_FULL, 48, 1, 12);
  }
  // The valley-wall marker
  const wallX = barX + barW * wallAt;
  ctx.fillStyle = "#fff2cf";
  ctx.fillRect(wallX - 1, 44, 2, 20);
  ctx.font = "900 8px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,242,207,.8)";
  ctx.fillText("WALL", wallX, 74);

  ctx.fillStyle = "rgba(38,30,18,.84)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 250, 18, 250, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.3)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.72)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("CROSS THE VALLEY", WORLD_WIDTH - 18 - 234, 38);
  const span = PIG_FINISH_X - PIG_PLAYER_START_X;
  const progress = Math.max(0, Math.min(1, (field.furthest - PIG_PLAYER_START_X) / span));
  ctx.fillStyle = "rgba(255,245,215,.18)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 234, 48, 216, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#e4b34b";
  roundedRect(ctx, WORLD_WIDTH - 18 - 234, 48, Math.max(3, 216 * progress), 12, 6);
  ctx.fill();
  ctx.font = "900 8px Arial";
  ctx.fillStyle = "rgba(255,242,207,.6)";
  ctx.fillText(`${field.bites} BITE${field.bites === 1 ? "" : "S"}`, WORLD_WIDTH - 18 - 234, 74);

  if ((game.noticeTimer > 0 && game.notice) || field.biteFlash > 0) {
    const flash = field.biteFlash > 0 && (!game.notice || game.noticeTimer <= 0);
    const text = flash ? "CHOMP! — a bite off the stilts" : game.notice;
    const fade = flash ? Math.min(1, field.biteFlash / 0.4) : Math.min(1, game.noticeTimer / 0.4);
    ctx.fillStyle = `rgba(120,30,22,${0.8 * fade})`;
    roundedRect(ctx, 400, 92, 400, 36, 10);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,176,138,${fade})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(255,242,207,${fade})`;
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 600, 115);
  }
}

function drawPigWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  const field = game.pig;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#bfe0f0");
  sky.addColorStop(0.4, "#dcecdd");
  sky.addColorStop(0.72, "#e9e2b8");
  sky.addColorStop(1, "#cbb787");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sun = ctx.createRadialGradient(880, 118, 16, 880, 118, 200);
  sun.addColorStop(0, "rgba(255,250,220,.95)");
  sun.addColorStop(0.2, "rgba(255,240,180,.5)");
  sun.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(660, 0, 440, 340);
  ctx.fillStyle = "#fff6da";
  ctx.beginPath();
  ctx.arc(880, 118, 36, 0, Math.PI * 2);
  ctx.fill();

  for (let cloud = 0; cloud < 4; cloud += 1) {
    const cx = ((cloud * 337 + elapsed * 8) % (WORLD_WIDTH + 260)) - 130;
    const cy = 64 + cloud * 30;
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (const [dx, dy, r] of [[0, 0, 22], [24, 6, 18], [-24, 6, 17], [8, -8, 16]] as const) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Distant hills beyond the far rim of the valley
  const drawHills = (baseY: number, color: string, offset: number, height: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-30, WORLD_HEIGHT);
    ctx.lineTo(-30, baseY);
    for (let x = -30; x <= WORLD_WIDTH + 90; x += 110) {
      const crest = baseY - 30 - Math.abs(Math.sin((x + offset) * 0.006)) * height;
      ctx.quadraticCurveTo(x + 55, crest, x + 110, baseY - 12);
    }
    ctx.lineTo(WORLD_WIDTH + 90, WORLD_HEIGHT);
    ctx.closePath();
    ctx.fill();
  };
  drawHills(286, "#8fb2a0", 40, 120);
  drawHills(330, "#6f9a7f", 220, 96);
  drawHills(372, "#54805f", 120, 74);

  // The far side of the valley: a grassy rim level with the ledges, then the
  // slope dropping to the floor where the pigs run
  const rimY = PIG_LEDGE_Y - 16;
  const slope = ctx.createLinearGradient(0, rimY, 0, PIG_FLOOR_Y);
  slope.addColorStop(0, "#9bc253");
  slope.addColorStop(0.16, "#7d9b45");
  slope.addColorStop(0.4, "#8f7a45");
  slope.addColorStop(0.8, "#6d5533");
  slope.addColorStop(1, "#5c4a2c");
  ctx.fillStyle = slope;
  ctx.beginPath();
  ctx.moveTo(-10, rimY + 6);
  for (let x = -10; x <= WORLD_WIDTH + 40; x += 60) {
    ctx.quadraticCurveTo(x + 30, rimY - 4 + ((x / 60) % 2) * 6, x + 60, rimY + 6);
  }
  ctx.lineTo(WORLD_WIDTH + 40, WORLD_HEIGHT);
  ctx.lineTo(-10, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();
  // Earth strata and a few embedded stones on the slope
  for (let band = 0; band < 5; band += 1) {
    const y = rimY + 42 + band * 22;
    ctx.strokeStyle = band % 2 ? "rgba(60,42,22,.18)" : "rgba(255,230,170,.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    for (let x = 0; x <= WORLD_WIDTH; x += 80) {
      ctx.quadraticCurveTo(x + 40, y + Math.sin(x * 0.03 + band) * 5, x + 80, y);
    }
    ctx.stroke();
  }
  for (let s = 0; s < 14; s += 1) {
    const sx = ((s * 241 + 60) % (WORLD_WIDTH - 80)) + 40;
    const sy = rimY + 50 + ((s * 37) % 60);
    ctx.fillStyle = "rgba(120,118,110,.55)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 6 + (s % 3) * 2, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Valley floor
  const grass = ctx.createLinearGradient(0, PIG_FLOOR_Y - 20, 0, PIG_FLOOR_Y + 10);
  grass.addColorStop(0, "#8fb64c");
  grass.addColorStop(1, "#5c8a37");
  ctx.fillStyle = grass;
  ctx.fillRect(0, PIG_FLOOR_Y - 8, WORLD_WIDTH, 20);
  const dirt = ctx.createLinearGradient(0, PIG_FLOOR_Y + 10, 0, WORLD_HEIGHT);
  dirt.addColorStop(0, "#7c6a3b");
  dirt.addColorStop(1, "#4f3d24");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, PIG_FLOOR_Y + 12, WORLD_WIDTH, WORLD_HEIGHT - PIG_FLOOR_Y - 12);
  for (let x = 6; x < WORLD_WIDTH; x += 15) {
    const h = 6 + ((x * 7) % 9);
    const sway = Math.sin(elapsed * 1.2 + x) * 1.6;
    ctx.strokeStyle = x % 3 ? "#6f9a3c" : "#88b048";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, PIG_FLOOR_Y - 2);
    ctx.lineTo(x + sway, PIG_FLOOR_Y - 2 - h);
    ctx.stroke();
  }
  // Scattered mud patches, pebbles and hoof-churned earth
  for (let p = 0; p < 40; p += 1) {
    const px = ((p * 173 + 40) % (WORLD_WIDTH - 40)) + 20;
    const py = PIG_FLOOR_Y + 14 + ((p * 53) % 46);
    ctx.fillStyle = p % 3 ? "rgba(70,52,30,.5)" : "rgba(95,72,40,.5)";
    ctx.beginPath();
    ctx.ellipse(px, py, 6 + (p % 4) * 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pigs run behind the boulders, around the rocks
  field.pigs.forEach((pig) => drawPig(ctx, pig, elapsed));

  // Boulders
  field.boulders.forEach((boulder) => drawPigBoulder(ctx, boulder));

  // The high ground: a plateau at each end with a sheer cliff into the valley
  const drawPlateau = (left: number, right: number, side: -1 | 1) => {
    const width = right - left;
    const edge = side < 0 ? right : left;
    // Cliff body
    ctx.fillStyle = "#3a2b1c";
    roundedRect(ctx, left - 10, PIG_LEDGE_Y - 6, width + 20, WORLD_HEIGHT - PIG_LEDGE_Y + 20, 14);
    ctx.fill();
    const earth = ctx.createLinearGradient(0, PIG_LEDGE_Y, 0, WORLD_HEIGHT);
    earth.addColorStop(0, "#8f6d45");
    earth.addColorStop(0.35, "#6a4e34");
    earth.addColorStop(0.75, "#4a3625");
    earth.addColorStop(1, "#33261c");
    ctx.fillStyle = earth;
    roundedRect(ctx, left - 6, PIG_LEDGE_Y - 2, width + 12, WORLD_HEIGHT - PIG_LEDGE_Y + 20, 12);
    ctx.fill();
    // Rock strata in the cliff face
    for (let band = 0; band < 6; band += 1) {
      const y = PIG_LEDGE_Y + 22 + band * 20;
      ctx.strokeStyle = band % 2 ? "rgba(20,14,8,.35)" : "rgba(255,220,160,.12)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(edge, y + (band % 3));
      ctx.lineTo(edge - side * (28 + band * 9), y - 2 + ((band * 7) % 5));
      ctx.stroke();
    }
    // A few stones set into the face
    for (let s = 0; s < 4; s += 1) {
      ctx.fillStyle = "rgba(140,135,125,.7)";
      ctx.beginPath();
      ctx.ellipse(edge - side * (10 + s * 11), PIG_LEDGE_Y + 34 + s * 26, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dangling roots
    ctx.strokeStyle = "#5b4128";
    ctx.lineWidth = 2;
    for (let r = 0; r < 3; r += 1) {
      const rx = edge - side * (2 + r * 6);
      ctx.beginPath();
      ctx.moveTo(rx, PIG_LEDGE_Y + 10);
      ctx.quadraticCurveTo(rx + side * (4 + r * 3) + Math.sin(elapsed * 1.5 + r) * 2, PIG_LEDGE_Y + 40 + r * 8, rx + side * 2, PIG_LEDGE_Y + 60 + r * 12);
      ctx.stroke();
    }
    // Grassy cap with a slight overhang lip
    const cap = ctx.createLinearGradient(0, PIG_LEDGE_Y - 16, 0, PIG_LEDGE_Y + 8);
    cap.addColorStop(0, "#a3ca55");
    cap.addColorStop(1, "#5c8a37");
    ctx.fillStyle = cap;
    roundedRect(ctx, left - 8, PIG_LEDGE_Y - 12, width + 16 + 4, 22, 10);
    ctx.fill();
    ctx.fillStyle = "#5c8a37";
    ctx.beginPath();
    ctx.moveTo(edge, PIG_LEDGE_Y - 4);
    ctx.lineTo(edge - side * 12, PIG_LEDGE_Y - 4);
    ctx.lineTo(edge - side * 2, PIG_LEDGE_Y + 14);
    ctx.closePath();
    ctx.fill();
    for (let x = left + 6; x < right - 6; x += 16) {
      drawLeaf(ctx, x, PIG_LEDGE_Y - 8, 13 + (x % 4), -1.4 + Math.sin(elapsed * 0.8 + x) * 0.05, x % 3 ? "#6f9a44" : "#9bb14a");
    }
    // Shadow the cliff throws onto the floor
    ctx.fillStyle = "rgba(30,22,14,.28)";
    ctx.beginPath();
    ctx.moveTo(edge, PIG_FLOOR_Y - 8);
    ctx.lineTo(edge - side * 34, PIG_FLOOR_Y - 8);
    ctx.lineTo(edge - side * 44, PIG_FLOOR_Y + 30);
    ctx.lineTo(edge, PIG_FLOOR_Y + 30);
    ctx.closePath();
    ctx.fill();
  };
  drawPlateau(-20, PIG_SAFE_LEFT, -1);
  drawPlateau(PIG_SAFE_RIGHT, WORLD_WIDTH + 20, 1);

  // Trail sign on the far plateau
  ctx.fillStyle = "#593b22";
  roundedRect(ctx, 1132, PIG_LEDGE_Y - 82, 14, 82, 4);
  ctx.fill();
  ctx.fillStyle = "#e1a644";
  roundedRect(ctx, 1088, PIG_LEDGE_Y - 106, 112, 50, 7);
  ctx.fill();
  ctx.strokeStyle = "#8d5529";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3a281c";
  ctx.font = "800 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TRAIL →", 1144, PIG_LEDGE_Y - 76);

  // Companion cheering from the start plateau
  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  const inValley = player.x > PIG_SAFE_LEFT && player.x < PIG_SAFE_RIGHT;
  drawCharacter(ctx, 60, PIG_LEDGE_Y, companion, 1, elapsed, inValley ? "wave" : "idle", 0, 0.9);
  if (inValley && !field.lost && !field.won) {
    const bubbleY = PIG_LEDGE_Y - 150 + Math.sin(elapsed * 2.8) * 2;
    const line = !canClimbOut(field) ? "OH NO!" : field.stilt <= PIG_LOW_STILT ? "HURRY!" : "BE QUICK!";
    ctx.fillStyle = "rgba(247,232,186,.92)";
    roundedRect(ctx, 14, bubbleY, 132, 32, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, bubbleY + 30);
    ctx.lineTo(54, bubbleY + 41);
    ctx.lineTo(62, bubbleY + 30);
    ctx.fill();
    ctx.fillStyle = "#7a3320";
    ctx.font = "800 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(line, 80, bubbleY + 20);
  }

  // The stilt-walking explorer
  const bitten = chunksBitten(field);
  if (field.lost) {
    // Stilts gave way — the walker drops among the pigs
    drawStiltWalker(
      ctx,
      player.x,
      Math.min(PIG_FLOOR_Y, player.y),
      field.stilt,
      activeCharacter,
      player.facing,
      elapsed,
      field.fallProgress > 0.4 ? "fall" : "idle",
      0,
      bitten,
      field.fallProgress,
    );
    ctx.fillStyle = "#ff5a45";
    ctx.font = "900 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CAUGHT!", player.x, PIG_FLOOR_Y - 150);
  } else {
    let drawX = player.x;
    let drawTipY = player.y;
    let motion: CharacterMotion = !player.onGround ? (player.vy < 0 ? "jump" : "fall") : "idle";
    if (field.climbTimer > 0 && field.climbFrom) {
      // Scrambling up the cliff onto the high ground
      const t = 1 - field.climbTimer / PIG_CLIMB_TIME;
      const eased = 1 - (1 - t) * (1 - t);
      drawX = field.climbFrom.x + (player.x - field.climbFrom.x) * t;
      drawTipY = field.climbFrom.y + (player.y - field.climbFrom.y) * eased;
      motion = "jump";
    }
    if (field.bumpTimer > 0) drawX += Math.sin(elapsed * 46) * 2.5 * Math.min(1, field.bumpTimer / 0.9);
    drawStiltWalker(
      ctx,
      drawX,
      drawTipY,
      field.stilt,
      activeCharacter,
      player.facing,
      elapsed,
      motion,
      player.vx,
      bitten,
    );
    const headY = drawTipY - field.stilt - 100;
    // Keep the warning clear of the cliffs and the trail sign
    const labelX = Math.max(120, Math.min(drawX, PIG_SAFE_RIGHT - 90));
    if (field.bumpTimer > 0) {
      ctx.fillStyle = "#ff5a45";
      ctx.font = "900 15px Arial";
      ctx.textAlign = "center";
      ctx.fillText("TOO SHORT!", labelX, headY - 6);
    } else if (!canClimbOut(field) && !field.won) {
      const pulse = (Math.sin(elapsed * 12) + 1) / 2;
      ctx.fillStyle = `rgba(255,90,69,${0.6 + pulse * 0.35})`;
      ctx.font = "900 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("STILTS TOO SHORT!", labelX, headY);
    } else if (field.stilt <= PIG_LOW_STILT && !field.won) {
      const pulse = (Math.sin(elapsed * 10) + 1) / 2;
      ctx.fillStyle = `rgba(255,155,74,${0.6 + pulse * 0.35})`;
      ctx.font = "900 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("STILTS GETTING SHORT!", labelX, headY);
    }
  }

  drawPigHud(ctx, game);

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function drawRiverLog(
  ctx: CanvasRenderingContext2D,
  log: RiverLog,
  elapsed: number,
  ridden: boolean,
) {
  const angle = logAxisAngle(log);
  const half = log.length / 2;
  const r = log.radius;
  const bobLift = Math.sin(log.bob) * 1.6;

  ctx.save();
  ctx.translate(log.x, log.y + bobLift);

  // Wake / shadow on the water beneath the log
  ctx.fillStyle = "rgba(6,42,52,.28)";
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(3, 5, half + 6, r + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.rotate(angle);

  // The barrel of the log, shaded across its thickness for a round read
  const barrel = ctx.createLinearGradient(0, -r, 0, r);
  barrel.addColorStop(0, ridden ? "#c99a5f" : "#b98a52");
  barrel.addColorStop(0.5, ridden ? "#a06f3c" : "#8f6234");
  barrel.addColorStop(1, "#5f3d20");
  ctx.fillStyle = barrel;
  roundedRect(ctx, -half, -r, log.length, r * 2, r);
  ctx.fill();
  // A lighter highlight band along the top of the barrel
  ctx.fillStyle = "rgba(255,236,196,.28)";
  roundedRect(ctx, -half + 4, -r + 2, log.length - 8, r * 0.7, r * 0.35);
  ctx.fill();
  // Bark grooves running the length
  ctx.strokeStyle = "rgba(74,48,26,.5)";
  ctx.lineWidth = 1.4;
  for (const gy of [-r * 0.45, 0, r * 0.5]) {
    ctx.beginPath();
    ctx.moveTo(-half + 6, gy);
    ctx.lineTo(half - 6, gy);
    ctx.stroke();
  }

  // The end grain at both ends, with a spinning mark that reads as roll
  const phase = ridden ? log.spin * elapsed * 1.4 : log.bob * 0.2;
  for (const end of [-1, 1] as const) {
    ctx.save();
    ctx.translate(end * half, 0);
    const grain = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
    grain.addColorStop(0, "#e0b878");
    grain.addColorStop(0.6, "#c39a5c");
    grain.addColorStop(1, "#7a5027");
    ctx.fillStyle = grain;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.72, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,58,30,.55)";
    ctx.lineWidth = 1;
    for (const rr of [0.34, 0.62, 0.9]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.72 * rr, r * rr, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The rolling mark
    ctx.strokeStyle = "rgba(70,44,22,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(phase) * r * 0.62, Math.sin(phase) * r * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  // Spin speed arcs curling off the leading edge
  if (ridden && Math.abs(log.spin) > 0.4) {
    const dir = Math.sign(log.spin);
    const arcs = Math.min(3, Math.floor(Math.abs(log.spin)));
    ctx.strokeStyle = "rgba(226,246,255,.7)";
    ctx.lineWidth = 2;
    for (let i = 0; i < arcs; i += 1) {
      const rad = r + 5 + i * 5;
      ctx.beginPath();
      ctx.arc(half - 4, 0, rad * 0.5, -0.7 * dir, 0.7 * dir, dir < 0);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawPiranha(
  ctx: CanvasRenderingContext2D,
  p: Piranha,
  player: Player,
) {
  const face = player.x >= p.x ? 1 : -1;
  const gnash = p.chomp > 0 ? Math.min(1, p.chomp / 0.28) : Math.max(0, Math.sin(p.phase * 2)) * 0.2;
  const wag = Math.sin(p.phase * 3) * 3;

  ctx.save();
  ctx.translate(p.x, p.y);
  // Menacing shadow of the shoal under the surface
  ctx.fillStyle = "rgba(4,30,34,.3)";
  ctx.beginPath();
  ctx.ellipse(0, 3, 16 * p.size, 6 * p.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(face * p.size, p.size);

  // Forked tail, wagging
  ctx.fillStyle = "#37564f";
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-21, -8 + wag);
  ctx.lineTo(-15, 0);
  ctx.lineTo(-21, 8 + wag);
  ctx.closePath();
  ctx.fill();

  // Spiny dorsal and pelvic fins
  ctx.fillStyle = "#2c4842";
  ctx.beginPath();
  ctx.moveTo(-4, -6);
  ctx.lineTo(2, -12);
  ctx.lineTo(5, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, 6);
  ctx.lineTo(2, 11);
  ctx.lineTo(6, 6);
  ctx.closePath();
  ctx.fill();

  // Body — dark steel back, deep-red belly
  const body = ctx.createLinearGradient(0, -8, 0, 8);
  body.addColorStop(0, "#42615a");
  body.addColorStop(0.55, "#3a544d");
  body.addColorStop(0.75, "#7a2f28");
  body.addColorStop(1, "#a83a2c");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // A cold sheen along the back
  ctx.fillStyle = "rgba(190,225,220,.18)";
  ctx.beginPath();
  ctx.ellipse(-1, -3.5, 9, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // The blunt snout and gaping, toothy jaw
  ctx.fillStyle = "#3a544d";
  ctx.beginPath();
  ctx.moveTo(8, -6.5);
  ctx.quadraticCurveTo(18, -5, 17, -1 - gnash * 3);
  ctx.lineTo(17, 1 + gnash * 3);
  ctx.quadraticCurveTo(18, 5, 8, 6.5);
  ctx.closePath();
  ctx.fill();
  // Mouth interior
  ctx.fillStyle = "#2a1113";
  ctx.beginPath();
  ctx.moveTo(9, -1.5 - gnash * 2.5);
  ctx.lineTo(17.5, -1 - gnash * 3.4);
  ctx.lineTo(17.5, 1 + gnash * 3.4);
  ctx.lineTo(9, 1.5 + gnash * 2.5);
  ctx.closePath();
  ctx.fill();
  // Big interlocking teeth, top and bottom rows
  ctx.fillStyle = "#fdf6e6";
  const topJaw = -1.5 - gnash * 2.6;
  const botJaw = 1.5 + gnash * 2.6;
  for (let i = 0; i < 4; i += 1) {
    const tx = 10.5 + i * 1.9;
    ctx.beginPath();
    ctx.moveTo(tx, topJaw);
    ctx.lineTo(tx + 0.9, topJaw + 2.4);
    ctx.lineTo(tx + 1.8, topJaw);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, botJaw);
    ctx.lineTo(tx + 0.9, botJaw - 2.4);
    ctx.lineTo(tx + 1.8, botJaw);
    ctx.closePath();
    ctx.fill();
  }

  // A hard, angry eye with a heavy brow
  ctx.fillStyle = "#ffcf33";
  ctx.beginPath();
  ctx.arc(4, -2.4, 2.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#161010";
  ctx.beginPath();
  ctx.arc(4.7, -2.4, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#20120f";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0.5, -5.4);
  ctx.lineTo(7, -3.2);
  ctx.stroke();

  ctx.restore();
}

function drawRiverHud(ctx: CanvasRenderingContext2D, game: GameState) {
  const river = game.river;
  const player = game.player;
  const log = ridingLog(river);
  const headroom = river.onBank === "start" ? 1 : riverHeadroom(player.y);

  // Left panel: how much room is left before the falls
  ctx.fillStyle = "rgba(10,34,40,.84)";
  roundedRect(ctx, 18, 18, 250, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,236,255,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(214,240,255,.72)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("DISTANCE TO FALLS", 34, 38);
  ctx.textAlign = "right";
  ctx.fillStyle = headroom < 0.32 ? "#ff6b52" : "rgba(214,240,255,.55)";
  ctx.fillText(headroom < 0.32 ? "ALMOST OVER!" : "SAFE", 250, 38);
  ctx.fillStyle = "rgba(200,235,255,.18)";
  roundedRect(ctx, 34, 48, 216, 12, 6);
  ctx.fill();
  ctx.fillStyle = headroom < 0.32 ? "#ff5a45" : headroom < 0.55 ? "#ffb54a" : "#6fe0c0";
  roundedRect(ctx, 34, 48, Math.max(3, 216 * headroom), 12, 6);
  ctx.fill();
  ctx.fillStyle = "#e8f7ff";
  ctx.fillRect(34 + 216 * 0.32 - 1, 44, 2, 20);

  // Centre gauge: the managed spin velocity of the log you are on
  const gaugeX = WORLD_WIDTH / 2 - 118;
  const gaugeW = 236;
  ctx.fillStyle = "rgba(10,34,40,.8)";
  roundedRect(ctx, gaugeX, 18, gaugeW, 52, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,236,255,.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(214,240,255,.7)";
  ctx.font = "900 9px Arial";
  ctx.textAlign = "center";
  ctx.fillText("◀ BACK-SPIN     LOG SPIN     FORWARD ▶", WORLD_WIDTH / 2, 34);
  const trackX = gaugeX + 18;
  const trackW = gaugeW - 36;
  ctx.fillStyle = "rgba(200,235,255,.16)";
  roundedRect(ctx, trackX, 46, trackW, 12, 6);
  ctx.fill();
  const midX = trackX + trackW / 2;
  ctx.fillStyle = "rgba(232,247,255,.5)";
  ctx.fillRect(midX - 1, 42, 2, 20);
  const spin = log ? log.spin : 0;
  const spinFrac = Math.max(-1, Math.min(1, spin / RIVER_SPIN_MAX));
  const spinW = (trackW / 2) * Math.abs(spinFrac);
  ctx.fillStyle = spin >= 0 ? "#59c8ff" : "#ffb54a";
  if (spin >= 0) {
    roundedRect(ctx, midX, 46, Math.max(2, spinW), 12, 6);
  } else {
    roundedRect(ctx, midX - Math.max(2, spinW), 46, Math.max(2, spinW), 12, 6);
  }
  ctx.fill();

  // Right panel: crossing progress
  ctx.fillStyle = "rgba(10,34,40,.84)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 250, 18, 250, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,236,255,.3)";
  ctx.stroke();
  ctx.fillStyle = "rgba(214,240,255,.72)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("CROSS THE RIVER", WORLD_WIDTH - 18 - 234, 38);
  const progress = riverProgress(river);
  ctx.fillStyle = "rgba(200,235,255,.18)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 234, 48, 216, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#7fe6a6";
  roundedRect(ctx, WORLD_WIDTH - 18 - 234, 48, Math.max(3, 216 * progress), 12, 6);
  ctx.fill();
  ctx.font = "900 8px Arial";
  ctx.fillStyle = "rgba(214,240,255,.6)";
  ctx.fillText(`${river.hops} HOP${river.hops === 1 ? "" : "S"}`, WORLD_WIDTH - 18 - 234, 74);

  if ((game.noticeTimer > 0 && game.notice) || river.splashFlash > 0) {
    const flash = river.splashFlash > 0 && (!game.notice || game.noticeTimer <= 0);
    const text = flash ? "SPLASH! — the piranhas are waiting" : game.notice;
    const fade = flash ? Math.min(1, river.splashFlash / 0.6) : Math.min(1, game.noticeTimer / 0.4);
    ctx.fillStyle = `rgba(18,60,72,${0.82 * fade})`;
    roundedRect(ctx, 400, 92, 400, 36, 10);
    ctx.fill();
    ctx.strokeStyle = `rgba(150,220,255,${fade})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(224,244,255,${fade})`;
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 600, 115);
  }
}

function drawRiverWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  const river = game.river;
  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // The river surface, flowing top to bottom
  const water = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  water.addColorStop(0, "#2f8fa3");
  water.addColorStop(0.5, "#237f97");
  water.addColorStop(0.82, "#1c6f89");
  water.addColorStop(1, "#155a75");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Downstream ripple lines scrolling toward the falls
  ctx.lineWidth = 2;
  for (let row = 0; row < 22; row += 1) {
    const y = ((row * 30 + elapsed * RIVER_CURRENT) % (WORLD_HEIGHT + 40)) - 20;
    ctx.strokeStyle = `rgba(214,244,250,${0.05 + (row % 3) * 0.02})`;
    ctx.beginPath();
    for (let x = RIVER_LEFT_BANK - 10; x <= RIVER_RIGHT_BANK + 10; x += 40) {
      const yy = y + Math.sin(x * 0.05 + row + elapsed) * 4;
      if (x === RIVER_LEFT_BANK - 10) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Faster current streaks
  for (let s = 0; s < 26; s += 1) {
    const sx = RIVER_LEFT_BANK + 20 + ((s * 137) % (RIVER_RIGHT_BANK - RIVER_LEFT_BANK - 40));
    const sy = ((s * 91 + elapsed * (RIVER_CURRENT + 30)) % (WORLD_HEIGHT + 60)) - 30;
    ctx.strokeStyle = "rgba(230,248,252,.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.sin(s) * 3, sy + 16);
    ctx.stroke();
  }

  // The source at the top: a foamy rock ledge the logs slide out from under
  const source = ctx.createLinearGradient(0, 0, 0, RIVER_TOP + 8);
  source.addColorStop(0, "#3a6f5a");
  source.addColorStop(1, "rgba(58,111,90,0)");
  ctx.fillStyle = source;
  ctx.fillRect(RIVER_LEFT_BANK, 0, RIVER_RIGHT_BANK - RIVER_LEFT_BANK, RIVER_TOP + 8);
  ctx.fillStyle = "rgba(236,252,255,.5)";
  for (let x = RIVER_LEFT_BANK + 6; x < RIVER_RIGHT_BANK; x += 26) {
    ctx.beginPath();
    ctx.arc(x + Math.sin(x + elapsed) * 3, RIVER_TOP - 2, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // The hungry shoal, prowling and closing in on the explorer
  river.piranhas.forEach((p) => drawPiranha(ctx, p, player));

  // The waterfall lip and the churn beyond it
  ctx.fillStyle = "rgba(232,250,255,.5)";
  for (let x = RIVER_LEFT_BANK; x < RIVER_RIGHT_BANK; x += 22) {
    const foam = Math.sin(x * 0.1 + elapsed * 3) * 3;
    ctx.beginPath();
    ctx.arc(x + 11, RIVER_WATERFALL_Y + foam, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const falls = ctx.createLinearGradient(0, RIVER_WATERFALL_Y, 0, WORLD_HEIGHT);
  falls.addColorStop(0, "#8fd2df");
  falls.addColorStop(0.5, "#c7ecf2");
  falls.addColorStop(1, "#eafaff");
  ctx.fillStyle = falls;
  ctx.fillRect(RIVER_LEFT_BANK, RIVER_WATERFALL_Y + 4, RIVER_RIGHT_BANK - RIVER_LEFT_BANK, WORLD_HEIGHT - RIVER_WATERFALL_Y);
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 2;
  for (let x = RIVER_LEFT_BANK + 8; x < RIVER_RIGHT_BANK; x += 12) {
    const drop = ((x * 3 + elapsed * 220) % 70);
    ctx.beginPath();
    ctx.moveTo(x, RIVER_WATERFALL_Y + 6 + drop * 0.2);
    ctx.lineTo(x, RIVER_WATERFALL_Y + 6 + drop);
    ctx.stroke();
  }
  // Rising mist at the very bottom
  ctx.fillStyle = "rgba(255,255,255,.28)";
  for (let m = 0; m < 16; m += 1) {
    const mx = RIVER_LEFT_BANK + 20 + ((m * 151) % (RIVER_RIGHT_BANK - RIVER_LEFT_BANK - 40));
    const my = WORLD_HEIGHT - 12 - (Math.sin(elapsed * 1.6 + m) + 1) * 9;
    ctx.beginPath();
    ctx.arc(mx, my, 10 + (m % 3) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // The two banks — thick jungle land on each side
  const drawBank = (left: number, right: number, label: string, side: -1 | 1) => {
    const grad = ctx.createLinearGradient(left, 0, right, 0);
    if (side < 0) {
      grad.addColorStop(0, "#3f7a3a");
      grad.addColorStop(0.7, "#4f8f3f");
      grad.addColorStop(1, "#5c9e46");
    } else {
      grad.addColorStop(0, "#5c9e46");
      grad.addColorStop(0.3, "#4f8f3f");
      grad.addColorStop(1, "#3f7a3a");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(left, 0, right - left, WORLD_HEIGHT);
    // A wet, rocky waterline
    const edge = side < 0 ? right : left;
    ctx.fillStyle = "rgba(60,44,28,.5)";
    for (let y = 0; y < WORLD_HEIGHT; y += 20) {
      const jut = Math.sin(y * 0.08 + side) * 4;
      ctx.beginPath();
      ctx.ellipse(edge - side * (3 + jut), y + 10, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(236,252,255,.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= WORLD_HEIGHT; y += 16) {
      const wob = edge - side * (5 + Math.sin(y * 0.12 + elapsed * 2) * 3);
      if (y === 0) ctx.moveTo(wob, y);
      else ctx.lineTo(wob, y);
    }
    ctx.stroke();
    // Scattered ferns and leaves
    for (let l = 0; l < 26; l += 1) {
      const lx = left + 10 + ((l * 61) % Math.max(20, right - left - 20));
      const ly = 20 + ((l * 89) % (WORLD_HEIGHT - 40));
      drawLeaf(ctx, lx, ly, 12 + (l % 4) * 2, (l * 1.3) + Math.sin(elapsed * 0.7 + l) * 0.1, l % 3 ? "#3c6f34" : "#4f9040");
    }
    // Vertical bank label
    ctx.save();
    ctx.translate(side < 0 ? left + (right - left) / 2 : left + (right - left) / 2, WORLD_HEIGHT / 2);
    ctx.fillStyle = "rgba(240,255,236,.28)";
    ctx.font = "900 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  };
  drawBank(0, RIVER_LEFT_BANK, "START", -1);
  drawBank(RIVER_RIGHT_BANK, WORLD_WIDTH, "END", 1);

  // A trail sign marking the goal on the far bank
  ctx.fillStyle = "#6a4a2a";
  roundedRect(ctx, RIVER_RIGHT_BANK + 44, 120, 12, 90, 4);
  ctx.fill();
  ctx.fillStyle = "#caa15a";
  roundedRect(ctx, RIVER_RIGHT_BANK + 12, 96, 108, 44, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,40,20,.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#3a2612";
  ctx.font = "900 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TRAIL →", RIVER_RIGHT_BANK + 66, 123);

  // Water-direction reminder on the right, like the field sketch
  ctx.strokeStyle = "rgba(232,250,255,.5)";
  ctx.fillStyle = "rgba(232,250,255,.6)";
  ctx.lineWidth = 3;
  const arrowX = RIVER_RIGHT_BANK - 40;
  ctx.beginPath();
  ctx.moveTo(arrowX, 210);
  ctx.lineTo(arrowX, 300);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(arrowX - 7, 292);
  ctx.lineTo(arrowX, 306);
  ctx.lineTo(arrowX + 7, 292);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(arrowX, 190);
  ctx.fillStyle = "rgba(232,250,255,.55)";
  ctx.font = "900 9px Arial";
  ctx.textAlign = "center";
  ctx.fillText("FLOW", 0, 0);
  ctx.restore();

  // Free logs first, then the ridden one on top
  const ridingId = river.ridingLogId;
  river.logs.forEach((log) => {
    if (log.id === ridingId) return;
    drawRiverLog(ctx, log, elapsed, false);
  });
  const ridden = ridingLog(river);
  if (ridden) drawRiverLog(ctx, ridden, elapsed, true);

  // The companion cheers from the near bank
  drawTopDownCharacter(ctx, RIVER_START_X - 24, RIVER_START_Y + 150, companion, "forward", elapsed, 0, false);

  // The active explorer — on a log, on the bank, hopping, or gone in the drink
  if (!game.lost) {
    const hopLift = river.hopping ? Math.min(1, river.hopLift / 26) : 0;
    const moving = river.hopping || (ridden !== null && Math.abs(ridden.spin) > 0.3);
    drawTopDownCharacter(ctx, player.x, player.y, activeCharacter, "forward", elapsed, hopLift, moving);
  } else if (river.lossReason === "piranha") {
    // A churn of fins and foam where the explorer went under
    ctx.save();
    ctx.translate(player.x, Math.min(player.y, RIVER_WATERFALL_Y - 20));
    const churn = Math.min(1, (0.6 - river.splashFlash) / 0.6 + 0.2);
    ctx.fillStyle = "rgba(232,250,255,.6)";
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + elapsed * 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 18 * churn, Math.sin(a) * 12 * churn, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(150,40,36,.8)";
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 - elapsed * 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 20);
      ctx.lineTo(Math.cos(a + 0.3) * 24, Math.sin(a + 0.3) * 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else {
    // Tumbling over the falls
    ctx.save();
    ctx.translate(player.x, Math.min(player.y, WORLD_HEIGHT - 24));
    ctx.rotate(elapsed * 6);
    drawTopDownCharacter(ctx, 0, 0, activeCharacter, "forward", elapsed, 0.4, true);
    ctx.restore();
  }

  drawRiverHud(ctx, game);

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function drawAcacia(
  ctx: CanvasRenderingContext2D,
  tree: LionTree,
  elapsed: number,
  index: number,
) {
  const sway = Math.sin(elapsed * 0.9 + index * 1.7) * 2;
  const trunkTop = LION_BRANCH_Y - 70;
  ctx.save();
  ctx.translate(tree.x, LION_GROUND_Y);

  // Shade on the grass beneath the flat crown
  ctx.fillStyle = "rgba(70,50,20,.2)";
  ctx.beginPath();
  ctx.ellipse(12, 4, tree.crown * 0.9, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk: slightly bowed, with bark ridges
  ctx.strokeStyle = "#3b2a1a";
  ctx.lineCap = "round";
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.quadraticCurveTo(-6, (trunkTop - LION_GROUND_Y) * 0.55, 4 + sway * 0.4, trunkTop - LION_GROUND_Y);
  ctx.stroke();
  ctx.strokeStyle = "#6b4a2b";
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,220,160,.16)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-10, (trunkTop - LION_GROUND_Y) * 0.55, 0, trunkTop - LION_GROUND_Y + 8);
  ctx.stroke();
  for (let ridge = 0; ridge < 5; ridge += 1) {
    const ry = -18 - ridge * 22;
    ctx.strokeStyle = "rgba(30,18,8,.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, ry);
    ctx.quadraticCurveTo(-1, ry - 4, 7, ry + 1);
    ctx.stroke();
  }
  // Root flare
  ctx.fillStyle = "#4a3320";
  ctx.beginPath();
  ctx.moveTo(-22, 4);
  ctx.quadraticCurveTo(-8, -14, 0, -10);
  ctx.quadraticCurveTo(8, -14, 22, 4);
  ctx.closePath();
  ctx.fill();

  // The low branch: a thick limb straight through the trunk, both sides
  const by = LION_BRANCH_Y - LION_GROUND_Y;
  ctx.strokeStyle = "#3b2a1a";
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(-tree.span - 8, by + 5);
  ctx.quadraticCurveTo(-tree.span * 0.4, by - 2, 0, by);
  ctx.quadraticCurveTo(tree.span * 0.4, by - 2, tree.span + 8, by + 5);
  ctx.stroke();
  ctx.strokeStyle = "#7a5533";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,225,170,.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-tree.span - 4, by - 1);
  ctx.quadraticCurveTo(-tree.span * 0.4, by - 5, 0, by - 4);
  ctx.quadraticCurveTo(tree.span * 0.4, by - 5, tree.span + 4, by - 1);
  ctx.stroke();
  // Leaf tufts at the tips and a couple of twigs
  for (const side of [-1, 1] as const) {
    const tipX = side * (tree.span + 4);
    ctx.strokeStyle = "#5c4029";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tipX - side * 18, by + 2);
    ctx.lineTo(tipX - side * 6, by - 12);
    ctx.stroke();
    for (let leaf = 0; leaf < 4; leaf += 1) {
      drawLeaf(ctx, tipX - side * (2 + leaf * 5), by - 10 + (leaf % 2) * 8, 12, side * (-0.5 + leaf * 0.5) + sway * 0.02, leaf % 2 ? "#7c9a3a" : "#9db54a");
    }
  }

  // Flat-topped acacia crown: a wide slab of layered leaf clumps
  const crownY = trunkTop - LION_GROUND_Y - 6;
  const layers = [
    { dx: 0, dy: 2, rx: tree.crown, ry: 20, color: "#4f7a2f" },
    { dx: -tree.crown * 0.35, dy: -12, rx: tree.crown * 0.62, ry: 18, color: "#5e8a36" },
    { dx: tree.crown * 0.3, dy: -14, rx: tree.crown * 0.6, ry: 17, color: "#63903a" },
    { dx: -tree.crown * 0.1, dy: -24, rx: tree.crown * 0.5, ry: 15, color: "#79a544" },
    { dx: tree.crown * 0.15, dy: -30, rx: tree.crown * 0.3, ry: 11, color: "#8db64f" },
  ];
  // Forked limbs reaching up into the crown
  ctx.strokeStyle = "#5c4029";
  ctx.lineWidth = 6;
  for (const limb of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(2, trunkTop - LION_GROUND_Y + 6);
    ctx.quadraticCurveTo(limb * 18, crownY + 8, limb * tree.crown * 0.45 + sway, crownY - 6);
    ctx.stroke();
  }
  layers.forEach((layer) => {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.ellipse(layer.dx + sway, crownY + layer.dy, layer.rx, layer.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // Dappled highlights and the dark underside
  ctx.fillStyle = "rgba(20,40,10,.22)";
  ctx.beginPath();
  ctx.ellipse(sway, crownY + 12, tree.crown * 0.92, 9, 0, 0, Math.PI);
  ctx.fill();
  for (let dot = 0; dot < 9; dot += 1) {
    const dx = ((dot * 53 + index * 17) % (tree.crown * 2)) - tree.crown;
    ctx.fillStyle = "rgba(230,255,170,.28)";
    ctx.beginPath();
    ctx.arc(dx * 0.8 + sway, crownY - 12 + ((dot * 31) % 20) - 8, 3 + (dot % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLion(
  ctx: CanvasRenderingContext2D,
  lion: Lion,
  elapsed: number,
  sees: boolean,
  lookUp: boolean,
  drawX = lion.x,
  liftY = 0,
) {
  const chasing = lion.mood === "chase";
  const pouncing = lion.mood === "pounce";
  const moving = Math.abs(lion.vx) > 8 || chasing;
  const stride = lion.stride;
  const gait = moving ? Math.sin(stride) : 0;
  const bob = pouncing
    ? 0
    : moving
      ? Math.abs(Math.sin(stride)) * (chasing ? 4.5 : 1.6)
      : Math.sin(elapsed * 1.8) * 0.7;
  const reach = pouncing ? 26 : chasing ? 22 : 11;
  const roaring = lion.roarFlash > 0;
  const mane = "#9a4d1c";
  const maneDark = "#6e3311";
  const fur = "#d9a353";
  const furDark = "#b9822f";
  const furLight = "#ecc078";

  ctx.save();
  ctx.translate(drawX, LION_GROUND_Y);
  // Ground shadow (stays on the grass even mid-leap)
  ctx.fillStyle = "rgba(60,40,10,.26)";
  ctx.beginPath();
  ctx.ellipse(0, 3, chasing ? 52 : 42, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -liftY);
  ctx.scale(lion.facing, 1);
  ctx.translate(0, -bob);
  if (pouncing) ctx.rotate(-0.18 * (1 - lion.leapT));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Tail: low and lazy on the prowl, straight out when charging, lashing while it waits
  const lash = lion.mood === "wait" ? Math.sin(elapsed * 9) * 10 : 0;
  ctx.strokeStyle = furDark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-34, -32);
  if (chasing || pouncing) {
    ctx.quadraticCurveTo(-58, -34, -74, -30);
  } else {
    ctx.quadraticCurveTo(-52, -26 + lash * 0.3, -56, -12 + lash);
  }
  ctx.stroke();
  ctx.fillStyle = maneDark;
  ctx.beginPath();
  if (chasing || pouncing) ctx.ellipse(-76, -30, 7, 5, 0, 0, Math.PI * 2);
  else ctx.ellipse(-57, -9 + lash, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Far legs
  const leg = (x: number, swing: number, tone: string) => {
    const kneeX = x + swing * 0.5;
    const footX = x + swing;
    ctx.strokeStyle = tone;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x, -26);
    ctx.lineTo(kneeX, -12);
    ctx.lineTo(footX, -1);
    ctx.stroke();
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.ellipse(footX + 2, 0, 6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  leg(-22, reach * -gait, furDark);
  leg(20, reach * gait, furDark);

  // Body
  const body = ctx.createLinearGradient(0, -52, 0, -8);
  body.addColorStop(0, furLight);
  body.addColorStop(0.55, fur);
  body.addColorStop(1, furDark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-2, chasing || pouncing ? -26 : -30, 36, chasing || pouncing ? 14 : 17, chasing || pouncing ? -0.05 : 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,240,200,.35)";
  ctx.beginPath();
  ctx.ellipse(-4, -20, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Near legs
  leg(-14, reach * gait, fur);
  leg(28, reach * -gait, fur);

  // Head, looking up at the branch while it waits, pinned forward on the charge
  ctx.save();
  ctx.translate(30, -40);
  ctx.rotate(lookUp ? -0.42 : chasing || pouncing ? 0.12 : lion.mood === "look" ? Math.sin(elapsed * 1.3) * 0.08 : 0);
  // Mane: a ring of dark tufts behind the face
  for (let tuft = 0; tuft < 12; tuft += 1) {
    const angle = (tuft / 12) * Math.PI * 2 + Math.sin(elapsed * 2 + tuft) * 0.04;
    ctx.fillStyle = tuft % 2 ? maneDark : mane;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 15 - 4, Math.sin(angle) * 15 - 4, 10, 8, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = mane;
  ctx.beginPath();
  ctx.arc(-4, -4, 19, 0, Math.PI * 2);
  ctx.fill();
  // Face
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(6, -2, 15, 13.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = furLight;
  ctx.beginPath();
  ctx.ellipse(14, 4, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = furDark;
  ctx.beginPath();
  ctx.arc(-4, -14, 5, 0, Math.PI * 2);
  ctx.arc(8, -15, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c98a63";
  ctx.beginPath();
  ctx.arc(-4, -14, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Mouth / roar
  if (roaring || pouncing || chasing) {
    const open = pouncing ? 8 : roaring ? 5 + Math.sin(elapsed * 30) * 2 : 3;
    ctx.fillStyle = "#4a1a14";
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(23, 5);
    ctx.lineTo(18, 6 + open);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff7e0";
    ctx.beginPath();
    ctx.moveTo(12, 6);
    ctx.lineTo(14, 6);
    ctx.lineTo(13, 9.5);
    ctx.closePath();
    ctx.moveTo(20, 5.5);
    ctx.lineTo(22, 5.5);
    ctx.lineTo(21, 9);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = "#7a4a26";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(15, 7);
    ctx.quadraticCurveTo(18, 10, 22, 7);
    ctx.stroke();
  }
  // Nose
  ctx.fillStyle = "#4a2a20";
  ctx.beginPath();
  ctx.moveTo(18, 1);
  ctx.lineTo(25, 1);
  ctx.lineTo(21.5, 5);
  ctx.closePath();
  ctx.fill();
  // Eye: narrow and lazy, wide and bright when it sees you
  const wide = sees || chasing || pouncing;
  ctx.fillStyle = "#fff6dc";
  ctx.beginPath();
  ctx.ellipse(8, -5, 4.2, wide ? 3.6 : 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wide ? "#2a1408" : "#3e2414";
  ctx.beginPath();
  ctx.arc(9.4, -5, wide ? 2.2 : 1.6, 0, Math.PI * 2);
  ctx.fill();
  if (wide) {
    ctx.fillStyle = "#ff5a3c";
    ctx.beginPath();
    ctx.arc(9.4, -5, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = maneDark;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(3, -10);
  ctx.quadraticCurveTo(8, wide ? -13 : -10, 13, -9);
  ctx.stroke();
  // Whiskers
  ctx.strokeStyle = "rgba(255,245,220,.6)";
  ctx.lineWidth = 1;
  for (const w of [-2, 0, 2]) {
    ctx.beginPath();
    ctx.moveTo(19, 3 + w);
    ctx.lineTo(30, 1 + w * 2.2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();

  // Alert mark and roar text sit in world space above the head
  if (lion.alertFlash > 0 && (lion.mood === "alert" || lion.mood === "chase")) {
    const pop = Math.min(1, lion.alertFlash / 0.25);
    ctx.fillStyle = "#ff4a3a";
    ctx.font = `900 ${22 + pop * 6}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("!", drawX + lion.facing * 30, LION_GROUND_Y - 84 - liftY);
  }
  if (roaring) {
    const fade = Math.min(1, lion.roarFlash / 0.3);
    ctx.fillStyle = `rgba(255,110,70,${fade})`;
    ctx.font = "900 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ROAR!", drawX + lion.facing * 26, LION_GROUND_Y - 78 - liftY + (1 - fade) * 8);
  }
}

function drawLionGaze(ctx: CanvasRenderingContext2D, lion: Lion, danger: boolean, elapsed: number) {
  if (lion.mood === "pounce") return;
  // A cone of sight from the lion's eyes, laid along the trail
  const eyeY = LION_GROUND_Y - 46;
  const start = lion.x + lion.facing * 48;
  const end = start + lion.facing * LION_SIGHT;
  const pulse = 0.5 + Math.sin(elapsed * (danger ? 14 : 2.4)) * 0.5;
  const strength = danger ? 0.3 + pulse * 0.12 : lion.mood === "wait" ? 0.12 : 0.17 + pulse * 0.04;
  const color = danger ? "255,60,40" : "255,250,215";
  const gaze = ctx.createLinearGradient(start, 0, end, 0);
  gaze.addColorStop(0, `rgba(${color},${strength})`);
  gaze.addColorStop(0.55, `rgba(${color},${strength * 0.5})`);
  gaze.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gaze;
  ctx.beginPath();
  ctx.moveTo(start, eyeY - 6);
  ctx.lineTo(end, eyeY - 62);
  ctx.lineTo(end, LION_GROUND_Y + 12);
  ctx.lineTo(start, eyeY + 10);
  ctx.closePath();
  ctx.fill();
  // A faint centre line so the direction reads at a glance
  ctx.strokeStyle = `rgba(${color},${danger ? 0.55 : 0.28})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(start, eyeY);
  ctx.lineTo(end, eyeY - 8);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGoldenPumpkin(ctx: CanvasRenderingContext2D, x: number, y: number, elapsed: number, glow: number) {
  ctx.save();
  ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, -22, 8, 0, -22, 90 + glow * 60);
  halo.addColorStop(0, `rgba(255,236,150,${0.55 + glow * 0.35})`);
  halo.addColorStop(0.5, `rgba(255,200,80,${0.18 + glow * 0.2})`);
  halo.addColorStop(1, "rgba(255,200,80,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(-160, -180, 320, 220);
  // Rays
  for (let ray = 0; ray < 10; ray += 1) {
    const angle = elapsed * 0.35 + (ray / 10) * Math.PI * 2;
    ctx.strokeStyle = `rgba(255,240,170,${0.16 + glow * 0.3})`;
    ctx.lineWidth = 3 + (ray % 2) * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 30, -22 + Math.sin(angle) * 30);
    ctx.lineTo(Math.cos(angle) * (70 + glow * 50), -22 + Math.sin(angle) * (70 + glow * 50));
    ctx.stroke();
  }
  const float = Math.sin(elapsed * 2.2) * 2.5 - glow * 16;
  ctx.translate(0, float);
  // Stem and leaf
  ctx.strokeStyle = "#5b7a2a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.quadraticCurveTo(4, -50, 10, -52);
  ctx.stroke();
  drawLeaf(ctx, 6, -46, 16, -0.9, "#7fae3e");
  // Ribs
  const gold = ctx.createLinearGradient(-26, -40, 26, 0);
  gold.addColorStop(0, "#ffe27a");
  gold.addColorStop(0.5, "#f0b024");
  gold.addColorStop(1, "#c77d0c");
  for (const rib of [
    { dx: 0, rx: 27, ry: 22 },
    { dx: -13, rx: 17, ry: 21 },
    { dx: 13, rx: 17, ry: 21 },
    { dx: 0, rx: 12, ry: 22 },
  ]) {
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.ellipse(rib.dx, -20, rib.rx, rib.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(140,80,10,.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,230,.55)";
  ctx.beginPath();
  ctx.ellipse(-9, -30, 6, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // Sparkles
  for (let spark = 0; spark < 6; spark += 1) {
    const phase = elapsed * 2.4 + spark * 1.1;
    const size = (Math.sin(phase) + 1) * 2.4 + glow * 3;
    const sx = Math.cos(spark * 1.9 + elapsed * 0.5) * (40 + glow * 30);
    const sy = -24 + Math.sin(spark * 2.3 + elapsed * 0.7) * (30 + glow * 20);
    ctx.fillStyle = "rgba(255,250,210,.9)";
    ctx.beginPath();
    ctx.moveTo(sx, sy - size);
    ctx.lineTo(sx + size * 0.35, sy);
    ctx.lineTo(sx, sy + size);
    ctx.lineTo(sx - size * 0.35, sy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLionHud(ctx: CanvasRenderingContext2D, game: GameState, sees: boolean) {
  const field = game.lion;
  const lion = field.lion;
  const sheltered = isSheltered(field);
  const hanging = field.perch === "hang" || field.perch === "climbing" || field.perch === "lowering";
  const onRocks = field.perch === "ground" && inSafeZone(game.player.x);

  ctx.fillStyle = "rgba(48,30,12,.84)";
  roundedRect(ctx, 18, 18, 330, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.72)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("THE LION", 34, 38);
  const gazeLine =
    field.won
      ? "SLINKING AWAY"
      : lion.mood === "pounce"
      ? "GOT YOU"
      : lion.mood === "chase"
        ? "CHARGING!"
        : lion.mood === "alert"
          ? "SPOTTED YOU!"
          : lion.mood === "wait"
            ? "PACING BELOW YOU"
            : sees
              ? "WATCHING YOU"
              : lion.mood === "leave"
                ? "WANDERING OFF"
                : lion.mood === "look"
                  ? "STOPPED · LOOKING AROUND"
                  : lionFacesPlayer(lion, game.player)
                    ? "FACING YOUR WAY"
                    : "LOOKING AWAY";
  const danger = !field.won && (sees || lion.mood === "chase" || lion.mood === "alert" || lion.mood === "pounce");
  const caution = !field.won && (lion.mood === "wait" || lion.mood === "look" || (!danger && lionFacesPlayer(lion, game.player)));
  ctx.textAlign = "right";
  ctx.fillStyle = danger ? "#ff6b52" : caution ? "#ffc35a" : "#b4ec6d";
  ctx.fillText(gazeLine, 332, 38);
  // Second line: the explorer's own footing, or the lion's patience bar
  if (lion.mood === "wait") {
    const left = patienceLeft(field);
    const fill = Math.max(0, Math.min(1, left / (LION_PATIENCE + LION_PATIENCE_JITTER)));
    ctx.fillStyle = "rgba(255,245,215,.18)";
    roundedRect(ctx, 34, 50, 176, 11, 6);
    ctx.fill();
    ctx.fillStyle = "#ffc35a";
    roundedRect(ctx, 34, 50, Math.max(3, 176 * fill), 11, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,242,207,.8)";
    ctx.font = "900 9px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`LOSING INTEREST IN ${left.toFixed(1)}s`, 218, 59);
  } else {
    ctx.font = "900 9px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = field.won || sheltered ? "#b4ec6d" : hanging ? "#ff6b52" : onRocks ? "#b4ec6d" : "rgba(255,242,207,.7)";
    ctx.fillText(
      field.won
        ? "YOU: THE GOLDEN PUMPKIN IS YOURS!"
        : sheltered
        ? "YOU: SAFE ON THE BRANCH — ↓ then SPACE to get down"
        : hanging
          ? "YOU: HANGING — NOT SAFE! Press ↑ to climb"
          : onRocks
            ? "YOU: SAFE ON THE ROCKS"
            : "YOU: IN THE OPEN — SPACE under a branch, then ↑",
      34,
      60,
    );
  }
  ctx.font = "900 8px Arial";
  ctx.fillStyle = "rgba(255,242,207,.55)";
  ctx.fillText("IT CHARGES WHATEVER IT SEES · ONLY A CLIMBED BRANCH IS SAFE", 34, 75);

  ctx.fillStyle = "rgba(48,30,12,.84)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 250, 18, 250, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,.3)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,242,207,.72)";
  ctx.font = "900 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("TO THE GOLDEN PUMPKIN", WORLD_WIDTH - 18 - 234, 38);
  const progress = lionProgress(field);
  ctx.fillStyle = "rgba(255,245,215,.18)";
  roundedRect(ctx, WORLD_WIDTH - 18 - 234, 48, 216, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#e4b34b";
  roundedRect(ctx, WORLD_WIDTH - 18 - 234, 48, Math.max(3, 216 * progress), 12, 6);
  ctx.fill();
  // Tree markers along the bar
  field.trees.forEach((tree) => {
    const tx = WORLD_WIDTH - 18 - 234 + (216 * (tree.x - LION_PLAYER_START_X)) / (LION_FINISH_X - LION_PLAYER_START_X);
    ctx.fillStyle = "rgba(48,30,12,.7)";
    ctx.fillRect(tx - 1, 47, 2, 14);
  });
  ctx.font = "900 8px Arial";
  ctx.fillStyle = "rgba(255,242,207,.6)";
  ctx.fillText(`${field.climbs} CLIMB${field.climbs === 1 ? "" : "S"} · ${field.escapes} ESCAPE${field.escapes === 1 ? "" : "S"}`, WORLD_WIDTH - 18 - 234, 74);

  if (game.noticeTimer > 0 && game.notice) {
    const fade = Math.min(1, game.noticeTimer / 0.4);
    ctx.fillStyle = `rgba(120,30,22,${0.8 * fade})`;
    roundedRect(ctx, 400, 92, 400, 36, 10);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,176,138,${fade})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(255,242,207,${fade})`;
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(game.notice, 600, 115);
  }
}

function drawLionWorld(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  activeCharacter: Character,
) {
  const { elapsed, player } = game;
  const field = game.lion;
  const lion = field.lion;
  const sees = lionSeesPlayer(field, player);
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // A late-afternoon savanna sky, warming toward the horizon
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#7fb3d8");
  sky.addColorStop(0.35, "#c9d9c8");
  sky.addColorStop(0.62, "#f3d59a");
  sky.addColorStop(0.8, "#e9b56a");
  sky.addColorStop(1, "#b9853d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sunX = 960;
  const sunY = 250;
  const sun = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 260);
  sun.addColorStop(0, "rgba(255,240,190,.95)");
  sun.addColorStop(0.25, "rgba(255,210,130,.45)");
  sun.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - 280, sunY - 280, 560, 560);
  ctx.fillStyle = "#fff1c8";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
  ctx.fill();

  // Thin high clouds and vultures turning slow circles
  for (let cloud = 0; cloud < 3; cloud += 1) {
    const cx = ((cloud * 431 + elapsed * 6) % (WORLD_WIDTH + 300)) - 150;
    const cy = 70 + cloud * 26;
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 30, cy - 4, 40, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let bird = 0; bird < 3; bird += 1) {
    const angle = elapsed * 0.32 + bird * 2.1;
    const bx = 560 + Math.cos(angle) * (90 + bird * 30);
    const by = 120 + Math.sin(angle) * 22 + bird * 14;
    const flap = Math.sin(elapsed * 2.4 + bird) * 3;
    ctx.strokeStyle = "rgba(60,40,30,.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by + flap);
    ctx.quadraticCurveTo(bx - 4, by - 4, bx, by);
    ctx.quadraticCurveTo(bx + 4, by - 4, bx + 12, by + flap);
    ctx.stroke();
  }

  // Distant hills and a far ridge line
  const drawHills = (baseY: number, color: string, offset: number, height: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-30, WORLD_HEIGHT);
    ctx.lineTo(-30, baseY);
    for (let x = -30; x <= WORLD_WIDTH + 90; x += 140) {
      const crest = baseY - 20 - Math.abs(Math.sin((x + offset) * 0.005)) * height;
      ctx.quadraticCurveTo(x + 70, crest, x + 140, baseY - 8);
    }
    ctx.lineTo(WORLD_WIDTH + 90, WORLD_HEIGHT);
    ctx.closePath();
    ctx.fill();
  };
  drawHills(392, "#b39a8a", 80, 90);
  drawHills(420, "#a48e6c", 300, 60);
  // Silhouette acacias on the far plain
  for (let far = 0; far < 9; far += 1) {
    const fx = ((far * 149 + 60) % (WORLD_WIDTH + 60)) - 30;
    const fy = 432 - (far % 3) * 6;
    ctx.fillStyle = "rgba(110,90,60,.55)";
    ctx.fillRect(fx - 1.5, fy - 18, 3, 18);
    ctx.beginPath();
    ctx.ellipse(fx, fy - 20, 16 + (far % 3) * 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The plain: dry golden grass to the horizon, warmer and taller near the trail
  const plain = ctx.createLinearGradient(0, 428, 0, LION_GROUND_Y);
  plain.addColorStop(0, "#d8c37a");
  plain.addColorStop(0.5, "#cdb15f");
  plain.addColorStop(1, "#b99a48");
  ctx.fillStyle = plain;
  ctx.fillRect(0, 428, WORLD_WIDTH, LION_GROUND_Y - 428);
  for (let x = 0; x < WORLD_WIDTH; x += 9) {
    const depth = (x * 7) % 5;
    const gy = 446 + ((x * 13) % 90);
    const h = 8 + depth * 3;
    ctx.strokeStyle = depth % 2 ? "rgba(160,130,60,.45)" : "rgba(200,170,90,.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + Math.sin(elapsed * 1.1 + x * 0.3) * 2, gy - h);
    ctx.stroke();
  }

  // Trees stand in front of the plain, behind the lion
  field.trees.forEach((tree, index) => drawAcacia(ctx, tree, elapsed, index));

  // Ground line: a strip of tall grass at the trail, packed earth below
  const grass = ctx.createLinearGradient(0, LION_GROUND_Y - 16, 0, LION_GROUND_Y + 8);
  grass.addColorStop(0, "#c8a94f");
  grass.addColorStop(1, "#8f7a34");
  ctx.fillStyle = grass;
  ctx.fillRect(0, LION_GROUND_Y - 6, WORLD_WIDTH, 16);
  const earth = ctx.createLinearGradient(0, LION_GROUND_Y + 8, 0, WORLD_HEIGHT);
  earth.addColorStop(0, "#a5763d");
  earth.addColorStop(1, "#6b4a26");
  ctx.fillStyle = earth;
  ctx.fillRect(0, LION_GROUND_Y + 8, WORLD_WIDTH, WORLD_HEIGHT - LION_GROUND_Y - 8);
  for (let x = 4; x < WORLD_WIDTH; x += 11) {
    const h = 10 + ((x * 7) % 12);
    const sway = Math.sin(elapsed * 1.4 + x * 0.2) * 2.2;
    ctx.strokeStyle = x % 3 ? "#d3b458" : "#b8963c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, LION_GROUND_Y + 2);
    ctx.quadraticCurveTo(x + sway * 0.4, LION_GROUND_Y - h * 0.6, x + sway, LION_GROUND_Y - h);
    ctx.stroke();
  }
  for (let p = 0; p < 30; p += 1) {
    const px = ((p * 191 + 40) % (WORLD_WIDTH - 40)) + 20;
    const py = LION_GROUND_Y + 18 + ((p * 47) % 40);
    ctx.fillStyle = p % 3 ? "rgba(90,60,30,.4)" : "rgba(140,100,50,.4)";
    ctx.beginPath();
    ctx.ellipse(px, py, 5 + (p % 4) * 2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The lion's line of sight, laid along the trail before it
  if (!field.won) drawLionGaze(ctx, lion, sees || lion.mood === "alert" || lion.mood === "chase", elapsed);

  // Trail-head rocks on the left: the safe start
  const drawRock = (x: number, y: number, w: number, h: number, tone: string) => {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w / 2, y - h, x - w * 0.15, y - h);
    ctx.quadraticCurveTo(x + w * 0.3, y - h * 1.08, x + w / 2, y - h * 0.5);
    ctx.quadraticCurveTo(x + w / 2 + 4, y, x, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,240,200,.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h * 0.9);
    ctx.lineTo(x + w * 0.1, y - h * 0.95);
    ctx.stroke();
  };
  drawRock(40, LION_GROUND_Y + 6, 120, 60, "#8b7b66");
  drawRock(110, LION_GROUND_Y + 6, 110, 44, "#9c8a72");
  drawRock(150, LION_GROUND_Y + 4, 60, 26, "#7f7060");
  drawRock(20, LION_GROUND_Y - 40, 70, 40, "#a3917a");
  ctx.fillStyle = "rgba(60,45,30,.35)";
  ctx.fillRect(0, LION_GROUND_Y + 4, LION_SAFE_LEFT + 10, 6);

  // The pumpkin shrine on the right: stone steps and the prize
  const shrineX = 1132;
  ctx.fillStyle = "#8a7660";
  roundedRect(ctx, LION_SAFE_RIGHT + 10, LION_GROUND_Y - 14, 130, 30, 6);
  ctx.fill();
  ctx.fillStyle = "#a08b70";
  roundedRect(ctx, LION_SAFE_RIGHT + 30, LION_GROUND_Y - 30, 100, 24, 6);
  ctx.fill();
  ctx.fillStyle = "#b39d80";
  roundedRect(ctx, shrineX - 30, LION_GROUND_Y - 44, 60, 22, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,235,190,.25)";
  ctx.fillRect(LION_SAFE_RIGHT + 30, LION_GROUND_Y - 30, 100, 3);
  ctx.fillRect(shrineX - 30, LION_GROUND_Y - 44, 60, 3);
  for (let v = 0; v < 5; v += 1) {
    drawLeaf(ctx, LION_SAFE_RIGHT + 16 + v * 26, LION_GROUND_Y - 12, 12, -0.9 + (v % 2) * 0.5, v % 2 ? "#6f9a44" : "#8fae4c");
  }
  drawGoldenPumpkin(ctx, shrineX, LION_GROUND_Y - 44, elapsed, field.celebrate);

  // Companion cheering from the rocks
  const companion: Character = activeCharacter === "guto" ? "nanda" : "guto";
  const inTheOpen = !inSafeZone(player.x) && !field.won;
  if (!field.won) {
    drawCharacter(ctx, 46, LION_GROUND_Y - 40, companion, 1, elapsed, inTheOpen ? "wave" : "idle", 0, 0.88);
    if (inTheOpen && !field.lost) {
      const bubbleY = LION_GROUND_Y - 190 + Math.sin(elapsed * 2.8) * 2;
      const line = sees || lion.mood === "chase" ? "RUN!" : lion.mood === "wait" ? "HOLD ON!" : isSheltered(field) ? "WAIT…" : "CLIMB!";
      ctx.fillStyle = "rgba(247,232,186,.92)";
      roundedRect(ctx, 6, bubbleY, 110, 30, 12);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(40, bubbleY + 28);
      ctx.lineTo(48, bubbleY + 39);
      ctx.lineTo(56, bubbleY + 28);
      ctx.fill();
      ctx.fillStyle = "#7a3320";
      ctx.font = "800 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(line, 61, bubbleY + 19);
    }
  }

  // The lion, mid-pounce on a lost course
  const lookUp = lion.mood === "wait";
  if (field.lost) {
    const t = lion.leapT;
    const arc = Math.sin(Math.min(1, t) * Math.PI) * (field.lossReason === "hanging" ? 70 : 34);
    const lx = lion.x + (player.x - lion.x) * Math.min(1, t * 1.2);
    drawLion(ctx, lion, elapsed, true, false, lx, arc);
  } else {
    drawLion(ctx, lion, elapsed, sees, lookUp);
  }

  // The explorer
  if (field.lost) {
    const down = Math.min(1, lion.leapT * 1.4);
    ctx.save();
    ctx.translate(player.x, LION_GROUND_Y);
    ctx.rotate(-player.facing * 1.35 * down);
    drawCharacter(ctx, 0, 0, activeCharacter, player.facing, elapsed, "fall", 0, 1);
    ctx.restore();
    ctx.fillStyle = "#ff5a45";
    ctx.font = "900 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CAUGHT!", Math.max(90, Math.min(player.x, WORLD_WIDTH - 90)), LION_GROUND_Y - 140);
  } else if (field.won) {
    // Both explorers at the shrine, and the pumpkin lifting into the light
    const c = field.celebrate;
    const hop = Math.abs(Math.sin(elapsed * 6)) * 10 * c;
    drawCharacter(ctx, shrineX - 56, LION_GROUND_Y - 14 - hop, activeCharacter, 1, elapsed, "wave", 0, 1);
    const arrived = c > 0.7;
    const runIn = Math.min(1, c / 0.7);
    const companionX = 720 + (shrineX - 104 - 720) * runIn;
    drawCharacter(ctx, companionX, LION_GROUND_Y - hop * 0.8, companion, 1, elapsed, arrived ? "wave" : "run", 220, 1);
    // Confetti
    for (let bit = 0; bit < 60; bit += 1) {
      const life = (elapsed * 0.35 + bit * 0.137) % 1;
      const bx = ((bit * 197) % WORLD_WIDTH) + Math.sin(elapsed * 2 + bit) * 18;
      const by = life * WORLD_HEIGHT;
      ctx.fillStyle = ["#ffd34d", "#ff7a59", "#7ad0ff", "#b4ec6d", "#ffffff"][bit % 5];
      ctx.globalAlpha = c * (1 - life * 0.5);
      ctx.fillRect(bx, by, 6, 10);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,244,200,.95)";
    ctx.font = "900 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("THE GOLDEN PUMPKIN!", 600, 200 - c * 10);
    ctx.font = "900 13px Arial";
    ctx.fillStyle = "rgba(255,244,200,.8)";
    ctx.fillText("EIGHT GUARDIANS PASSED · THE EXPEDITION IS COMPLETE", 600, 226 - c * 10);
  } else {
    let motion: CharacterMotion = "idle";
    let drawY = player.y;
    if (field.perch === "hang" || field.perch === "lowering") motion = "hang";
    else if (field.perch === "climbing") motion = "climb";
    else if (field.perch === "perched") motion = Math.abs(player.vx) > 24 ? "run" : "idle";
    else if (!player.onGround) motion = player.vy < 0 ? "jump" : "fall";
    else if (Math.abs(player.vx) > 24) motion = "run";
    if (field.perch === "climbing") drawY = player.y;
    drawCharacter(ctx, player.x, drawY, activeCharacter, player.facing, elapsed, motion, player.vx, 1, 1);
    // Hands wrap the branch while hanging
    if (field.perch === "hang" || field.perch === "lowering" || field.perch === "climbing") {
      ctx.fillStyle = "#d48a55";
      ctx.beginPath();
      ctx.arc(player.x - 4, LION_BRANCH_Y - 3, 4.6, 0, Math.PI * 2);
      ctx.arc(player.x + 5, LION_BRANCH_Y - 3, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const labelX = Math.max(120, Math.min(player.x, WORLD_WIDTH - 120));
    const badge = (text: string, y: number, color: string, alpha: number) => {
      ctx.font = "900 12px Arial";
      ctx.textAlign = "center";
      const width = ctx.measureText(text).width + 18;
      ctx.fillStyle = `rgba(40,26,12,${0.72 * alpha})`;
      roundedRect(ctx, labelX - width / 2, y - 13, width, 19, 9);
      ctx.fill();
      ctx.fillStyle = color.replace("ALPHA", alpha.toFixed(2));
      ctx.fillText(text, labelX, y + 1);
    };
    if (isSheltered(field)) {
      const pulse = (Math.sin(elapsed * 4) + 1) / 2;
      badge("SAFE", LION_BRANCH_Y - 108, "rgba(180,236,109,ALPHA)", 0.75 + pulse * 0.25);
    } else if (field.perch === "hang" || field.perch === "climbing" || field.perch === "lowering") {
      const pulse = (Math.sin(elapsed * 12) + 1) / 2;
      badge(field.perch === "lowering" ? "GETTING DOWN…" : "↑ CLIMB!", LION_GROUND_Y - 24, "rgba(255,150,120,ALPHA)", 0.7 + pulse * 0.3);
    } else if (sees && !inSafeZone(player.x)) {
      const pulse = (Math.sin(elapsed * 12) + 1) / 2;
      badge("IT SEES YOU!", player.y - 104, "rgba(255,130,100,ALPHA)", 0.7 + pulse * 0.3);
    }
  }

  drawLionHud(ctx, game, sees);

  if (!game.running && !game.won && !game.lost) {
    ctx.fillStyle = "rgba(5,29,27,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(makeGame(1));
  const keysRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const [overlay, setOverlay] = useState<Overlay>("briefing");
  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<Character>("guto");
  const [activeCourse, setActiveCourse] = useState<CourseNumber>(1);
  const [soundOn, setSoundOn] = useState(true);
  const [courseStatus, setCourseStatus] = useState("Jump first, then hold Z");
  const [eagleLoss, setEagleLoss] = useState<EagleLossReason | null>(null);
  const [hippoLoss, setHippoLoss] = useState<HippoLossReason | null>(null);
  const [snakeLoss, setSnakeLoss] = useState<SnakeLossReason | null>(null);
  const [pigLoss, setPigLoss] = useState<PigLossReason | null>(null);
  const [riverLoss, setRiverLoss] = useState<RiverLossReason | null>(null);
  const [lionLoss, setLionLoss] = useState<LionLossReason | null>(null);
  const snakeSeedRef = useRef(0);

  useEffect(() => {
    soundEnabledRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const debugWindow = window as Window & { __goldenPumpkinDebug?: { getGame: () => GameState } };
    debugWindow.__goldenPumpkinDebug = { getGame: () => gameRef.current };
    return () => {
      delete debugWindow.__goldenPumpkinDebug;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = showTitleScreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showTitleScreen]);

  const playTone = useCallback(
    (frequency: number, duration = 0.09, type: OscillatorType = "sine") => {
      if (!soundEnabledRef.current) return;
      try {
        const audio =
          audioRef.current ??
          new window.AudioContext({ latencyHint: "interactive" });
        audioRef.current = audio;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.07, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audio.currentTime + duration,
        );
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + duration);
      } catch {
        // Audio is an optional enhancement; gameplay remains fully functional.
      }
    },
    [],
  );

  const resetGame = useCallback(() => {
    if (!snakeSeedRef.current) snakeSeedRef.current = Math.floor(Math.random() * 1e6) + 1;
    const fresh = makeGame(activeCourse, snakeSeedRef.current);
    fresh.running = true;
    gameRef.current = fresh;
    setEagleLoss(null);
    setHippoLoss(null);
    setSnakeLoss(null);
    setPigLoss(null);
    setRiverLoss(null);
    setLionLoss(null);
    setCourseStatus(
      byCourse(
        activeCourse,
        "Jump first, then hold Z",
        "Reach the far side — stomp monkeys to stun them",
        "Grab a rodent with SPACE, then cross the clearing",
        "Walk to the edge — SPACE hops, hold Z + SPACE leaps",
        "Hop forward with → — roots are safe, snakes are not",
        "Run across on the stilts — hold Z + SPACE to vault boulders",
        "Press SPACE to hop onto a log, then ←→ to spin it across",
        "Watch the lion — run when it looks away, SPACE under a branch, then ↑ to climb",
      ),
    );
  }, [activeCourse]);

  const beginCourse = useCallback(() => {
    if (!hasStarted) {
      resetGame();
      setHasStarted(true);
    } else {
      gameRef.current.running = true;
    }
    setOverlay(null);
    playTone(523, 0.09, "triangle");
    window.setTimeout(() => canvasRef.current?.focus(), 0);
  }, [hasStarted, playTone, resetGame]);

  const restartCourse = useCallback(() => {
    resetGame();
    setOverlay(null);
    setHasStarted(true);
    playTone(392, 0.08, "triangle");
    window.setTimeout(() => canvasRef.current?.focus(), 0);
  }, [playTone, resetGame]);

  const openBriefing = useCallback(() => {
    gameRef.current.running = false;
    setOverlay("briefing");
  }, []);

  const selectCourse = useCallback((course: CourseNumber) => {
    keysRef.current.clear();
    setActiveCourse(course);
    setHasStarted(false);
    setOverlay("briefing");
    snakeSeedRef.current = Math.floor(Math.random() * 1e6) + 1;
    gameRef.current = makeGame(course, snakeSeedRef.current);
    setEagleLoss(null);
    setHippoLoss(null);
    setSnakeLoss(null);
    setPigLoss(null);
    setRiverLoss(null);
    setLionLoss(null);
    setCourseStatus(
      byCourse(
        course,
        "Jump first, then hold Z",
        "Reach the far side — stomp monkeys to stun them",
        "Grab a rodent with SPACE, then cross the clearing",
        "Walk to the edge — SPACE hops, hold Z + SPACE leaps",
        "Hop forward with → — roots are safe, snakes are not",
        "Run across on the stilts — hold Z + SPACE to vault boulders",
        "Press SPACE to hop onto a log, then ←→ to spin it across",
        "Watch the lion — run when it looks away, SPACE under a branch, then ↑ to climb",
      ),
    );
    window.setTimeout(() => {
      document.querySelector("#game")?.scrollIntoView({ behavior: "smooth" });
      canvasRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WORLD_WIDTH * dpr;
    canvas.height = WORLD_HEIGHT * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animationFrame = 0;
    let statusTimer = 0;

    const update = (time: number) => {
      const game = gameRef.current;
      const now = time / 1000;
      const dt = game.lastTime
        ? Math.min(now - game.lastTime, 0.035)
        : 1 / 60;
      game.lastTime = now;

      if (game.running) {
        game.elapsed += dt;
        const player = game.player;
        const keys = keysRef.current;
        const left = keys.has("ArrowLeft") || keys.has("KeyA");
        const right = keys.has("ArrowRight") || keys.has("KeyD");
        const up = keys.has("ArrowUp") || keys.has("KeyW");
        const down = keys.has("ArrowDown") || keys.has("KeyS");
        const running = keys.has("KeyX");
        const grabbing = keys.has("KeyZ");
        const move = (right ? 1 : 0) - (left ? 1 : 0);
        player.grabCooldown = Math.max(0, player.grabCooldown - dt);
        player.pushRecovery = Math.max(0, player.pushRecovery - dt);

        if (game.course === 1) {
        if (player.attachedVine !== null) {
          const attachedVine = vines[player.attachedVine];
          const point = gripPoint(attachedVine, game.elapsed, player.vineRatio);

          if (!grabbing) {
            player.attachedVine = null;
            player.climbMotion = 0;
            player.canGrab = false;
            player.vx = point.vx;
            player.vy = Math.max(point.vy, 65);
            player.grabCooldown = 0.22;
            player.onGround = false;
            setCourseStatus("Z released — falling!");
          } else {
            const climb = (down ? 1 : 0) - (up ? 1 : 0);
            player.climbMotion +=
              (climb - player.climbMotion) * Math.min(1, dt * 12);
            player.vineRatio = Math.max(
              0.12,
              Math.min(0.98, player.vineRatio + climb * 0.42 * dt),
            );
            const climbingPoint = gripPoint(
              attachedVine,
              game.elapsed,
              player.vineRatio,
            );
            player.x = climbingPoint.x;
            player.y = climbingPoint.y + 74;
            player.vx = climbingPoint.vx;
            player.vy = climbingPoint.vy;
            player.facing = climbingPoint.vx >= 0 ? 1 : -1;
          }
        } else {
          player.climbMotion *= Math.pow(0.01, dt);
          const speed = running ? 310 : 205;
          if (player.onGround) {
            player.vx += (move * speed - player.vx) * Math.min(1, dt * 13);
            if (!move) player.vx *= Math.pow(0.02, dt);
          } else if (move) {
            player.vx += move * 760 * dt;
            player.vx = Math.max(-430, Math.min(430, player.vx));
          }
          if (move) player.facing = move;

          player.vy += 1110 * dt;
          player.x += player.vx * dt;
          player.y += player.vy * dt;
          player.x = Math.max(22, Math.min(WORLD_WIDTH - 22, player.x));

          const aboveBank = player.x < WATER_LEFT || player.x > WATER_RIGHT;
          if (aboveBank && player.y >= GROUND_Y) {
            if (!player.onGround) player.canGrab = false;
            player.y = GROUND_Y;
            player.vy = 0;
            player.onGround = true;
          } else {
            player.onGround = false;
          }

          if (grabbing && player.canGrab && player.grabCooldown <= 0) {
            const playerHandsY = player.y - 72;
            const closest = vines
              .map((vine, index) => ({
                index,
                ...nearestGrip(vine, game.elapsed, player.x, playerHandsY),
              }))
              .sort((a, b) => a.distance - b.distance)[0];
            if (closest && closest.distance < 68) {
              player.attachedVine = closest.index;
              player.vineRatio = closest.ratio;
              player.canGrab = false;
              player.grabCooldown = 0.48;
              player.onGround = false;
              setCourseStatus(
                `Holding vine ${closest.index + 1} — keep Z down · ↑↓ to climb`,
              );
              playTone(620, 0.08, "triangle");
            }
          }
        }

        const inWater =
          player.x > WATER_LEFT &&
          player.x < WATER_RIGHT &&
          player.y > 470 &&
          player.attachedVine === null;
        if (inWater || player.y > WORLD_HEIGHT + 80) {
          game.running = false;
          game.lost = true;
          setOverlay("gameover");
          playTone(120, 0.35, "sawtooth");
        }

        if (player.x > 1110 && player.onGround && !game.won) {
          game.running = false;
          game.won = true;
          setOverlay("won");
          setCourseStatus("Course clear!");
          playTone(784, 0.16, "triangle");
          window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
        }

        statusTimer += dt;
        if (statusTimer > 0.5 && player.attachedVine === null && !game.won) {
          statusTimer = 0;
          setCourseStatus(
            player.x > 950
              ? "The far bank is close!"
              : player.canGrab
                ? "Airborne — steer with arrows and hold Z"
                : player.onGround
                  ? "Jump first, then hold Z"
                  : "No grab after a drop — land and jump again",
          );
        }
        } else if (game.course === 2) {
          const previousX = player.x;
          const previousY = player.y;
          const previousPlatform = player.onPlatform;
          const speed = running ? 320 : 220;

          if (player.onGround) {
            player.vx += (move * speed - player.vx) * Math.min(1, dt * 14);
            if (!move) player.vx *= Math.pow(0.018, dt);
          } else if (move) {
            player.vx += move * 820 * dt;
            player.vx = Math.max(-430, Math.min(430, player.vx));
          }
          if (move) player.facing = move;

          player.vy += 1180 * dt;
          player.x += player.vx * dt;
          player.y += player.vy * dt;
          player.x = Math.max(22, Math.min(WORLD_WIDTH - 22, player.x));

          monkeyBarriers.forEach((barrier) => {
            if (player.y <= barrier.top) return;
            const leftEdge = barrier.x - 15;
            const rightEdge = barrier.x + barrier.width + 15;
            const crossedFromLeft =
              previousX <= leftEdge && player.x > leftEdge;
            const crossedFromRight =
              previousX >= rightEdge && player.x < rightEdge;
            if (crossedFromLeft) {
              player.x = leftEdge;
              player.vx = Math.min(0, player.vx * -0.2);
            } else if (crossedFromRight) {
              player.x = rightEdge;
              player.vx = Math.max(0, player.vx * -0.2);
            } else if (player.x > leftEdge && player.x < rightEdge) {
              const barrierCenter = barrier.x + barrier.width / 2;
              player.x = player.x < barrierCenter ? leftEdge : rightEdge;
              player.vx = 0;
            }
          });
          player.onGround = false;
          player.onPlatform = null;

          let stompedMonkey = false;
          let pushedByMonkey = false;
          game.monkeys.forEach((monkey) => {
            const platform = monkeyPlatforms[monkey.platformIndex];
            monkey.dizzyTimer = Math.max(0, monkey.dizzyTimer - dt);
            monkey.pushCooldown = Math.max(0, monkey.pushCooldown - dt);
            monkey.jumpCooldown = Math.max(0, monkey.jumpCooldown - dt);

            const playerPlatform =
              previousPlatform !== null && previousPlatform >= 0
                ? monkeyPlatforms[previousPlatform]
                : null;
            const targetPlatform =
              monkey.targetPlatformIndex !== null
                ? monkeyPlatforms[monkey.targetPlatformIndex]
                : null;

            if (targetPlatform) {
              const landingX = Math.max(
                targetPlatform.x + 24,
                Math.min(targetPlatform.x + targetPlatform.width - 24, player.x),
              );
              const direction = Math.sign(landingX - monkey.x || monkey.vx || 1);
              monkey.vx += (direction * 168 - monkey.vx) * Math.min(1, dt * 7);
              monkey.x += monkey.vx * dt;
              monkey.vy += 1260 * dt;
              monkey.y += monkey.vy * dt;

              if (monkey.vy > 0 && monkey.y >= targetPlatform.y) {
                monkey.y = targetPlatform.y;
                monkey.platformIndex = monkey.targetPlatformIndex!;
                monkey.targetPlatformIndex = null;
                monkey.vy = 0;
                monkey.vx = direction * 82;
                monkey.jumpCooldown = 0.48;
              }
            } else if (monkey.dizzyTimer > 0) {
              monkey.vx *= Math.pow(0.015, dt);
            } else {
              const shouldChangeLayer =
                playerPlatform !== null &&
                playerPlatform.tree === platform.tree &&
                playerPlatform.level !== platform.level &&
                Math.abs(player.x - treeDefinitions[platform.tree].x) < 205 &&
                monkey.jumpCooldown <= 0;

              if (shouldChangeLayer) {
                const nextLevel =
                  platform.level + Math.sign(playerPlatform.level - platform.level);
                const nextPlatformIndex = monkeyPlatforms.findIndex(
                  (candidate) =>
                    candidate.tree === platform.tree && candidate.level === nextLevel,
                );
                if (nextPlatformIndex >= 0) {
                  const nextPlatform = monkeyPlatforms[nextPlatformIndex];
                  monkey.targetPlatformIndex = nextPlatformIndex;
                  monkey.vy = nextPlatform.y < platform.y ? -540 : -255;
                  monkey.vx = Math.sign(player.x - monkey.x || 1) * 145;
                  monkey.jumpCooldown = 0.95;
                }
              } else {
                const minX = platform.x + 20;
                const maxX = platform.x + platform.width - 20;
                const distance = player.x - monkey.x;
                const chasing =
                  previousPlatform === monkey.platformIndex &&
                  Math.abs(distance) < 255;
                const desired = chasing
                  ? Math.sign(distance || player.facing) * 150
                  : Math.sign(monkey.vx || Math.sin(monkey.phase) || 1) * 68;
                monkey.vx += (desired - monkey.vx) * Math.min(1, dt * 6.5);
                if (monkey.x <= minX && monkey.vx < 0) monkey.vx = 74;
                if (monkey.x >= maxX && monkey.vx > 0) monkey.vx = -74;
                monkey.x = Math.max(
                  minX,
                  Math.min(maxX, monkey.x + monkey.vx * dt),
                );
                monkey.y = platform.y;
              }
            }

            if (monkey.dizzyTimer <= 0) {
              const headY = monkey.y - 68;
              const crossedHead =
                player.vy > 80 &&
                previousY <= headY - 3 &&
                player.y >= headY - 3;
              const closeX = Math.abs(player.x - monkey.x) < 29;
              if (closeX && crossedHead) {
                monkey.dizzyTimer = 3.4;
                monkey.pushCooldown = 0.65;
                monkey.vx = 0;
                player.y = headY - 7;
                player.vy = -430;
                player.onGround = false;
                player.onPlatform = null;
                stompedMonkey = true;
                playTone(720, 0.08, "square");
              } else if (
                closeX &&
                Math.abs(player.y - monkey.y) < 60 &&
                monkey.pushCooldown <= 0 &&
                player.pushRecovery <= 0
              ) {
                const shoveDirection = player.x < monkey.x ? -1 : 1;
                player.vx = shoveDirection * 355;
                player.vy = 175;
                player.onGround = false;
                player.onPlatform = null;
                player.pushRecovery = 0.38;
                monkey.pushCooldown = 0.8;
                pushedByMonkey = true;
                playTone(155, 0.12, "sawtooth");
              }
            }
          });

          let landedSafely = false;
          if (player.vy >= 0 && player.pushRecovery <= 0 && !stompedMonkey) {
            const landing = monkeyPlatforms
              .map((platform, index) => ({ platform, index }))
              .filter(({ platform }) =>
                player.x > platform.x - 13 &&
                player.x < platform.x + platform.width + 13 &&
                previousY <= platform.y &&
                player.y >= platform.y,
              )
              .sort((a, b) => a.platform.y - b.platform.y)[0];
            if (landing) {
              player.y = landing.platform.y;
              player.vy = 0;
              player.onGround = true;
              player.onPlatform = landing.index;
              landedSafely = true;
            }
          }

          const aboveBank =
            player.x <= MONKEY_SPIKE_LEFT || player.x >= MONKEY_SPIKE_RIGHT;
          if (!landedSafely && aboveBank && player.y >= MONKEY_GROUND_Y) {
            player.y = MONKEY_GROUND_Y;
            player.vy = 0;
            player.onGround = true;
            player.onPlatform = null;
            landedSafely = true;
          }

          const touchingSpikes =
            !landedSafely &&
            player.x > MONKEY_SPIKE_LEFT &&
            player.x < MONKEY_SPIKE_RIGHT &&
            player.y >= MONKEY_GROUND_Y;
          if (touchingSpikes) {
            player.y = MONKEY_GROUND_Y;
            player.vy = 0;
            player.onGround = true;
            player.onPlatform = -1;
            game.spikeActive = true;
            game.spikeTimer += dt;
          } else {
            game.spikeActive = false;
          }

          if (game.spikeTimer >= MONKEY_SPIKE_LIMIT || player.y > WORLD_HEIGHT + 70) {
            game.running = false;
            game.lost = true;
            setOverlay("gameover");
            setCourseStatus("The spikes won this round");
            playTone(105, 0.42, "sawtooth");
          }

          if (player.x > 1120 && player.onGround && !game.won) {
            game.running = false;
            game.won = true;
            setOverlay("won");
            setCourseStatus("Course clear!");
            playTone(784, 0.16, "triangle");
            window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
          }

          statusTimer += dt;
          if (statusTimer > 0.12 && !game.won && !game.lost) {
            statusTimer = 0;
            setCourseStatus(
              game.spikeActive
                ? `SPIKES! ${Math.max(0, MONKEY_SPIKE_LIMIT - game.spikeTimer).toFixed(1)}s to jump clear`
                : game.spikeTimer > 0
                  ? `Spike damage saved: ${game.spikeTimer.toFixed(1)} / ${MONKEY_SPIKE_LIMIT.toFixed(1)} sec`
                  : pushedByMonkey || player.pushRecovery > 0
                    ? "Pushed! Steer toward a branch"
                    : stompedMonkey
                      ? "Monkey dizzy — move now!"
                      : player.x > 1030
                        ? "The safe trail is close!"
                        : player.onPlatform !== null && player.onPlatform >= 0
                          ? "Keep climbing — jump on monkeys to stun them"
                          : "Cross all four trees and avoid the spikes",
            );
          }
        } else if (game.course === 3) {
          const field = game.eagle;
          const events = stepEagleCourse(
            field,
            player,
            { move, run: running, hold: grabbing },
            dt,
          );
          game.noticeTimer = Math.max(0, game.noticeTimer - dt);
          const notify = (text: string, seconds = 2.2) => {
            game.notice = text;
            game.noticeTimer = seconds;
          };
          events.forEach((event: EagleEvent) => {
            switch (event.type) {
              case "pickup":
                if (event.item === "rodent") {
                  setCourseStatus("Got a rodent! Hold Z to raise it when an eagle dives");
                  playTone(620, 0.08, "triangle");
                  window.setTimeout(() => playTone(1180, 0.05, "square"), 60);
                } else {
                  setCourseStatus("That’s fruit — eagles hate it. Hold Z to eat, SPACE to drop");
                  playTone(520, 0.08, "triangle");
                }
                break;
              case "drop":
                setCourseStatus(event.item === "rodent" ? "The rodent scurried off" : "Fruit dropped");
                playTone(300, 0.06, "triangle");
                break;
              case "reachMiss":
                setCourseStatus("Nothing in reach — stand next to a rodent and press SPACE");
                playTone(240, 0.05, "square");
                break;
              case "eat":
                setCourseStatus("Yum! Health restored a little");
                notify("+15 HEALTH");
                playTone(330, 0.08, "triangle");
                window.setTimeout(() => playTone(494, 0.1, "triangle"), 90);
                break;
              case "lock":
                if (event.onPlayer) {
                  setCourseStatus("EAGLE LOCKED ON — raise a rodent with Z!");
                  playTone(1500, 0.16, "sawtooth");
                  window.setTimeout(() => playTone(1180, 0.14, "sawtooth"), 90);
                }
                break;
              case "dive":
                if (event.onPlayer) {
                  setCourseStatus("DIVE INCOMING!");
                  playTone(220, 0.24, "sawtooth");
                }
                break;
              case "preyTaken":
                setCourseStatus("The eagle took the rodent — grab another and keep moving!");
                notify("FED THE EAGLE!");
                playTone(880, 0.1, "triangle");
                window.setTimeout(() => playTone(1400, 0.06, "square"), 70);
                break;
              case "rodentHunted":
                setCourseStatus("An eagle snatched a rodent from the field");
                playTone(1300, 0.05, "square");
                break;
              case "caught":
                setCourseStatus("CAUGHT! Mash SPACE to break free!");
                playTone(130, 0.4, "sawtooth");
                break;
              case "struggle":
                playTone(480, 0.03, "square");
                break;
              case "escaped":
                setCourseStatus("Free! Brace for landing");
                notify("BROKE FREE!");
                playTone(700, 0.12, "triangle");
                break;
              case "landed":
                setCourseStatus("Shake it off — find a rodent");
                playTone(200, 0.06, "square");
                break;
              case "miss":
                setCourseStatus("The eagle missed — keep moving!");
                playTone(300, 0.08, "triangle");
                break;
              case "thirdEagle":
                notify("A THIRD EAGLE JOINS THE HUNT!", 2.6);
                setCourseStatus("A third eagle joins the hunt!");
                playTone(1600, 0.2, "sawtooth");
                window.setTimeout(() => playTone(1250, 0.18, "sawtooth"), 110);
                break;
              case "won":
                game.running = false;
                game.won = true;
                setOverlay("won");
                setCourseStatus("Course clear!");
                playTone(784, 0.16, "triangle");
                window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
                break;
              case "lost":
                game.running = false;
                game.lost = true;
                setEagleLoss(event.reason);
                setOverlay("gameover");
                setCourseStatus(
                  event.reason === "carried"
                    ? "The eagle carried you off"
                    : "The talons wore you down",
                );
                playTone(105, 0.42, "sawtooth");
                break;
            }
          });

          statusTimer += dt;
          if (statusTimer > 0.6 && events.length === 0 && !game.won && !game.lost) {
            statusTimer = 0;
            const threat = threateningEagle(field);
            setCourseStatus(
              field.caughtBy !== null
                ? `MASH SPACE! ${Math.max(0, EAGLE_HOLD_LIMIT - field.holdTime).toFixed(1)}s left`
                : threat
                  ? field.carrying?.kind === "rodent"
                    ? field.overhead
                      ? "Rodent raised — hold still, the eagle will take it"
                      : "EAGLE DIVING — hold Z to raise the rodent!"
                    : "EAGLE DIVING — no rodent? Run for it!"
                  : player.x <= EAGLE_SAFE_LEFT
                    ? "Safe in the shade — grab a rodent, then cross"
                    : player.x >= EAGLE_SAFE_RIGHT
                      ? "Under the trees — the trail is right there!"
                      : field.carrying?.kind === "rodent"
                        ? "Rodent ready — hold Z the moment an eagle dives"
                        : field.carrying?.kind === "fruit"
                          ? "Fruit: hold Z to eat, or SPACE to drop it"
                          : "Find a rodent — press SPACE next to one",
            );
          }
        } else if (game.course === 4) {
          const river = game.hippo;
          const events = stepHippoCourse(river, player, { move, hold: grabbing }, dt);
          game.noticeTimer = Math.max(0, game.noticeTimer - dt);
          const notify = (text: string, seconds = 1.8) => {
            game.notice = text;
            game.noticeTimer = seconds;
          };
          events.forEach((event: HippoEvent) => {
            switch (event.type) {
              case "jump":
                if (event.kind === "long") {
                  setCourseStatus(
                    event.charge >= 0.98 && event.charge <= 1.05
                      ? "Long jump — perfectly charged!"
                      : event.charge > 1.05
                        ? "Long jump — overcharged, hold on!"
                        : "Long jump — a little under-charged",
                  );
                  playTone(380, 0.08, "square");
                  window.setTimeout(() => playTone(560, 0.1, "square"), 70);
                } else {
                  setCourseStatus("Short hop!");
                  playTone(330, 0.07, "square");
                }
                break;
              case "land":
                if (event.zone === "back") {
                  setCourseStatus("On the back — breathe, then hold Z and SPACE to leap");
                  playTone(260, 0.08, "triangle");
                } else if (event.zone === "head") {
                  setCourseStatus("On the head — hop to the back NOW!");
                  playTone(520, 0.06, "square");
                } else {
                  setCourseStatus("Uh oh — that’s the mouth!");
                }
                break;
              case "chomp":
                notify("CHOMP!", 1.2);
                playTone(110, 0.32, "sawtooth");
                break;
              case "warn":
                if (event.kind === "back") {
                  setCourseStatus("The hippo is getting restless — jump!");
                  playTone(180, 0.14, "sawtooth");
                } else if (event.kind === "head") {
                  setCourseStatus("It’s about to shake — hop!");
                  playTone(700, 0.05, "square");
                } else {
                  setCourseStatus("Bubbles! That hippo is about to dive");
                  playTone(240, 0.1, "triangle");
                }
                break;
              case "submerge":
                setCourseStatus("The hippo went under — wait for it to surface");
                playTone(150, 0.2, "triangle");
                break;
              case "surface":
                setCourseStatus("It’s back up — go!");
                playTone(420, 0.1, "triangle");
                break;
              case "chargeFull":
                notify("LONG JUMP READY", 0.9);
                playTone(880, 0.06, "triangle");
                break;
              case "overcharge":
                setCourseStatus("Too much charge — you’ll overshoot!");
                playTone(200, 0.1, "sawtooth");
                break;
              case "bank":
                playTone(300, 0.08, "triangle");
                break;
              case "won":
                game.running = false;
                game.won = true;
                setOverlay("won");
                setCourseStatus("Course clear!");
                playTone(784, 0.16, "triangle");
                window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
                break;
              case "lost":
                game.running = false;
                game.lost = true;
                setHippoLoss(event.reason);
                setOverlay("gameover");
                setCourseStatus(
                  event.reason === "mouth"
                    ? "The hippo opened wide"
                    : event.reason === "shake"
                      ? "Shaken off the head"
                      : event.reason === "dive"
                        ? "The hippo dove"
                        : "Splash!",
                );
                playTone(105, 0.42, "sawtooth");
                break;
            }
          });

          statusTimer += dt;
          if (statusTimer > 0.5 && events.length === 0 && !game.won && !game.lost) {
            statusTimer = 0;
            const standing = river.standing;
            if (!player.onGround) {
              setCourseStatus(river.lastJump === "long" ? "Leaping…" : "Hopping…");
            } else if (standing && "bank" in standing) {
              setCourseStatus(
                river.chargeHeld > 0
                  ? river.charge >= 1
                    ? "Charged — press SPACE to leap to the first back"
                    : "Charging the long jump…"
                  : "Walk to the edge — SPACE hops, hold Z + SPACE leaps",
              );
            } else if (standing && "hippo" in standing) {
              const hippo = river.hippos[standing.hippo];
              if (standing.zone === "back") {
                const left = Math.max(0, zoneLimit("back", hippo) - river.backTime);
                setCourseStatus(
                  river.chargeHeld > 0
                    ? river.charge >= 1
                      ? `Charged — SPACE now! ${left.toFixed(1)}s left`
                      : `Charging… ${left.toFixed(1)}s before it dives`
                    : `Back: ${left.toFixed(1)}s before it dives — walk to the rear or charge Z`,
                );
              } else if (standing.zone === "head") {
                setCourseStatus("Head! Hop NOW");
              }
            }
          }
        } else if (game.course === 5) {
          const maze = game.snake;
          const events = stepSnakeCourse(maze, dt);
          game.noticeTimer = Math.max(0, game.noticeTimer - dt);
          const position = playerPosition(maze);
          player.x = position.x;
          player.y = position.y;
          events.forEach((event: SnakeEvent) => {
            switch (event.type) {
              case "hop":
                playTone(event.toCol > maze.col ? 360 : 300, 0.05, "square");
                break;
              case "walk":
                playTone(240, 0.03, "triangle");
                break;
              case "blocked":
                setCourseStatus(
                  event.move === "up" || event.move === "down"
                    ? "The root doesn’t go that way — only hop forward or back"
                    : "Can’t go that way",
                );
                playTone(160, 0.05, "square");
                break;
              case "wake":
                setCourseStatus("SNAKES AWAKE — hop to a root or back, NOW!");
                game.notice = "HISSSS!";
                game.noticeTimer = SNAKE_BITE_DELAY;
                playTone(1900, 0.18, "sawtooth");
                window.setTimeout(() => playTone(1500, 0.16, "sawtooth"), 60);
                break;
              case "sleep":
                setCourseStatus("Safe — the snakes are asleep again. Remember what you saw!");
                playTone(420, 0.08, "triangle");
                break;
              case "bank":
                if (!maze.won) setCourseStatus("Back on the bank — pick a lane and hop in");
                break;
              case "won":
                game.running = false;
                game.won = true;
                setOverlay("won");
                setCourseStatus("Course clear!");
                playTone(784, 0.16, "triangle");
                window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
                break;
              case "lost":
                game.running = false;
                game.lost = true;
                setSnakeLoss(event.reason);
                setOverlay("gameover");
                setCourseStatus(event.reason === "instant" ? "Bitten by an awake snake" : "Bitten — too slow");
                playTone(105, 0.42, "sawtooth");
                break;
            }
          });

          statusTimer += dt;
          if (statusTimer > 0.6 && events.length === 0 && !game.won && !game.lost) {
            statusTimer = 0;
            const row = Math.max(0, maze.col + 1);
            setCourseStatus(
              maze.awake
                ? `SNAKES AWAKE — ${Math.max(0, maze.biteTimer).toFixed(1)}s to hop off!`
                : maze.col < 0
                  ? "On the bank — ↑↓ pick a lane, → hops onto row 1"
                  : `Row ${row} / ${SNAKE_COLS} — on a root · ↑↓ walk it, → hops the next row`,
            );
          }
        } else if (game.course === 6) {
          const valley = game.pig;
          const events = stepPigCourse(
            valley,
            player,
            { move, run: running, hold: grabbing },
            dt,
          );
          game.noticeTimer = Math.max(0, game.noticeTimer - dt);
          const notify = (text: string, seconds = 1.6) => {
            game.notice = text;
            game.noticeTimer = seconds;
          };
          events.forEach((event: PigEvent) => {
            switch (event.type) {
              case "hop":
                setCourseStatus("Hopped — pigs can't bite stilts that are off the ground");
                playTone(360, 0.06, "square");
                break;
              case "vault":
                setCourseStatus("Stilt vault!");
                playTone(300, 0.07, "square");
                window.setTimeout(() => playTone(520, 0.09, "square"), 70);
                break;
              case "land":
                if (event.on === "boulder") {
                  setCourseStatus("Safe on the rock — the pigs can't reach you. Hop down when the coast is clear");
                } else if (event.on === "floor" && player.x > PIG_SAFE_LEFT && player.x < PIG_SAFE_RIGHT) {
                  setCourseStatus("Down in the valley — hold X and RUN!");
                }
                break;
              case "blocked":
                setCourseStatus("A boulder! Hold Z + SPACE to vault over it");
                playTone(150, 0.08, "square");
                break;
              case "bite":
                notify("CHOMP!", 0.9);
                playTone(150, 0.14, "sawtooth");
                window.setTimeout(() => playTone(110, 0.1, "sawtooth"), 40);
                break;
              case "warn":
                setCourseStatus("Your stilts are getting short — two more bites and you can't climb out!");
                playTone(200, 0.16, "sawtooth");
                break;
              case "trapped":
                notify("TOO SHORT TO CLIMB OUT!", 2.2);
                setCourseStatus("The stilts are shorter than the valley wall — and the whole herd is coming");
                playTone(180, 0.2, "sawtooth");
                window.setTimeout(() => playTone(120, 0.24, "sawtooth"), 160);
                break;
              case "tooShort":
                setCourseStatus("TOO SHORT! The stilts can't reach the top of the wall");
                playTone(130, 0.1, "square");
                break;
              case "climb":
                if (event.side === "left") setCourseStatus("Back on the high ground — catch your breath");
                playTone(420, 0.06, "square");
                window.setTimeout(() => playTone(560, 0.08, "square"), 60);
                break;
              case "won":
                game.running = false;
                game.won = true;
                setOverlay("won");
                setCourseStatus("Course clear!");
                playTone(784, 0.16, "triangle");
                window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
                break;
              case "lost":
                game.running = false;
                game.lost = true;
                setPigLoss(event.reason);
                setOverlay("gameover");
                setCourseStatus(
                  event.reason === "trapped"
                    ? "Stuck in the valley — the stilts were too short to climb out"
                    : "The pigs chewed through your stilts",
                );
                playTone(105, 0.42, "sawtooth");
                break;
            }
          });

          statusTimer += dt;
          if (statusTimer > 0.5 && events.length === 0 && !game.won && !game.lost) {
            statusTimer = 0;
            const onHighGround = player.onGround && player.y <= PIG_LEDGE_Y + 0.5;
            const onRock = player.onGround && !onHighGround && player.y < PIG_FLOOR_Y - 0.5;
            const nextBoulder = valley.boulders
              .map((boulder) => boulder.x - player.x)
              .filter((gap) => gap > 0 && gap < 150)
              .sort((a, b) => a - b)[0];
            setCourseStatus(
              onHighGround && player.x <= PIG_SAFE_LEFT
                ? "On the high ground — hold X, run, and drop into the valley"
                : onRock
                  ? "Resting on the rock — hop down and run when the pig wanders off"
                  : !canClimbOut(valley)
                    ? "Stilts too short for the wall — the herd is loose"
                    : nextBoulder !== undefined
                      ? "Boulder ahead — hold Z + SPACE to vault it"
                      : valley.stilt <= PIG_LOW_STILT
                        ? "Stilts nearly too short — no more bites, run for the wall!"
                        : player.x > (PIG_SAFE_LEFT + PIG_SAFE_RIGHT) / 2
                          ? "Halfway — keep running and climb the far wall"
                          : "Keep moving — the pigs bite planted stilts",
            );
          }
        } else if (game.course === 7) {
          const river = game.river;
          const events = stepRiverCourse(river, player, { moveX: move, moveY: (down ? 1 : 0) - (up ? 1 : 0) }, dt);
          events.forEach((event: RiverEvent) => {
            switch (event.type) {
              case "hop":
                setCourseStatus("Hop! Steer with the arrows and land on a log");
                playTone(392, 0.06, "square");
                break;
              case "board":
                setCourseStatus(
                  event.kind === "climb"
                    ? "A slanted log — spin → to cross while it sinks slowest"
                    : event.kind === "brake"
                      ? "A crosswise log — spin → to slow the fall, but you won't cross on it"
                      : event.kind === "sink"
                        ? "Careful — spinning → drags this one downstream; hop off soon"
                        : "A straight log — spin → to cross, but the current pulls you down fast",
                );
                playTone(440, 0.06, "square");
                window.setTimeout(() => playTone(560, 0.06, "square"), 60);
                break;
              case "spin":
                playTone(event.direction > 0 ? 320 : 232, 0.04, "square");
                break;
              case "warn":
                setCourseStatus("The waterfall is close — hop UP to a fresher log, now!");
                playTone(200, 0.16, "sawtooth");
                window.setTimeout(() => playTone(150, 0.16, "sawtooth"), 150);
                break;
              case "won":
                game.running = false;
                game.won = true;
                setOverlay("won");
                setCourseStatus("Course clear!");
                playTone(784, 0.16, "triangle");
                window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
                break;
              case "lost":
                game.running = false;
                game.lost = true;
                setRiverLoss(event.reason);
                setOverlay("gameover");
                setCourseStatus(
                  event.reason === "waterfall"
                    ? "You fell down the waterfall… too bad!"
                    : "You became piranha lunch… ouch!",
                );
                playTone(event.reason === "waterfall" ? 130 : 90, 0.42, "sawtooth");
                break;
            }
          });

          statusTimer += dt;
          if (statusTimer > 0.5 && events.length === 0 && !game.won && !game.lost) {
            statusTimer = 0;
            const log = ridingLog(river);
            const headroom = riverHeadroom(player.y);
            setCourseStatus(
              river.onBank === "start"
                ? "Walk with the arrows, then aim SPACE to hop onto a log"
                : headroom < 0.34
                  ? "The falls are close! Hop UP to a higher log — SPACE + arrows"
                  : log
                    ? player.x > (RIVER_LEFT_BANK + RIVER_RIGHT_BANK) / 2
                      ? "Over halfway — keep hopping up and steering for the far bank"
                      : "Spin ←→ to cross, then hop UP before the current drags you down"
                    : "Steer with the arrows and come down on a log",
            );
          }
        } else {
          const savanna = game.lion;
          const events = stepLionCourse(savanna, player, { move, run: running, up, down }, dt);
          game.noticeTimer = Math.max(0, game.noticeTimer - dt);
          const notify = (text: string, seconds = 1.6) => {
            game.notice = text;
            game.noticeTimer = seconds;
          };
          events.forEach((event: LionEvent) => {
            switch (event.type) {
              case "jump":
                playTone(340, 0.06, "square");
                break;
              case "catch":
                setCourseStatus("Caught the branch — now press ↑ to climb, you're not safe yet!");
                playTone(420, 0.06, "square");
                window.setTimeout(() => playTone(520, 0.07, "square"), 60);
                break;
              case "climb":
                setCourseStatus("Safe on the branch — the lion can't reach you up here. Wait for your moment");
                playTone(520, 0.07, "triangle");
                window.setTimeout(() => playTone(700, 0.09, "triangle"), 80);
                break;
              case "hang":
                setCourseStatus("Hanging — press SPACE to drop to the grass (the lion can reach you here!)");
                playTone(300, 0.05, "square");
                break;
              case "drop":
                setCourseStatus("Down on the grass — RUN for the next tree!");
                playTone(240, 0.06, "square");
                break;
              case "land":
                if (event.safe && player.x >= LION_SAFE_RIGHT) break;
                if (!event.safe) setCourseStatus("In the open — get under a branch and jump");
                break;
              case "alert":
                notify("THE LION SAW YOU!", 1.2);
                setCourseStatus("Spotted! Get to a branch and CLIMB — SPACE, then ↑");
                playTone(160, 0.14, "sawtooth");
                break;
              case "chase":
                playTone(110, 0.3, "sawtooth");
                window.setTimeout(() => playTone(90, 0.3, "sawtooth"), 120);
                break;
              case "wait":
                if (event.tree !== null) {
                  setCourseStatus("The lion is pacing under your tree — stay up there until it loses interest");
                } else {
                  setCourseStatus("Back on the rocks — the lion won't come up here. Wait for it to wander off");
                }
                break;
              case "roar":
                playTone(95, 0.22, "sawtooth");
                break;
              case "leave":
                notify("THE LION LOST INTEREST", 1.5);
                setCourseStatus("It's wandering off — go when it's looking away and not between you and the next tree");
                playTone(330, 0.08, "triangle");
                window.setTimeout(() => playTone(440, 0.1, "triangle"), 90);
                break;
              case "escape":
                break;
              case "won":
                // Let the celebration play on the canvas before the card appears
                game.won = true;
                setCourseStatus("THE GOLDEN PUMPKIN IS YOURS!");
                playTone(659, 0.16, "triangle");
                window.setTimeout(() => playTone(784, 0.16, "triangle"), 140);
                window.setTimeout(() => playTone(1046, 0.3, "triangle"), 280);
                window.setTimeout(() => playTone(1318, 0.5, "triangle"), 460);
                window.setTimeout(() => {
                  if (gameRef.current !== game) return;
                  game.running = false;
                  setOverlay("won");
                }, 3600);
                break;
              case "lost":
                game.lost = true;
                setLionLoss(event.reason);
                window.setTimeout(() => {
                  if (gameRef.current !== game) return;
                  game.running = false;
                  setOverlay("gameover");
                }, 1300);
                setCourseStatus(
                  event.reason === "hanging"
                    ? "Pulled off the branch — hanging isn't safe, you have to climb!"
                    : "The lion caught you in the open… ouch!",
                );
                playTone(80, 0.5, "sawtooth");
                break;
            }
          });

          statusTimer += dt;
          if (statusTimer > 0.5 && events.length === 0 && !game.won && !game.lost) {
            statusTimer = 0;
            const lion = savanna.lion;
            const sees = lionSeesPlayer(savanna, player);
            const facing = lionFacesPlayer(lion, player);
            setCourseStatus(
              isSheltered(savanna)
                ? lion.mood === "wait"
                  ? `Stay put — the lion loses interest in ${patienceLeft(savanna).toFixed(1)}s`
                  : facing
                    ? "Safe up here — the lion is facing your way, wait for it to turn"
                    : lion.mood === "look"
                      ? "It's stopped to look around — it may turn any moment"
                      : "It's looking away — ↓ then SPACE to drop, then RUN to the next tree"
                : savanna.perch !== "ground"
                  ? "Hanging isn't safe — press ↑ to climb onto the branch"
                  : player.x <= LION_SAFE_LEFT
                    ? facing
                      ? "On the rocks — wait until the lion looks away, then run for the first tree"
                      : "The lion's looking away — run! SPACE under the first branch, then ↑"
                    : sees
                      ? "IT SEES YOU — get under a branch, SPACE, then ↑!"
                      : player.x > LION_SAFE_RIGHT
                        ? "The shrine! Walk up to the Golden Pumpkin"
                        : "In the open — keep running, SPACE under a branch and ↑ to climb",
            );
          }
        }
      } else {
        game.elapsed += dt * 0.35;
      }

      if (game.course === 1) drawWorld(context, game, activeCharacter);
      else if (game.course === 2) drawMonkeyWorld(context, game, activeCharacter);
      else if (game.course === 3) drawEagleWorld(context, game, activeCharacter);
      else if (game.course === 4) drawHippoWorld(context, game, activeCharacter);
      else if (game.course === 5) drawSnakeWorld(context, game, activeCharacter);
      else if (game.course === 6) drawPigWorld(context, game, activeCharacter);
      else if (game.course === 7) drawRiverWorld(context, game, activeCharacter);
      else drawLionWorld(context, game, activeCharacter);
      animationFrame = window.requestAnimationFrame(update);
    };

    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeCharacter, playTone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const gameKeys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Space",
        "KeyX",
        "KeyZ",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyS",
      ];
      if (gameKeys.includes(event.code)) event.preventDefault();

      const game = gameRef.current;
      if (game.course === 5) {
        if (!event.repeat && game.running) {
          const move = snakeMoveForCode(event.code);
          if (move) game.snake.pendingMove = move;
        }
        keysRef.current.add(event.code);
        return;
      }
      if (event.code === "Space" && !event.repeat && game.running) {
        const player = game.player;
        if (game.course === 3) {
          game.eagle.spacePresses += 1;
        } else if (game.course === 4) {
          game.hippo.jumpPresses += 1;
          game.hippo.jumpWithHold = keysRef.current.has("KeyZ");
        } else if (game.course === 6) {
          game.pig.jumpPresses += 1;
          game.pig.jumpWithHold = keysRef.current.has("KeyZ");
        } else if (game.course === 7) {
          game.river.jumpPresses += 1;
        } else if (game.course === 8) {
          game.lion.jumpPresses += 1;
        } else if (game.course === 2 && player.onGround) {
          player.vy = -515;
          player.onGround = false;
          player.onPlatform = null;
          game.spikeActive = false;
          setCourseStatus("Airborne — aim for the next branch or a monkey");
          playTone(350, 0.07, "square");
        } else if (player.attachedVine !== null) {
          const point = gripPoint(
            vines[player.attachedVine],
            game.elapsed,
            player.vineRatio,
          );
          player.attachedVine = null;
          player.canGrab = true;
          player.vx = point.vx * 0.95 + player.facing * 120;
          player.vy = Math.min(point.vy - 230, -390);
          player.grabCooldown = 0.3;
          setCourseStatus("Jumped — steer, then grab the next vine!");
          playTone(440, 0.08, "square");
        } else if (player.onGround) {
          player.vy = -520;
          player.onGround = false;
          player.canGrab = true;
          setCourseStatus("Jumped — hold Z when the vine is close");
          playTone(330, 0.07, "square");
        }
      }
      keysRef.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const onBlur = () => keysRef.current.clear();

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [playTone]);

  const pressControl = (code: string) => {
    const game = gameRef.current;
    if (game.course === 5) {
      const move = snakeMoveForCode(code);
      if (move && game.running) game.snake.pendingMove = move;
      canvasRef.current?.focus();
      return;
    }
    keysRef.current.add(code);
    canvasRef.current?.focus();
  };

  const releaseControl = (code: string) => {
    keysRef.current.delete(code);
  };

  const tapJump = () => {
    const game = gameRef.current;
    if (!game.running) return;
    const player = game.player;
    if (game.course === 5) {
      game.snake.pendingMove = "forward";
    } else if (game.course === 3) {
      game.eagle.spacePresses += 1;
    } else if (game.course === 4) {
      game.hippo.jumpPresses += 1;
      game.hippo.jumpWithHold = keysRef.current.has("KeyZ");
    } else if (game.course === 6) {
      // The touch VAULT button always primes a vault; a run-up carries it over a boulder.
      game.pig.jumpPresses += 1;
      game.pig.jumpWithHold = true;
    } else if (game.course === 7) {
      game.river.jumpPresses += 1;
    } else if (game.course === 8) {
      game.lion.jumpPresses += 1;
    } else if (game.course === 2 && player.onGround) {
      player.vy = -515;
      player.onGround = false;
      player.onPlatform = null;
      game.spikeActive = false;
      setCourseStatus("Airborne — aim for the next branch or a monkey");
      playTone(350, 0.07, "square");
    } else if (player.attachedVine !== null) {
      const point = gripPoint(
        vines[player.attachedVine],
        game.elapsed,
        player.vineRatio,
      );
      player.attachedVine = null;
      player.canGrab = true;
      player.vx = point.vx * 0.95 + player.facing * 120;
      player.vy = Math.min(point.vy - 230, -390);
      player.grabCooldown = 0.3;
      setCourseStatus("Jumped — steer, then grab the next vine!");
      playTone(440, 0.08, "square");
    } else if (player.onGround) {
      player.vy = -520;
      player.onGround = false;
      player.canGrab = true;
      setCourseStatus("Jumped — hold Z when the vine is close");
      playTone(330, 0.07, "square");
    }
  };

  return (
    <main className="game-page">
      {showTitleScreen && (
        <section
          className="title-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-screen-heading"
        >
          <h1 className="sr-only" id="title-screen-heading">
            Guto and Nanda and the Golden Pumpkin
          </h1>
          <img
            className="title-screen-art"
            src="/og.png"
            alt="Guto and Nanda crossing vines above crocodiles in a golden jungle"
          />
          <div className="title-screen-shade" />
          <div className="title-launch">
            <p>AN EIGHT-COURSE JUNGLE ADVENTURE</p>
            <button
              onClick={() => {
                setShowTitleScreen(false);
                playTone(523, 0.12, "triangle");
              }}
              type="button"
            >
              <span>ENTER THE JUNGLE</span>
              <span aria-hidden="true">→</span>
            </button>
            <small>COURSES 01–08 READY · THE FULL EXPEDITION</small>
          </div>
        </section>
      )}

      <div className="atmosphere atmosphere-one" />
      <div className="atmosphere atmosphere-two" />

      <header className="site-header">
        <a className="brand" href="#game" aria-label="Golden Pumpkin home">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <span>
            <strong>Guto &amp; Nanda</strong>
            <small>and the Golden Pumpkin</small>
          </span>
        </a>
        <div className="header-progress" aria-label={`Course progress: ${activeCourse} of eight`}>
          <span>EXPEDITION</span>
          <div className="progress-dots" aria-hidden="true">
            {courses.map((course, index) => (
              <i
                className={
                  index === activeCourse - 1
                    ? "active"
                    : index < activeCourse - 1
                      ? "complete"
                      : ""
                }
                key={course.number}
              />
            ))}
          </div>
          <b>0{activeCourse} / 08</b>
        </div>
        <div className="header-actions">
          <button className="text-button" onClick={openBriefing} type="button">
            How to play
          </button>
          <button
            className="sound-button"
            onClick={() => setSoundOn((value) => !value)}
            type="button"
            aria-pressed={soundOn}
            aria-label={soundOn ? "Mute sound" : "Turn sound on"}
          >
            {soundOn ? "◖))" : "◖×"}
          </button>
        </div>
      </header>

      <section className="game-intro" id="game">
        <div>
          <div className="course-switcher" aria-label="Playable courses">
            <button
              className={activeCourse === 1 ? "selected" : ""}
              onClick={() => selectCourse(1)}
              type="button"
            >01 · CANAL</button>
            <button
              className={activeCourse === 2 ? "selected" : ""}
              onClick={() => selectCourse(2)}
              type="button"
            >02 · MONKEYS</button>
            <button
              className={activeCourse === 3 ? "selected" : ""}
              onClick={() => selectCourse(3)}
              type="button"
            >03 · EAGLES</button>
            <button
              className={activeCourse === 4 ? "selected" : ""}
              onClick={() => selectCourse(4)}
              type="button"
            >04 · HIPPOS</button>
            <button
              className={activeCourse === 5 ? "selected" : ""}
              onClick={() => selectCourse(5)}
              type="button"
            >05 · SNAKES</button>
            <button
              className={activeCourse === 6 ? "selected" : ""}
              onClick={() => selectCourse(6)}
              type="button"
            >06 · PIGS</button>
            <button
              className={activeCourse === 7 ? "selected" : ""}
              onClick={() => selectCourse(7)}
              type="button"
            >07 · PIRANHAS</button>
            <button
              className={activeCourse === 8 ? "selected" : ""}
              onClick={() => selectCourse(8)}
              type="button"
            >08 · LION</button>
          </div>
          <p className="eyebrow">
            {byCourse(
              activeCourse,
              "COURSE 01 · CROCODILE TERRITORY",
              "COURSE 02 · CAPUCHIN CANOPY",
              "COURSE 03 · EAGLE CLEARING",
              "COURSE 04 · HIPPO RIVER",
              "COURSE 05 · SLEEPING SNAKES",
              "COURSE 06 · WILD PIG VALLEY",
              "COURSE 07 · PIRANHA RIVER",
              "COURSE 08 · THE LION'S SAVANNA",
            )}
          </p>
          <h1>
            {byCourse(
              activeCourse,
              "The Crocodile Canal",
              "The Pushing Monkeys",
              "The Diving Eagles",
              "The Hippo Crossing",
              "The Sleeping Snakes",
              "The Wild Pig Valley",
              "The Piranha River",
              "The Lion's Watch",
            )}
          </h1>
        </div>
        <p className="intro-copy">
          {byCourse(
            activeCourse,
            "The trail disappears beneath the water. Time the swing, trust your partner, and don’t look down.",
            "Four ancient trees guard the trail. Climb over both barriers, dodge the capuchins, and keep total spike damage below one second.",
            "A sunny clearing with no cover. Three hawk-eagles circle above, so carry a rodent, raise it when they dive, and never stop moving.",
            "Four hippos wallow between the banks. Every part of a hippo is a landing spot, but only the back forgives a pause — and one hippo likes to dive.",
            "Seen from above, the forest floor is a tangle of roots and sleeping vipers that look exactly alike. Hop one row at a time, wake them on purpose, and remember what you saw.",
            "The trail ends at a cliff. Down in the valley, wild pigs root among the boulders. Strap on the pea-leg stilts — taller than the valley wall, for now — and cross before the boars chew them too short to climb out.",
            "The trail is cut by a wide river sliding toward a waterfall. Logs float down it — hop aboard, spin them the right way to steer across, and don't fall in with the piranhas.",
            "The last stretch is open savanna, and a lion guards the Golden Pumpkin at the far end. Three acacia trees are the only cover: jump for a branch and climb it before the lion gets there, and only move when it isn't watching.",
          )}
        </p>
      </section>

      <section
        className="game-shell"
        aria-label={byCourse(
          activeCourse,
          "The Crocodile Canal game",
          "The Pushing Monkeys game",
          "The Diving Eagles game",
          "The Hippo Crossing game",
          "The Sleeping Snakes game",
          "The Wild Pig Valley game",
          "The Piranha River game",
          "The Lion's Watch game",
        )}
      >
        <div className="game-hud">
          <div className="hud-item">
            <span>EXPLORER</span>
            <b>{activeCharacter === "guto" ? "Guto" : "Nanda"}</b>
          </div>
          <div className="hud-status" aria-live="polite">
            <span className="pulse-dot" />
            {courseStatus}
          </div>
          <div className="hud-item hud-goal">
            <span>FINAL TREASURE</span>
            <b><span aria-hidden="true">🎃</span> Golden Pumpkin</b>
          </div>
        </div>

        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            className="game-canvas"
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            tabIndex={0}
            aria-label={byCourse(
              activeCourse,
              "A side-scrolling jungle course. Cross the crocodile-filled canal by jumping and grabbing three swinging vines.",
              "A side-scrolling treetop course. Cross four layered trees and two barriers before cumulative spike damage reaches one second.",
              "A side-scrolling clearing course. Cross an open meadow while three eagles dive, raising rodents overhead as shields and mashing free if caught.",
              "A side-scrolling river course. Hop across four hippos using short hops and charged long jumps, landing on heads and backs but never in a mouth.",
              "A top-down maze course. Hop across twenty rows of roots and sleeping snakes that look identical, waking snakes briefly to memorize a safe path.",
              "A side-scrolling valley course. Drop from the high ground and cross the valley floor on wooden stilts, vaulting boulders with Z and Space while wild pigs bite the stilts shorter; climb out only while the stilts are still taller than the valley wall.",
              "A top-down river course. Hop onto floating logs and spin them with the arrow keys to steer left-to-right across a current flowing toward a waterfall, while piranhas wait below; reach the far bank without falling in or going over the falls.",
              "A side-scrolling savanna course. Cross open ground guarded by a lion that charges anything it sees on the ground or hanging from a branch. Jump under an acacia branch to catch it and press up to climb to safety; press down and then jump to get back down, and move only while the lion is looking away. Reach the shrine to claim the Golden Pumpkin.",
            )}
          />

          {overlay === "briefing" && (
            <div className="game-overlay briefing-overlay" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
              <div className="briefing-card">
                <div className="briefing-topline">
                  <span>FIELD BRIEFING · 0{activeCourse}</span>
                  <span className="danger-label">
                    {byCourse(
                      activeCourse,
                      "● CROCODILES ACTIVE",
                      "● MONKEY PATROLS ACTIVE",
                      "● EAGLES CIRCLING",
                      "● HIPPOS RESTLESS",
                      "● SNAKES SLEEPING",
                      "● WILD PIGS ROAMING",
                      "● PIRANHAS CIRCLING",
                      "● LION ON THE PROWL",
                    )}
                  </span>
                </div>
                <div className="briefing-grid">
                  <div className="briefing-copy">
                    <p className="eyebrow">YOUR MISSION</p>
                    <h2 id="briefing-title">
                      {activeCourse === 1 ? (
                        <>Swing across.<br />Stay out of the water.</>
                      ) : activeCourse === 2 ? (
                        <>Climb all four trees.<br />Don’t get pushed.</>
                      ) : activeCourse === 3 ? (
                        <>Cross the clearing.<br />Feed the eagles, not yourself.</>
                      ) : activeCourse === 4 ? (
                        <>Hop the river.<br />Never land in a mouth.</>
                      ) : activeCourse === 5 ? (
                        <>Cross twenty rows.<br />Remember the snakes.</>
                      ) : activeCourse === 6 ? (
                        <>Cross the valley.<br />Climb out before the stilts are too short.</>
                      ) : activeCourse === 7 ? (
                        <>Spin the logs across.<br />Stay out of the piranhas.</>
                      ) : (
                        <>Cross the savanna.<br />Claim the Golden Pumpkin.</>
                      )}
                    </h2>
                    <p>
                      {activeCourse === 1 ? (
                        <>Wait for a vine to sweep close, <strong>jump first</strong>, then
                        hold <strong>Z</strong> to catch any part of the rope. Keep Z
                        pressed, climb with ↑↓, and jump before catching the next vine.</>
                      ) : activeCourse === 2 ? (
                        <>Jump from branch to branch across the four tall trees. Monkeys
                        chase you on their layer and will <strong>push you toward the spikes</strong>.
                        Land on a monkey’s head to leave it dizzy long enough to escape.</>
                      ) : activeCourse === 3 ? (
                        <>Pick up a rodent with <strong>SPACE</strong>. When an eagle locks on,
                        hold <strong>Z</strong> to raise it overhead so the eagle takes the rodent
                        instead of you. If talons grab you, <strong>mash SPACE</strong> — three
                        seconds in the air and you’re gone.</>
                      ) : activeCourse === 4 ? (
                        <>Each hippo has a <strong>mouth</strong> (it opens at once), a{" "}
                        <strong>head</strong> (leave in under a second), and a <strong>back</strong>{" "}
                        (rest a moment, then go). <strong>SPACE</strong> hops a short arc; hold{" "}
                        <strong>Z</strong> to charge, then SPACE to leap straight to the next back.</>
                      ) : activeCourse === 5 ? (
                        <>From above, roots and sleeping snakes look the same. Hop forward one row
                        with <strong>→</strong>. Land on a snake and <strong>every snake wakes</strong>{" "}
                        for a moment — hop to a root (or straight back) before it bites. Roots are
                        safe forever: walk along them with <strong>↑↓</strong> to line up the next hop.</>
                      ) : activeCourse === 6 ? (
                        <>The stilts are <strong>taller than the valley wall</strong> — that is how you climb
                        out on the far side. Every pig bite <strong>chews them shorter</strong>, and once they
                        are shorter than the wall you are stuck down there. Hold <strong>X</strong> to run,
                        press <strong>Z + SPACE</strong> to vault the boulders, and never stand still.</>
                      ) : activeCourse === 7 ? (
                        <>Walk the near bank with the arrows, then <strong>aim SPACE</strong> to hop onto a
                        floating log and steer the leap with the arrows. On a log the arrows{" "}
                        <strong>spin</strong> it: most logs carry you toward the far bank. But the current
                        always wins — spin only <strong>slows the fall</strong>, it never climbs — so before
                        your log sinks too low you must <strong>hop UP</strong> to a fresher, higher one.
                        Miss a log and the piranhas get you; drift over the lip and it's the falls.</>
                      ) : (
                        <>The lion charges anything it <strong>sees</strong> on the ground — or hanging from a
                        branch. It only sees what it is <strong>facing</strong>, so move when it looks away.
                        Under a tree, <strong>SPACE</strong> jumps for the branch and <strong>↑</strong> climbs
                        onto it: up there you are safe, and a lion pacing below will lose interest and wander
                        off. To get down it’s the same moves backwards: <strong>↓</strong> to hang, then{" "}
                        <strong>SPACE</strong> to drop. Never run toward the lion.</>
                      )}
                    </p>

                    <div className="character-picker" aria-label="Choose your explorer">
                      <button
                        className={activeCharacter === "guto" ? "selected" : ""}
                        onClick={() => {
                          if (!hasStarted) setActiveCharacter("guto");
                        }}
                        disabled={hasStarted}
                        type="button"
                      >
                        <span className="portrait guto-portrait" aria-hidden="true">G</span>
                        <span><small>PLAY AS</small><b>Guto</b></span>
                        {activeCharacter === "guto" && <i>✓</i>}
                      </button>
                      <button
                        className={activeCharacter === "nanda" ? "selected" : ""}
                        onClick={() => {
                          if (!hasStarted) setActiveCharacter("nanda");
                        }}
                        disabled={hasStarted}
                        type="button"
                      >
                        <span className="portrait nanda-portrait" aria-hidden="true">N</span>
                        <span><small>PLAY AS</small><b>Nanda</b></span>
                        {activeCharacter === "nanda" && <i>✓</i>}
                      </button>
                    </div>
                  </div>

                  <div className="control-panel">
                    <p className="eyebrow">CONTROLS</p>
                    <div className="control-row">
                      <span className="key-pair"><kbd>←→</kbd>{(activeCourse === 1 || activeCourse === 5 || activeCourse === 7 || activeCourse === 8) && <kbd>↑↓</kbd>}</span>
                      <span>
                        <b>{byCourse(activeCourse, "Move / climb", "Move / steer", "Move", "Walk", "Hop a row", "Move / run", "Spin / walk / steer", "Run / climb / get down")}</b>
                        <small>{byCourse(activeCourse, "Steer in air, climb on a vine", "Control every jump in the air", "Walk the clearing, chase rodents", "Position yourself on a back or the bank edge", "Forward or back, onto whatever is there", "Walk off the ledge, cross the floor, steer in the air", "On a log: → forward / ← back spin. On the bank or mid-jump: move & aim", "←→ run the savanna or walk the branch · ↑ climbs from a hang · ↓ hangs from the branch")}</small>
                      </span>
                    </div>
                    <div className="control-row">
                      <span className="wide-key"><kbd>SPACE</kbd></span>
                      <span>
                        <b>{byCourse(activeCourse, "Jump / release", "Jump / stomp", "Grab / drop / struggle", "Short hop", "Hop forward", "Hop", "Hop to a log", "Jump / let go")}</b>
                        <small>{byCourse(activeCourse, "Leap at the swing’s edge", "Land on monkeys to make them dizzy", "Pick up what’s nearest; mash to break free", "Bank → mouth or head · head → back · back → next head", "Same as →, one row at a time", "Lifts the stilts clear of a bite — too low for a boulder", "Aim and steer it onto a log — miss and it's the piranhas", "Under a branch: jump and catch it. While hanging: let go and drop")}</small>
                      </span>
                    </div>
                    {activeCourse === 1 && (
                      <div className="control-row important-control">
                        <span className="wide-key"><kbd>Z</kbd></span>
                        <span><b>Grab &amp; keep holding</b><small>Release Z and you fall</small></span>
                      </div>
                    )}
                    {activeCourse === 3 && (
                      <div className="control-row important-control">
                        <span className="wide-key"><kbd>Z</kbd></span>
                        <span><b>Raise rodent / eat fruit</b><small>Hold to lift the rodent overhead</small></span>
                      </div>
                    )}
                    {activeCourse === 4 && (
                      <div className="control-row important-control">
                        <span className="key-pair"><kbd>Z</kbd><kbd>SPACE</kbd></span>
                        <span><b>Long jump</b><small>Hold Z until the meter is green, then SPACE</small></span>
                      </div>
                    )}
                    {activeCourse === 5 && (
                      <div className="control-row important-control">
                        <span className="wide-key"><kbd>↑↓</kbd></span>
                        <span><b>Walk along the root</b><small>Only where the same root continues</small></span>
                      </div>
                    )}
                    {activeCourse === 6 && (
                      <div className="control-row important-control">
                        <span className="key-pair"><kbd>Z</kbd><kbd>SPACE</kbd></span>
                        <span><b>Stilt vault</b><small>Hold Z and press SPACE with a run-up to clear a boulder — from a standstill you land on top of it, out of the pigs’ reach</small></span>
                      </div>
                    )}
                    {activeCourse === 7 && (
                      <div className="control-row important-control">
                        <span className="wide-key"><kbd>↑↓</kbd></span>
                        <span><b>Walk &amp; aim</b><small>Move on the bank, and steer your jump through the air onto a log</small></span>
                      </div>
                    )}
                    {activeCourse === 8 && (
                      <div className="control-row important-control">
                        <span className="key-pair"><kbd>SPACE</kbd><kbd>↑</kbd></span>
                        <span><b>Climb the branch</b><small>Jump to catch it, then ↑ to climb on top — only then are you safe. Getting down is the reverse: ↓ to hang, then SPACE</small></span>
                      </div>
                    )}
                    {activeCourse !== 4 && activeCourse !== 5 && activeCourse !== 7 && (
                      <div className="control-row">
                        <span className="wide-key"><kbd>X</kbd></span>
                        <span><b>Run</b><small>{activeCourse === 3 ? "Not while a rodent is raised" : activeCourse === 6 ? "Faster than a charging pig — walking is not" : activeCourse === 8 ? "Still slower than a charging lion — so pick your moment" : "Build a longer jump"}</small></span>
                      </div>
                    )}
                    <div className="field-tip">
                      <span aria-hidden="true">✦</span>
                      <p>
                        <b>FIELD TIP</b>{" "}
                        {byCourse(
                          activeCourse,
                          "Every transfer starts with SPACE. Steer toward the next rope, then hold Z to catch it.",
                          "Spike damage is cumulative. Jumping clear pauses the meter, but every later fall continues from the saved damage.",
                          "Eagles only take what is raised above your head. Fruit never scares them — eat it with Z for health, or drop it and grab a rodent.",
                          "Stand at the rear of a back before a short hop, or it lands in the next mouth. Hold Z until the meter is green, then SPACE for a long jump straight to the next back.",
                          "Stepping on a snake and hopping straight back to your root is always safe — use it to peek at every snake in the maze, then memorize the way.",
                          "Watch the WALL mark on the stilt meter: above it you can climb out, below it you can't. Pigs only bite planted stilts, and the top of a boulder is out of their reach — rest there until the pig wanders off, then run.",
                          "No log ever beats the current — spinning only slows how fast you sink. When the DISTANCE TO FALLS meter runs low, don't try to spin your way up: aim a jump at a higher log and HOP up to it. Nothing lines the jump up for you, so pick your moment.",
                          "Hanging from a branch is NOT safe — the lion leaps and pulls you down, so always follow the jump with ↑. Go when the lion is looking away AND is not between you and your next tree: a lion that walks off to the next tree will turn round right when you get there. A lion that has stopped is about to look around.",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <button className="primary-button" onClick={beginCourse} type="button">
                  <span>
                    {hasStarted
                      ? "RESUME COURSE"
                      : byCourse(activeCourse, "BEGIN CROSSING", "BEGIN THE CLIMB", "BRAVE THE SKIES", "HOP THE RIVER", "ENTER THE TANGLE", "BRAVE THE VALLEY", "RIDE THE LOGS", "FACE THE LION")}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          {overlay === "gameover" && (
            <div className="game-overlay result-overlay" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
              <div className="result-card">
                <span className="result-icon" aria-hidden="true">{byCourse(activeCourse, "〰", "▲", "▼", "💦", "〽", "🐗", riverLoss === "waterfall" ? "🌊" : "🐟", "🦁")}</span>
                <p className="eyebrow">THE JUNGLE GOT YOU</p>
                <h2 id="gameover-title">
                  {byCourse(
                    activeCourse,
                    "Splash! Try the timing again.",
                    "Time’s up—the spikes got you.",
                    eagleLoss === "health"
                      ? "The talons wore you down."
                      : "Carried off into the sky!",
                    hippoLoss === "mouth"
                      ? "Right into the mouth!"
                      : hippoLoss === "shake"
                        ? "Shaken off the head!"
                        : hippoLoss === "dive"
                          ? "The hippo dove under!"
                          : "Splash! Missed the hippo.",
                    snakeLoss === "instant"
                      ? "That snake was already awake!"
                      : "Too slow — bitten!",
                    pigLoss === "trapped"
                      ? "Too short to climb out!"
                      : "The pigs chewed through your stilts!",
                    riverLoss === "waterfall"
                      ? "You fell down the waterfall… too bad!"
                      : "You became piranha lunch… ouch!",
                    lionLoss === "hanging"
                      ? "Pulled off the branch!"
                      : "The lion caught you in the open!",
                  )}
                </h2>
                <p>
                  {byCourse(
                    activeCourse,
                    "Watch the first vine, jump toward any part of it, then keep Z pressed to hang on.",
                    "Every spike landing adds to the same one-second damage meter. Use the branches to clear both barriers and avoid repeated falls.",
                    eagleLoss === "health"
                      ? "Every catch costs health. Feed the eagles rodents instead, and eat fruit with Z to recover."
                      : "Three seconds in the talons is too long. Mash SPACE faster — or better, raise a rodent with Z before the eagle arrives.",
                    hippoLoss === "mouth"
                      ? "The mouth is never safe. Hop from the very edge of the bank or the rear of a back to reach the head, or charge a long jump to the back."
                      : hippoLoss === "shake"
                        ? "Heads shake fast. Hop straight onto the back the moment you land on a head."
                        : hippoLoss === "dive"
                          ? "Backs are patient, not endless. Watch for bubbles and ripples, and jump before the hippo sinks."
                          : "Watch where the arc ends. Charge the long jump until the meter is green, and never jump from the front of a back.",
                    snakeLoss === "instant"
                      ? "While the snakes are awake, every snake bites on contact. From a snake, only hop onto a root — or straight back to where you came from."
                      : "A woken snake bites in a blink. Hop off the moment you land on one, and remember which bands showed their heads. The maze stays the same when you retry.",
                    pigLoss === "trapped"
                      ? "Every bite chews the stilts shorter, and once they're shorter than the valley wall there is no way up. Keep the meter above the WALL mark: run, vault early, and rest on a rock when a pig is right under you."
                      : "The stilts only take so many bites. Hold X to run, hop or vault to lift the legs clear, and never stand still on the floor — a boulder you haven't vaulted yet is where the pigs catch you.",
                    riverLoss === "waterfall"
                      ? "The current always wins — no log climbs, it only slows the fall. Before the DISTANCE TO FALLS meter runs out, aim a jump at a higher log and HOP up. You can't spin your way back up."
                      : "Only jump when you can see a log to land on, and steer the leap with the arrows all the way onto it. Leap into open water and the piranhas are waiting.",
                    lionLoss === "hanging"
                      ? "Catching the branch is only half the move — a lion can leap at anyone hanging. Press ↑ the moment you catch it, and don't run for a tree the lion is already heading to."
                      : "The lion charges anything it sees on the ground, and it runs faster than you. Only leave cover while it is looking away and isn't between you and the next tree — and never run toward it.",
                  )}
                </p>
                <button className="primary-button compact" onClick={restartCourse} type="button">
                  TRY AGAIN <span aria-hidden="true">↻</span>
                </button>
              </div>
            </div>
          )}

          {overlay === "won" && (
            <div className="game-overlay result-overlay win-overlay" role="dialog" aria-modal="true" aria-labelledby="win-title">
              <div className="result-card">
                <span className="result-icon gold" aria-hidden="true">✦</span>
                <p className="eyebrow">{activeCourse === 8 ? "EXPEDITION COMPLETE" : `COURSE 0${activeCourse} COMPLETE`}</p>
                <h2 id="win-title">{activeCourse === 8 ? "The Golden Pumpkin is found!" : "Both explorers made it across!"}</h2>
                <p>
                  {byCourse(
                    activeCourse,
                    "The trail rises into four ancient trees where a troop of capuchins guards every branch.",
                    "The monkeys are dizzy and the far trail is safe. Past the trees, hawk-eagles circle a sunny clearing.",
                    "The eagles are fed and the trail winds on. Downriver, four hippos wallow across the only ford.",
                    "Four hippos hopped and not a splash. Deeper in, the forest floor is a tangle of roots and sleeping snakes.",
                    "Twenty rows of vipers and not one bite. Beyond the trees the ground drops into a valley where wild pigs root and squeal.",
                    "Up and over the far wall with wood to spare, and not a single boar caught you. Ahead, the trail is cut by a wide river racing toward a waterfall.",
                    "Across the river without a splash — the piranhas go hungry and the waterfall roars behind you. One last guardian stands between you and the Golden Pumpkin.",
                    "The lion never laid a paw on you. Guto and Nanda lift the Golden Pumpkin from its shrine, and its light spills back across the savanna, the river, the valley, and every tree of the jungle. Eight guardians, one golden prize — the expedition is complete.",
                  )}
                </p>
                <div className="result-actions">
                  {activeCourse === 1 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(2)} type="button">
                      PLAY COURSE 02 <span aria-hidden="true">→</span>
                    </button>
                  ) : activeCourse === 2 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(3)} type="button">
                      PLAY COURSE 03 <span aria-hidden="true">→</span>
                    </button>
                  ) : activeCourse === 3 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(4)} type="button">
                      PLAY COURSE 04 <span aria-hidden="true">→</span>
                    </button>
                  ) : activeCourse === 4 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(5)} type="button">
                      PLAY COURSE 05 <span aria-hidden="true">→</span>
                    </button>
                  ) : activeCourse === 5 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(6)} type="button">
                      PLAY COURSE 06 <span aria-hidden="true">→</span>
                    </button>
                  ) : activeCourse === 6 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(7)} type="button">
                      PLAY COURSE 07 <span aria-hidden="true">→</span>
                    </button>
                  ) : activeCourse === 7 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(8)} type="button">
                      PLAY COURSE 08 <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button compact" onClick={() => selectCourse(1)} type="button">
                      PLAY AGAIN FROM COURSE 01 <span aria-hidden="true">↻</span>
                    </button>
                  )}
                  <button className="secondary-button" onClick={restartCourse} type="button">REPLAY</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="touch-controls" aria-label="Touch game controls">
          <div>
            <button
              onPointerDown={() => pressControl("ArrowLeft")}
              onPointerUp={() => releaseControl("ArrowLeft")}
              onPointerCancel={() => releaseControl("ArrowLeft")}
              onPointerLeave={() => releaseControl("ArrowLeft")}
              aria-label="Move left"
              type="button"
            >←</button>
            <button
              onPointerDown={() => pressControl("ArrowRight")}
              onPointerUp={() => releaseControl("ArrowRight")}
              onPointerCancel={() => releaseControl("ArrowRight")}
              onPointerLeave={() => releaseControl("ArrowRight")}
              aria-label="Move right"
              type="button"
            >→</button>
            {(activeCourse === 1 || activeCourse === 5 || activeCourse === 7 || activeCourse === 8) && (
              <>
                <button
                  onPointerDown={() => pressControl("ArrowUp")}
                  onPointerUp={() => releaseControl("ArrowUp")}
                  onPointerCancel={() => releaseControl("ArrowUp")}
                  onPointerLeave={() => releaseControl("ArrowUp")}
                  aria-label="Climb up"
                  type="button"
                >↑</button>
                <button
                  onPointerDown={() => pressControl("ArrowDown")}
                  onPointerUp={() => releaseControl("ArrowDown")}
                  onPointerCancel={() => releaseControl("ArrowDown")}
                  onPointerLeave={() => releaseControl("ArrowDown")}
                  aria-label="Climb down"
                  type="button"
                >↓</button>
              </>
            )}
          </div>
          <div>
            <button
              className="grab-touch"
              onPointerDown={() => pressControl(activeCourse === 2 || activeCourse === 6 || activeCourse === 8 ? "KeyX" : activeCourse === 5 ? "ArrowLeft" : activeCourse === 7 ? "ArrowUp" : "KeyZ")}
              onPointerUp={() => releaseControl(activeCourse === 2 || activeCourse === 6 || activeCourse === 8 ? "KeyX" : activeCourse === 5 ? "ArrowLeft" : activeCourse === 7 ? "ArrowUp" : "KeyZ")}
              onPointerCancel={() => releaseControl(activeCourse === 2 || activeCourse === 6 || activeCourse === 8 ? "KeyX" : activeCourse === 5 ? "ArrowLeft" : activeCourse === 7 ? "ArrowUp" : "KeyZ")}
              onPointerLeave={() => releaseControl(activeCourse === 2 || activeCourse === 6 || activeCourse === 8 ? "KeyX" : activeCourse === 5 ? "ArrowLeft" : activeCourse === 7 ? "ArrowUp" : "KeyZ")}
              aria-label={byCourse(activeCourse, "Grab and hold vine", "Run", "Raise rodent or eat fruit", "Hold to charge a long jump", "Hop back a row", "Run to outrun the pigs", "Aim your hop upstream", "Run across the savanna")}
              type="button"
            >{byCourse(activeCourse, "GRAB", "RUN", "RAISE", "CHARGE", "BACK", "RUN", "UP ↑", "RUN")}</button>
            <button
              className="jump-touch"
              onPointerDown={tapJump}
              aria-label={byCourse(activeCourse, "Jump or release vine", "Jump or stomp", "Grab, drop, or struggle", "Hop, or leap while charging", "Hop forward a row", "Vault over a boulder", "Hop to a log", "Jump for a branch, or let go")}
              type="button"
            >{activeCourse === 3 ? "GRAB" : activeCourse === 5 ? "HOP" : activeCourse === 6 ? "VAULT" : activeCourse === 7 ? "HOP" : "JUMP"}</button>
          </div>
        </div>
      </section>

      <section className="quick-controls" aria-label="Quick controls reminder">
        {activeCourse === 1 ? (
          <>
            <div><kbd>←→</kbd><kbd>↑↓</kbd><span><b>MOVE / CLIMB</b> Arrow keys</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>JUMP FIRST</b> Launch between vines</span></div>
            <div><kbd className="long accent">Z</kbd><span><b>KEEP HOLDING</b> Grab any part of a vine</span></div>
            <div><kbd className="long">X</kbd><span><b>RUN</b> Jump farther</span></div>
          </>
        ) : activeCourse === 2 ? (
          <>
            <div><kbd>←→</kbd><span><b>MOVE / STEER</b> Control every leap</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>JUMP / STOMP</b> Land on monkey heads</span></div>
            <div><kbd className="long accent">1 SEC</kbd><span><b>TOTAL DAMAGE</b> Every fall adds up</span></div>
            <div><kbd className="long">X</kbd><span><b>RUN</b> Cross wider gaps</span></div>
          </>
        ) : activeCourse === 3 ? (
          <>
            <div><kbd>←→</kbd><span><b>MOVE</b> Chase down rodents</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>GRAB / MASH</b> Pick up, drop, break free</span></div>
            <div><kbd className="long accent">Z</kbd><span><b>RAISE OVERHEAD</b> Eagles take the rodent</span></div>
            <div><kbd className="long">3 SEC</kbd><span><b>IN THE TALONS</b> Escape before it’s too late</span></div>
          </>
        ) : activeCourse === 4 ? (
          <>
            <div><kbd>←→</kbd><span><b>WALK</b> Edge of the bank, rear of a back</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>SHORT HOP</b> Mouth or head, then the back</span></div>
            <div><kbd className="long accent">Z + SPACE</kbd><span><b>LONG JUMP</b> Charge, then leap to the next back</span></div>
            <div><kbd className="long">MOUTH</kbd><span><b>NEVER SAFE</b> Heads shake, backs dive</span></div>
          </>
        ) : activeCourse === 5 ? (
          <>
            <div><kbd>←→</kbd><span><b>HOP A ROW</b> Forward or back, one row only</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>HOP FORWARD</b> Same as →</span></div>
            <div><kbd className="long accent">↑↓</kbd><span><b>WALK THE ROOT</b> Roots are always safe</span></div>
            <div><kbd className="long">BLINK</kbd><span><b>SNAKES BITE</b> Hop off the instant you land</span></div>
          </>
        ) : activeCourse === 6 ? (
          <>
            <div><kbd>←→</kbd><span><b>MOVE</b> Drop in, cross the floor on stilts</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>HOP</b> Lift the stilts clear of a bite</span></div>
            <div><kbd className="long accent">Z + SPACE</kbd><span><b>VAULT</b> Clear the boulders with a run-up</span></div>
            <div><kbd className="long">WALL</kbd><span><b>STILTS SHRINK</b> Below the mark you can’t climb out</span></div>
          </>
        ) : activeCourse === 7 ? (
          <>
            <div><kbd>←→</kbd><span><b>SPIN / WALK</b> Spin the log, or walk the bank</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>HOP</b> Aim &amp; steer onto a log</span></div>
            <div><kbd className="long accent">↑↓</kbd><span><b>STEER THE JUMP</b> Guide the leap in the air</span></div>
            <div><kbd className="long">FALLS</kbd><span><b>THE CURRENT WINS</b> Hop UP before you sink</span></div>
          </>
        ) : (
          <>
            <div><kbd>←→</kbd><span><b>RUN</b> Only while the lion looks away</span></div>
            <div><kbd className="long accent">SPACE + ↑</kbd><span><b>CLIMB A BRANCH</b> Jump to catch it, ↑ to be safe</span></div>
            <div><kbd className="long">↓ + SPACE</kbd><span><b>GET DOWN</b> Hang first, then let go</span></div>
            <div><kbd className="long">GAZE</kbd><span><b>THE LION CHARGES</b> Whatever it can see</span></div>
          </>
        )}
      </section>

      <section className="expedition-section" id="expedition">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE EXPEDITION</p>
            <h2>Eight guardians. One golden prize.</h2>
          </div>
          <p>
            Every course introduces a new animal, a new rule, and a new way for
            Guto and Nanda to work with the jungle instead of fighting it.
          </p>
        </div>

        <div className="course-grid">
          {courses.map((course, index) => (
            <button
              className={`course-card ${index === activeCourse - 1 ? "current" : ""}`}
              disabled={index > 7}
              key={course.number}
              onClick={() => selectCourse((index + 1) as CourseNumber)}
              type="button"
              aria-label={`Play course ${course.number}: ${course.title}`}
            >
              <div className="course-card-top">
                <span className="course-number">{course.number}</span>
                <span className="animal-icon" aria-hidden="true">{course.icon}</span>
                <span className={`status-tag status-${index}`}>{course.status}</span>
              </div>
              <p>{course.animal.toUpperCase()} · {course.skill.toUpperCase()}</p>
              <h3>{course.title}</h3>
              <div className="card-rule" />
              <span className="course-description">{course.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="treasure-tease">
        <div className="pumpkin-orbit" aria-hidden="true">
          <span>✦</span><span>✦</span><div>🎃</div>
        </div>
        <div>
          <p className="eyebrow">THE LEGEND</p>
          <h2>Somewhere above the clouds,<br />the Golden Pumpkin is waiting.</h2>
          <p>Complete all eight courses to bring its light back to the jungle.</p>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span><strong>Guto &amp; Nanda</strong><small>and the Golden Pumpkin</small></span>
        </div>
        <p>A two-player spirit, one-player-at-a-time jungle adventure.</p>
        <a href="#game">BACK TO COURSE ↑</a>
      </footer>
    </main>
  );
}
