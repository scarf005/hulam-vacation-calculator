#!/usr/bin/env -S deno run -A
// -----------------------------------------------------------------------------
// src/meta.json + src/main.js → dist/ 산출물 생성
//   - dist/<slug>.user.js                 (Tampermonkey 유저스크립트)
//   - dist/extension/                     (크롬 MV3 확장 폴더)
//   - dist/<slug>-extension.zip           (웹스토어 업로드용 zip)
// -----------------------------------------------------------------------------
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "jsr:@zip-js/zip-js@2"

/** @typedef {{ name:string, description:string, version:string, author:string, namespace:string, repository:string, matches:string[] }} Meta */
const meta = JSON.parse(await Deno.readTextFile(new URL("./src/meta.json", import.meta.url)))
const source = await Deno.readTextFile(new URL("./src/main.js", import.meta.url))

const slug = meta.repository.split("/")[1]
const repoUrl = `https://github.com/${meta.repository}`
const downloadUrl =
  `${repoUrl}/releases/latest/download/${slug}.user.js`

const dist = new URL("./dist/", import.meta.url)
const extDir = new URL("./dist/extension/", import.meta.url)
const iconDir = new URL("./dist/extension/icons/", import.meta.url)

// --- 유저스크립트 배너 생성 -----------------------------------------------
const pad = (s: string) => s.padEnd(13)
const banner = [
  "// ==UserScript==",
  `// @name        ${meta.name}`,
  `// @description ${meta.description}`,
  `// @namespace   ${meta.namespace}`,
  ...meta.matches.map((m: string) => `// ${pad("@match")}${m}`),
  `// @homepageURL ${repoUrl}`,
  `// @supportURL  ${repoUrl}/issues`,
  `// @downloadURL ${downloadUrl}`,
  `// @updateURL   ${downloadUrl}`,
  "// @grant       none",
  `// @version     ${meta.version}`,
  `// @author      ${meta.author}`,
  "// ==/UserScript==",
  "",
].join("\n")

// main.js 앞의 `// @ts-check`는 유지하고 그 뒤에 배너를 삽입
const body = source.replace(/^\/\/ @ts-check\n/, "")
const userscript = `// @ts-check\n${banner}\n${body}`

// --- MV3 manifest 생성 ----------------------------------------------------
const manifest = {
  manifest_version: 3,
  name: meta.name,
  description: meta.description,
  version: meta.version,
  icons: { "16": "icons/icon-16.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" },
  content_scripts: [
    {
      matches: meta.matches,
      js: ["content.js"],
      run_at: "document_idle",
    },
  ],
}

// --- 파일 쓰기 ------------------------------------------------------------
await Deno.remove(dist, { recursive: true }).catch(() => {})
await Deno.mkdir(iconDir, { recursive: true })

await Deno.writeTextFile(new URL(`${slug}.user.js`, dist), userscript)
await Deno.writeTextFile(new URL("manifest.json", extDir), JSON.stringify(manifest, null, 2) + "\n")
await Deno.writeTextFile(new URL("content.js", extDir), body)

for (const size of [16, 48, 128]) {
  await Deno.copyFile(
    new URL(`./icons/icon-${size}.png`, import.meta.url),
    new URL(`icon-${size}.png`, iconDir),
  )
}

// --- 확장 zip 생성 (웹스토어 업로드용) ------------------------------------
const zipWriter = new ZipWriter(new BlobWriter("application/zip"))
await zipWriter.add("manifest.json", new TextReader(JSON.stringify(manifest, null, 2) + "\n"))
await zipWriter.add("content.js", new TextReader(body))
for (const size of [16, 48, 128]) {
  const bytes = await Deno.readFile(new URL(`./icons/icon-${size}.png`, import.meta.url))
  await zipWriter.add(`icons/icon-${size}.png`, new Uint8ArrayReader(bytes))
}
const zipBlob = await zipWriter.close()
await Deno.writeFile(
  new URL(`${slug}-extension.zip`, dist),
  new Uint8Array(await zipBlob.arrayBuffer()),
)

console.log(`✓ dist/${slug}.user.js`)
console.log(`✓ dist/extension/ (manifest.json, content.js, icons/)`)
console.log(`✓ dist/${slug}-extension.zip`)
