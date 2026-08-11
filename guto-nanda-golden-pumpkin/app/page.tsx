"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Character = "guto" | "nanda";
type Overlay = "briefing" | "gameover" | "won" | null;
type CourseNumber = 1 | 2;

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
    animal: "Jaguar",
    title: "The Jaguar’s Gaze",
    skill: "Hide & listen",
    icon: "🐆",
    status: "PLANNED",
    description: "Move between giant ferns only when the jungle hunter looks away.",
  },
  {
    number: "04",
    animal: "Anaconda",
    title: "Coils in the Ruins",
    skill: "Sneak & sprint",
    icon: "🐍",
    status: "PLANNED",
    description: "Read the sleeping snake’s rhythm, then dash across the warm stones.",
  },
  {
    number: "05",
    animal: "Spider",
    title: "The Silver Web",
    skill: "Bounce & cut",
    icon: "🕷️",
    status: "PLANNED",
    description: "Use springy webs as trampolines and snip the right silk gates.",
  },
  {
    number: "06",
    animal: "Toucan",
    title: "Canopy Chorus",
    skill: "Listen & repeat",
    icon: "🦜",
    status: "PLANNED",
    description: "Repeat the toucans’ call to reveal a hidden path through the leaves.",
  },
  {
    number: "07",
    animal: "Gorilla",
    title: "The Gentle Giant",
    skill: "Roll & share",
    icon: "🦍",
    status: "PLANNED",
    description: "Roll fruit onto feeding platforms to clear a peaceful way forward.",
  },
  {
    number: "08",
    animal: "Harpy Eagle",
    title: "The Golden Nest",
    skill: "Climb & glide",
    icon: "🦅",
    status: "FINALE",
    description: "Ride the canopy gusts and recover the Golden Pumpkin from the nest.",
  },
];

