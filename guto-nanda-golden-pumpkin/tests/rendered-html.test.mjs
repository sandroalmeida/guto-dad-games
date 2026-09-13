import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Golden Pumpkin game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Guto &amp; Nanda and the Golden Pumpkin<\/title>/i);
  assert.match(html, /The Crocodile Canal/);
  assert.match(html, /The Pushing Monkeys/);
  assert.match(html, /The Diving Eagles/);
  assert.match(html, /The Hippo Crossing/);
  assert.match(html, /The Sleeping Snakes/);
  assert.match(html, /The Wild Pig Valley/);
  assert.match(html, /The Piranha River/);
  assert.match(html, /03 · EAGLES/);
  assert.match(html, /04 · HIPPOS/);
  assert.match(html, /05 · SNAKES/);
  assert.match(html, /06 · PIGS/);
  assert.match(html, /07 · PIRANHAS/);
  assert.match(html, /08 · LION/);
  assert.match(html, /The Lion(&#x27;|’|')s Watch/);
  assert.match(html, /COURSES 01–08 READY/);
  assert.match(html, /reaches one second/i);
  assert.match(html, /two barriers/i);
  assert.match(html, /Capuchin Monkeys/i);
  assert.match(html, /Hawk-Eagles/i);
  assert.match(html, /Wild Pigs/i);
  assert.match(html, /pea-leg stilts/i);
  assert.match(html, /Piranhas/i);
  assert.match(html, /floating logs?/i);
  assert.match(html, /waterfall/i);
  assert.match(html, /savanna/i);
  assert.match(html, /Golden Pumpkin/);
  assert.doesNotMatch(html, /The Golden Nest/);
  assert.doesNotMatch(html, /Harpy Eagle/);
  assert.doesNotMatch(html, /Jaguar’s Gaze/);
  assert.doesNotMatch(html, /Coils in the Ruins/);
  assert.doesNotMatch(html, /The Silver Web/);
  assert.match(html, /Eight guardians\. One golden prize\./);
  assert.match(html, /ENTER THE JUNGLE/);
  assert.match(html, /\/og\.png/);
  assert.match(html, /jump first/i);
  assert.match(html, /<kbd[^>]*>Z<\/kbd>/i);
  assert.match(html, /<kbd[^>]*>X<\/kbd>/i);
  assert.doesNotMatch(html, /<kbd[^>]*>CTRL<\/kbd>|<kbd[^>]*>SHIFT<\/kbd>/i);
  assert.match(html, /BEGIN CROSSING/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps the crocodile canvas transform balanced", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function drawCrocodile(");
  const end = source.indexOf("\nfunction drawVine(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const renderer = source.slice(start, end);
  const saves = renderer.match(/\bctx\.save\(\);/g)?.length ?? 0;
  const restores = renderer.match(/\bctx\.restore\(\);/g)?.length ?? 0;
  assert.equal(restores, saves, "drawCrocodile must restore every saved transform");

  const crocodiles = source.match(/drawCrocodile\(ctx,/g)?.length ?? 0;
  assert.equal(crocodiles, 3, "the canal should render all three crocodiles");
});

test("builds the four-tree Pushing Monkeys challenge", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const treesStart = source.indexOf("const treeDefinitions = [");
  const treesEnd = source.indexOf("] as const;", treesStart);
  const trees = source.slice(treesStart, treesEnd).match(/\{ x:/g)?.length ?? 0;
  assert.equal(trees, 4, "course two should contain four tall trees");

  const platformsStart = source.indexOf("const monkeyPlatforms:");
  const platformsEnd = source.indexOf("];", platformsStart);
  const platforms = source
    .slice(platformsStart, platformsEnd)
    .match(/tree: \d, level: \d/g)?.length ?? 0;
  assert.equal(platforms, 12, "each tree should contain three branch layers");
  assert.match(source, /const MONKEY_SPIKE_LIMIT = 1;/);
  assert.match(source, /monkey\.dizzyTimer = 3\.4;/);
  assert.match(source, /SPIKES!.*to jump clear/);
  assert.match(source, /playerPlatform\.tree === platform\.tree/);
  assert.match(source, /monkey\.targetPlatformIndex = nextPlatformIndex/);
  assert.match(source, /Math\.sign\(distance \|\| player\.facing\) \* 150/);
  assert.match(source, /monkey\.pushCooldown > 0\.48/);

  const barriersStart = source.indexOf("const monkeyBarriers = [");
  const barriersEnd = source.indexOf("] as const;", barriersStart);
  const barriers = source
    .slice(barriersStart, barriersEnd)
    .match(/\{ x: \d+, width: \d+, top: \d+, label:/g)?.length ?? 0;
  assert.equal(barriers, 2, "the spike bed should have two route barriers");
  assert.doesNotMatch(
    source,
    /game\.spikeTimer = 0/,
    "jumping clear must not reset cumulative spike damage",
  );
});

test("wires The Diving Eagles into the page", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const course = await readFile(
    new URL("../app/eagle-course.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from "\.\/eagle-course"/);
  assert.match(source, /type CourseNumber = 1 \| 2 \| 3/);
  assert.match(source, /game\.eagle\.spacePresses \+= 1/);
  assert.match(source, /drawEagleWorld\(context, game, activeCharacter\)/);
  assert.match(source, /PLAY COURSE 03/);
  assert.match(course, /export const EAGLE_HOLD_LIMIT = 3;/);
  assert.match(course, /export const EAGLE_TALON_DAMAGE = 25;/);
  assert.match(course, /export const EAGLE_FRUIT_HEAL = 15;/);

  const profilesStart = course.indexOf("const eagleProfiles = [");
  const profilesEnd = course.indexOf("] as const;", profilesStart);
  const eagles = course.slice(profilesStart, profilesEnd).match(/\{ homeX:/g)?.length ?? 0;
  assert.equal(eagles, 3, "three eagles hunt the clearing");

  for (const renderer of ["drawEagle", "drawRodent", "drawFruit", "drawEagleWorld", "drawEagleHud"]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.notEqual(start, -1, `${renderer} should exist`);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const saves = body.match(/\bctx\.save\(\);/g)?.length ?? 0;
    const restores = body.match(/\bctx\.restore\(\);/g)?.length ?? 0;
    assert.equal(restores, saves, `${renderer} must restore every saved transform`);
  }
});

test("wires The Hippo Crossing into the page", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const course = await readFile(
    new URL("../app/hippo-course.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from "\.\/hippo-course"/);
  assert.match(source, /type CourseNumber = 1 \| 2 \| 3 \| 4/);
  assert.match(source, /game\.hippo\.jumpPresses \+= 1/);
  assert.match(source, /drawHippoWorld\(context, game, activeCharacter\)/);
  assert.match(source, /PLAY COURSE 04/);
  assert.match(course, /export const HIPPO_HEAD_LIMIT = 0\.75;/);
  assert.match(course, /export const HIPPO_BACK_LIMIT = 2\.4;/);
  assert.match(course, /export const HIPPO_SPACING = 215;/);
  assert.match(course, /for \(let index = 0; index < 4; index \+= 1\)/, "four hippos wallow in the river");

  for (const renderer of ["drawHippo", "drawHippoWorld", "drawHippoHud"]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.notEqual(start, -1, `${renderer} should exist`);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const saves = body.match(/\bctx\.save\(\);/g)?.length ?? 0;
    const restores = body.match(/\bctx\.restore\(\);/g)?.length ?? 0;
    assert.equal(restores, saves, `${renderer} must restore every saved transform`);
  }
});

test("wires The Sleeping Snakes into the page", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const course = await readFile(
    new URL("../app/snake-course.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from "\.\/snake-course"/);
  assert.match(source, /type CourseNumber = 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8;/);
  assert.match(source, /game\.snake\.pendingMove = move/);
  assert.match(source, /drawSnakeWorld\(context, game, activeCharacter\)/);
  assert.match(source, /PLAY COURSE 05/);
  assert.match(source, /snakeSeedRef\.current = Math\.floor/, "selecting the course rerolls the maze; retrying keeps it");
  assert.match(course, /export const SNAKE_COLS = 20;/);
  assert.match(course, /export const SNAKE_BITE_DELAY = 0\.65;/);
  for (const renderer of ["drawSnakeBand", "drawTopDownCharacter", "drawSnakeWorld"]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.notEqual(start, -1, `${renderer} should exist`);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const saves = body.match(/\bctx\.save\(\);/g)?.length ?? 0;
    const restores = body.match(/\bctx\.restore\(\);/g)?.length ?? 0;
    assert.equal(restores, saves, `${renderer} must restore every saved transform`);
  }
});

test("wires The Wild Pig Valley into the page", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const course = await readFile(
    new URL("../app/pig-course.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from "\.\/pig-course"/);
  assert.match(source, /type CourseNumber = 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8;/);
  assert.match(source, /game\.pig\.jumpPresses \+= 1/);
  assert.match(source, /game\.pig\.jumpWithHold = keysRef\.current\.has\("KeyZ"\)/);
  assert.match(source, /drawPigWorld\(context, game, activeCharacter\)/);
  assert.match(source, /PLAY COURSE 06/);
  assert.match(source, /06 · PIGS/);
  assert.match(course, /export const PIG_BITE_CHUNK = 11;/);
  assert.match(course, /export const PIG_VAULT_VY = -650;/);
  assert.match(course, /export const PIG_LEDGE_Y = PIG_FLOOR_Y - PIG_VALLEY_DEPTH;/, "the ledges sit above the valley floor");
  assert.match(course, /export const PIG_CLIMB_LENGTH = PIG_VALLEY_DEPTH - PIG_CLIMB_REACH;/, "stilts must reach the wall height to climb out");
  assert.match(source, /PIG_LEDGE_Y, RIVER_START_Y, LION_GROUND_Y - 40\)/, "the explorer starts on the high ground");
  assert.match(source, /canClimbOut\(field\)/, "the HUD reports whether the stilts still clear the wall");

  const bouldersStart = course.indexOf("export const pigBoulders = [");
  const bouldersEnd = course.indexOf("] as const;", bouldersStart);
  const boulders = course.slice(bouldersStart, bouldersEnd).match(/\{ x:/g)?.length ?? 0;
  assert.equal(boulders, 3, "the valley should hold three boulders");
  assert.match(course, /for \(let index = 0; index < PIG_COUNT; index \+= 1\)/, "wild pigs roam the valley");

  for (const renderer of ["drawPig", "drawStiltWalker", "drawPigBoulder", "drawPigHud", "drawPigWorld"]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.notEqual(start, -1, `${renderer} should exist`);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const saves = body.match(/\bctx\.save\(\);/g)?.length ?? 0;
    const restores = body.match(/\bctx\.restore\(\);/g)?.length ?? 0;
    assert.equal(restores, saves, `${renderer} must restore every saved transform`);
  }
});

test("wires The Piranha River into the page", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const course = await readFile(
    new URL("../app/river-course.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from "\.\/river-course"/);
  assert.match(source, /type CourseNumber = 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8;/);
  assert.match(source, /game\.river\.jumpPresses \+= 1/);
  assert.match(source, /drawRiverWorld\(context, game, activeCharacter\)/);
  assert.match(source, /07 · PIRANHAS/);
  assert.match(source, /stepRiverCourse\(river, player, \{ moveX: move, moveY:/);
  assert.match(course, /export const RIVER_CURRENT = 62;/);
  assert.match(course, /export const RIVER_MIN_DRIFT = 40;/);
  assert.match(course, /export const RIVER_WATERFALL_Y = 556;/);
  assert.match(course, /lossReason: RiverLossReason \| null;/);
  // The current always wins: even a fully-spun log still sinks.
  assert.match(course, /Math\.max\(RIVER_MIN_DRIFT, RIVER_CURRENT \+ thrust \* log\.roll\.y\)/);

  const kindsStart = course.indexOf("export const riverRollKinds = [");
  const kindsEnd = course.indexOf("] as const;", kindsStart);
  const kinds = course.slice(kindsStart, kindsEnd).match(/roll: \{/g)?.length ?? 0;
  assert.equal(kinds, 4, "the river floats four kinds of log");

  for (const renderer of ["drawRiverLog", "drawPiranha", "drawRiverHud", "drawRiverWorld"]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.notEqual(start, -1, `${renderer} should exist`);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const saves = body.match(/\bctx\.save\(\);/g)?.length ?? 0;
    const restores = body.match(/\bctx\.restore\(\);/g)?.length ?? 0;
    assert.equal(restores, saves, `${renderer} must restore every saved transform`);
  }
});

test("wires The Lion's Watch into the page as the finale", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const course = await readFile(
    new URL("../app/lion-course.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /from "\.\/lion-course"/);
  assert.match(source, /type CourseNumber = 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8;/);
  assert.match(source, /game\.lion\.jumpPresses \+= 1/);
  assert.match(source, /drawLionWorld\(context, game, activeCharacter\)/);
  assert.match(source, /08 · LION/);
  assert.match(source, /PLAY COURSE 08/);
  assert.match(source, /stepLionCourse\(savanna, player, \{ move, run: running, up, down \}, dt\)/);
  assert.match(source, /EXPEDITION COMPLETE/, "winning the last course completes the expedition");
  assert.match(course, /export const LION_CHASE_SPEED = 318;/);
  assert.match(course, /export const LION_RUN_SPEED = 262;/, "a charging lion outruns a running explorer");
  assert.match(course, /export const LION_PATIENCE = 3\.6;/);
  assert.match(course, /export const LION_SIGHT = 560;/);
  assert.match(course, /return state\.perch === "perched";/, "only standing on a branch counts as shelter");
  assert.match(course, /Math\.abs\(dx\) < LION_NOSE \|\| Math\.sign\(dx\) === Math\.sign\(lion\.facing\)/, "the lion only sees what it faces");

  const treesStart = course.indexOf("export const lionTrees = [");
  const treesEnd = course.indexOf("] as const;", treesStart);
  const trees = course.slice(treesStart, treesEnd).match(/\{ x:/g)?.length ?? 0;
  assert.equal(trees, 3, "three acacia trees give cover on the savanna");

  for (const renderer of ["drawAcacia", "drawLion", "drawLionGaze", "drawGoldenPumpkin", "drawLionHud", "drawLionWorld"]) {
    const start = source.indexOf(`function ${renderer}(`);
    assert.notEqual(start, -1, `${renderer} should exist`);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const saves = body.match(/\bctx\.save\(\);/g)?.length ?? 0;
    const restores = body.match(/\bctx\.restore\(\);/g)?.length ?? 0;
    assert.equal(restores, saves, `${renderer} must restore every saved transform`);
  }
});
