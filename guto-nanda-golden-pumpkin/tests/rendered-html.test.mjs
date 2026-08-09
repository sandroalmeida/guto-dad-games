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
