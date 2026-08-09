"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Character = "guto" | "nanda";
type Overlay = "briefing" | "gameover" | "won" | null;

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
};

type GameState = {
  player: Player;
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

const vines: Vine[] = [
  { x: 335, y: 58, length: 320, phase: 0.2, amplitude: 0.68 },
  { x: 620, y: 72, length: 298, phase: 2.28, amplitude: 0.72 },
  { x: 900, y: 54, length: 324, phase: 4.42, amplitude: 0.67 },
];

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
    animal: "Jaguar",
    title: "The Jaguar’s Gaze",
    skill: "Hide & listen",
    icon: "🐆",
    status: "NEXT",
    description: "Move between giant ferns only when the jungle hunter looks away.",
  },
  {
    number: "03",
    animal: "Anaconda",
    title: "Coils in the Ruins",
    skill: "Sneak & sprint",
    icon: "🐍",
    status: "PLANNED",
    description: "Read the sleeping snake’s rhythm, then dash across the warm stones.",
  },
  {
    number: "04",
    animal: "Spider",
    title: "The Silver Web",
    skill: "Bounce & cut",
    icon: "🕷️",
    status: "PLANNED",
    description: "Use springy webs as trampolines and snip the right silk gates.",
  },
  {
    number: "05",
    animal: "Capuchin",
    title: "Monkey Mischief",
    skill: "Catch & rebuild",
    icon: "🐒",
    status: "PLANNED",
    description: "Catch the stolen bridge pegs and outsmart the playful troop.",
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

function makeGame(): GameState {
  return {
    player: {
      x: 125,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      facing: 1,
      attachedVine: null,
      vineRatio: 0.9,
      climbMotion: 0,
      canGrab: false,
      grabCooldown: 0,
      onGround: true,
    },
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

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(makeGame());
  const keysRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const [overlay, setOverlay] = useState<Overlay>("briefing");
  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<Character>("guto");
  const [soundOn, setSoundOn] = useState(true);
  const [vineStatus, setVineStatus] = useState("Jump first, then hold Z");

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
    const fresh = makeGame();
    fresh.running = true;
    gameRef.current = fresh;
    setVineStatus("Jump first, then hold Z");
  }, []);

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
            setVineStatus("Z released — falling!");
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
              setVineStatus(
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
          setVineStatus("Course clear!");
          playTone(784, 0.16, "triangle");
          window.setTimeout(() => playTone(1046, 0.22, "triangle"), 120);
        }

        statusTimer += dt;
        if (statusTimer > 0.5 && player.attachedVine === null && !game.won) {
          statusTimer = 0;
          setVineStatus(
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
        game.elapsed += dt * 0.35;
      }

      drawWorld(context, game, activeCharacter);
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
        if (player.attachedVine !== null) {
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
          setVineStatus("Jumped — steer, then grab the next vine!");
          playTone(440, 0.08, "square");
        } else if (player.onGround) {
          player.vy = -520;
          player.onGround = false;
          player.canGrab = true;
          setVineStatus("Jumped — hold Z when the vine is close");
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
    if (player.attachedVine !== null) {
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
      setVineStatus("Jumped — steer, then grab the next vine!");
      playTone(440, 0.08, "square");
    } else if (player.onGround) {
      player.vy = -520;
      player.onGround = false;
      player.canGrab = true;
      setVineStatus("Jumped — hold Z when the vine is close");
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
              autoFocus
              onClick={() => {
                setShowTitleScreen(false);
                playTone(523, 0.12, "triangle");
              }}
              type="button"
            >
              <span>ENTER THE JUNGLE</span>
              <span aria-hidden="true">→</span>
            </button>
            <small>COURSE 01 READY · THE CROCODILE CANAL</small>
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
        <div className="header-progress" aria-label="Course progress: one of eight">
          <span>EXPEDITION</span>
          <div className="progress-dots" aria-hidden="true">
            {courses.map((course, index) => (
              <i className={index === 0 ? "active" : ""} key={course.number} />
            ))}
          </div>
          <b>01 / 08</b>
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
          <p className="eyebrow">COURSE 01 · CROCODILE TERRITORY</p>
          <h1>The Crocodile Canal</h1>
        </div>
        <p className="intro-copy">
          The trail disappears beneath the water. Time the swing, trust your
          partner, and don’t look down.
        </p>
      </section>

      <section className="game-shell" aria-label="The Crocodile Canal game">
        <div className="game-hud">
          <div className="hud-item">
            <span>EXPLORER</span>
            <b>{activeCharacter === "guto" ? "Guto" : "Nanda"}</b>
          </div>
          <div className="hud-status" aria-live="polite">
            <span className="pulse-dot" />
            {vineStatus}
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
            aria-label="A side-scrolling jungle course. Cross the crocodile-filled canal by jumping and grabbing three swinging vines."
          />

          {overlay === "briefing" && (
            <div className="game-overlay briefing-overlay" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
              <div className="briefing-card">
                <div className="briefing-topline">
                  <span>FIELD BRIEFING · 01</span>
                  <span className="danger-label">● CROCODILES ACTIVE</span>
                </div>
                <div className="briefing-grid">
                  <div className="briefing-copy">
                    <p className="eyebrow">YOUR MISSION</p>
                    <h2 id="briefing-title">Swing across.<br />Stay out of the water.</h2>
                    <p>
                      Wait for a vine to sweep close, <strong>jump first</strong>, then
                      hold <strong>Z</strong> to catch any part of the rope. Keep Z
                      pressed, climb with ↑↓, and jump before catching the next vine.
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
                      <span className="key-pair"><kbd>←→</kbd><kbd>↑↓</kbd></span>
                      <span><b>Move / climb</b><small>Steer in air, climb on a vine</small></span>
                    </div>
                    <div className="control-row">
                      <span className="wide-key"><kbd>SPACE</kbd></span>
                      <span><b>Jump / release</b><small>Leap at the swing’s edge</small></span>
                    </div>
                    <div className="control-row important-control">
                      <span className="wide-key"><kbd>Z</kbd></span>
                      <span><b>Grab &amp; keep holding</b><small>Release Z and you fall</small></span>
                    </div>
                    <div className="control-row">
                      <span className="wide-key"><kbd>X</kbd></span>
                      <span><b>Run</b><small>Build a longer jump</small></span>
                    </div>
                    <div className="field-tip">
                      <span aria-hidden="true">✦</span>
                      <p><b>FIELD TIP</b> Every transfer starts with SPACE. Steer toward the next rope, then hold Z to catch it.</p>
                    </div>
                  </div>
                </div>
                <button className="primary-button" onClick={beginCourse} type="button">
                  <span>{hasStarted ? "RESUME COURSE" : "BEGIN CROSSING"}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          {overlay === "gameover" && (
            <div className="game-overlay result-overlay" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
              <div className="result-card">
                <span className="result-icon" aria-hidden="true">〰</span>
                <p className="eyebrow">THE JUNGLE GOT YOU</p>
                <h2 id="gameover-title">Splash! Try the timing again.</h2>
                <p>Watch the first vine, jump toward any part of it, then keep Z pressed to hang on.</p>
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
                <p className="eyebrow">COURSE 01 COMPLETE</p>
                <h2 id="win-title">Both explorers made it across!</h2>
                <p>The jungle trail continues toward the Jaguar’s Gaze. Seven animal guardians remain.</p>
                <div className="result-actions">
                  <button className="primary-button compact" onClick={() => document.querySelector("#expedition")?.scrollIntoView({ behavior: "smooth" })} type="button">
                    VIEW EXPEDITION <span aria-hidden="true">↓</span>
                  </button>
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
          </div>
          <div>
            <button
              className="grab-touch"
              onPointerDown={() => pressControl("KeyZ")}
              onPointerUp={() => releaseControl("KeyZ")}
              onPointerCancel={() => releaseControl("KeyZ")}
              onPointerLeave={() => releaseControl("KeyZ")}
              aria-label="Grab and hold vine"
              type="button"
            >GRAB</button>
            <button className="jump-touch" onPointerDown={tapJump} aria-label="Jump or release vine" type="button">JUMP</button>
          </div>
        </div>
      </section>

      <section className="quick-controls" aria-label="Quick controls reminder">
        <div><kbd>←→</kbd><kbd>↑↓</kbd><span><b>MOVE / CLIMB</b> Arrow keys</span></div>
        <div><kbd className="long">SPACE</kbd><span><b>JUMP FIRST</b> Launch between vines</span></div>
        <div><kbd className="long accent">Z</kbd><span><b>KEEP HOLDING</b> Grab any part of a vine</span></div>
        <div><kbd className="long">X</kbd><span><b>RUN</b> Jump farther</span></div>
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
            <article className={`course-card ${index === 0 ? "current" : ""}`} key={course.number}>
              <div className="course-card-top">
                <span className="course-number">{course.number}</span>
                <span className="animal-icon" aria-hidden="true">{course.icon}</span>
                <span className={`status-tag status-${index}`}>{course.status}</span>
              </div>
              <p>{course.animal.toUpperCase()} · {course.skill.toUpperCase()}</p>
              <h3>{course.title}</h3>
              <div className="card-rule" />
              <span className="course-description">{course.description}</span>
            </article>
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
