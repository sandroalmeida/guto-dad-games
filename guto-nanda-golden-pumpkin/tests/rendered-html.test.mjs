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
  assert.match(html, /reaches one second/i);
  assert.match(html, /two barriers/i);
  assert.match(html, /Capuchin Monkeys/i);
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