function makeGame(course: CourseNumber = 1): GameState {
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
      x: 125,
      y: course === 1 ? GROUND_Y : MONKEY_GROUND_Y,
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
  | "wave";

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
  const running = motion === "run";
  const hanging = motion === "hang" || motion === "climb";
  const cycle =
    elapsed *
    (running ? 7.2 + Math.min(Math.abs(speed), 320) * 0.018 : motion === "climb" ? 6 : 2.2);
  const bob = running
    ? Math.abs(Math.sin(cycle)) * 2.4
    : motion === "idle" || motion === "wave"
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

  if (motion === "idle" || motion === "run" || motion === "wave") {
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

  const gazeY = hanging || motion === "jump" ? -1.2 : motion === "fall" ? 1.2 : 0;
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

  useEffect(() => {
    soundEnabledRef.current = soundOn;
  }, [soundOn]);

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
    const fresh = makeGame(activeCourse);
    fresh.running = true;
    gameRef.current = fresh;
    setCourseStatus(
      activeCourse === 1
        ? "Jump first, then hold Z"
        : "Reach the far side — stomp monkeys to stun them",
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
    gameRef.current = makeGame(course);
    setCourseStatus(
      course === 1
        ? "Jump first, then hold Z"
        : "Reach the far side — stomp monkeys to stun them",
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
        } else {
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
        }
      } else {
        game.elapsed += dt * 0.35;
      }

      if (game.course === 1) drawWorld(context, game, activeCharacter);
      else drawMonkeyWorld(context, game, activeCharacter);
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
      if (event.code === "Space" && !event.repeat && game.running) {
        const player = game.player;
        if (game.course === 2 && player.onGround) {
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
    if (game.course === 2 && player.onGround) {
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
            <small>COURSES 01–02 READY · TWO JUNGLE CHALLENGES</small>
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
          </div>
          <p className="eyebrow">
            {activeCourse === 1
              ? "COURSE 01 · CROCODILE TERRITORY"
              : "COURSE 02 · CAPUCHIN CANOPY"}
          </p>
          <h1>
            {activeCourse === 1
              ? "The Crocodile Canal"
              : "The Pushing Monkeys"}
          </h1>
        </div>
        <p className="intro-copy">
          {activeCourse === 1
            ? "The trail disappears beneath the water. Time the swing, trust your partner, and don’t look down."
            : "Four ancient trees guard the trail. Climb over both barriers, dodge the capuchins, and keep total spike damage below one second."}
        </p>
      </section>

      <section
        className="game-shell"
        aria-label={activeCourse === 1 ? "The Crocodile Canal game" : "The Pushing Monkeys game"}
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
            aria-label={
              activeCourse === 1
                ? "A side-scrolling jungle course. Cross the crocodile-filled canal by jumping and grabbing three swinging vines."
                : "A side-scrolling treetop course. Cross four layered trees and two barriers before cumulative spike damage reaches one second."
            }
          />

          {overlay === "briefing" && (
            <div className="game-overlay briefing-overlay" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
              <div className="briefing-card">
                <div className="briefing-topline">
                  <span>FIELD BRIEFING · 0{activeCourse}</span>
                  <span className="danger-label">
                    {activeCourse === 1 ? "● CROCODILES ACTIVE" : "● MONKEY PATROLS ACTIVE"}
                  </span>
                </div>
                <div className="briefing-grid">
                  <div className="briefing-copy">
                    <p className="eyebrow">YOUR MISSION</p>
                    <h2 id="briefing-title">
                      {activeCourse === 1 ? (
                        <>Swing across.<br />Stay out of the water.</>
                      ) : (
                        <>Climb all four trees.<br />Don’t get pushed.</>
                      )}
                    </h2>
                    <p>
                      {activeCourse === 1 ? (
                        <>Wait for a vine to sweep close, <strong>jump first</strong>, then
                        hold <strong>Z</strong> to catch any part of the rope. Keep Z
                        pressed, climb with ↑↓, and jump before catching the next vine.</>
                      ) : (
                        <>Jump from branch to branch across the four tall trees. Monkeys
                        chase you on their layer and will <strong>push you toward the spikes</strong>.
                        Land on a monkey’s head to leave it dizzy long enough to escape.</>
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
                      <span className="key-pair"><kbd>←→</kbd>{activeCourse === 1 && <kbd>↑↓</kbd>}</span>
                      <span>
                        <b>{activeCourse === 1 ? "Move / climb" : "Move / steer"}</b>
                        <small>{activeCourse === 1 ? "Steer in air, climb on a vine" : "Control every jump in the air"}</small>
                      </span>
                    </div>
                    <div className="control-row">
                      <span className="wide-key"><kbd>SPACE</kbd></span>
                      <span>
                        <b>{activeCourse === 1 ? "Jump / release" : "Jump / stomp"}</b>
                        <small>{activeCourse === 1 ? "Leap at the swing’s edge" : "Land on monkeys to make them dizzy"}</small>
                      </span>
                    </div>
                    {activeCourse === 1 && (
                      <div className="control-row important-control">
                        <span className="wide-key"><kbd>Z</kbd></span>
                        <span><b>Grab &amp; keep holding</b><small>Release Z and you fall</small></span>
                      </div>
                    )}
                    <div className="control-row">
                      <span className="wide-key"><kbd>X</kbd></span>
                      <span><b>Run</b><small>Build a longer jump</small></span>
                    </div>
                    <div className="field-tip">
                      <span aria-hidden="true">✦</span>
                      <p>
                        <b>FIELD TIP</b>{" "}
                        {activeCourse === 1
                          ? "Every transfer starts with SPACE. Steer toward the next rope, then hold Z to catch it."
                          : "Spike damage is cumulative. Jumping clear pauses the meter, but every later fall continues from the saved damage."}
                      </p>
                    </div>
                  </div>
                </div>
                <button className="primary-button" onClick={beginCourse} type="button">
                  <span>
                    {hasStarted
                      ? "RESUME COURSE"
                      : activeCourse === 1
                        ? "BEGIN CROSSING"
                        : "BEGIN THE CLIMB"}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          {overlay === "gameover" && (
            <div className="game-overlay result-overlay" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
              <div className="result-card">
                <span className="result-icon" aria-hidden="true">{activeCourse === 1 ? "〰" : "▲"}</span>
                <p className="eyebrow">THE JUNGLE GOT YOU</p>
                <h2 id="gameover-title">
                  {activeCourse === 1
                    ? "Splash! Try the timing again."
                    : "Time’s up—the spikes got you."}
                </h2>
                <p>
                  {activeCourse === 1
                    ? "Watch the first vine, jump toward any part of it, then keep Z pressed to hang on."
                    : "Every spike landing adds to the same one-second damage meter. Use the branches to clear both barriers and avoid repeated falls."}
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
                <p className="eyebrow">COURSE 0{activeCourse} COMPLETE</p>
                <h2 id="win-title">Both explorers made it across!</h2>
                <p>
                  {activeCourse === 1
                    ? "The trail rises into four ancient trees where a troop of capuchins guards every branch."
                    : "The monkeys are dizzy and the far trail is safe. The Jaguar’s Gaze waits deeper in the jungle."}
                </p>
                <div className="result-actions">
                  {activeCourse === 1 ? (
                    <button className="primary-button compact" onClick={() => selectCourse(2)} type="button">
                      PLAY COURSE 02 <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button compact" onClick={() => document.querySelector("#expedition")?.scrollIntoView({ behavior: "smooth" })} type="button">
                      VIEW EXPEDITION <span aria-hidden="true">↓</span>
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
            {activeCourse === 1 && (
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
              onPointerDown={() => pressControl(activeCourse === 1 ? "KeyZ" : "KeyX")}
              onPointerUp={() => releaseControl(activeCourse === 1 ? "KeyZ" : "KeyX")}
              onPointerCancel={() => releaseControl(activeCourse === 1 ? "KeyZ" : "KeyX")}
              onPointerLeave={() => releaseControl(activeCourse === 1 ? "KeyZ" : "KeyX")}
              aria-label={activeCourse === 1 ? "Grab and hold vine" : "Run"}
              type="button"
            >{activeCourse === 1 ? "GRAB" : "RUN"}</button>
            <button className="jump-touch" onPointerDown={tapJump} aria-label="Jump or release vine" type="button">JUMP</button>
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
        ) : (
          <>
            <div><kbd>←→</kbd><span><b>MOVE / STEER</b> Control every leap</span></div>
            <div><kbd className="long">SPACE</kbd><span><b>JUMP / STOMP</b> Land on monkey heads</span></div>
            <div><kbd className="long accent">1 SEC</kbd><span><b>TOTAL DAMAGE</b> Every fall adds up</span></div>
            <div><kbd className="long">X</kbd><span><b>RUN</b> Cross wider gaps</span></div>
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
              disabled={index > 1}
              key={course.number}
              onClick={() => selectCourse((index + 1) as CourseNumber)}
              type="button"
              aria-label={index < 2 ? `Play course ${course.number}: ${course.title}` : `${course.title} is planned`}
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
