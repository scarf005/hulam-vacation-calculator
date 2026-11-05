// -----------------------------------------------------------------------------
// src/meta.json + src/main.js → dist/ 산출물 생성
//   - dist/<slug>.user.js                 (Tampermonkey 유저스크립트)
//   - dist/extension/                     (크롬 MV3 확장 폴더)
//   - dist/<slug>-extension.zip           (웹스토어 업로드용 zip)
// 실행: `vp run build` (Node 22.18+ 의 TypeScript 직접 실행 사용)
// -----------------------------------------------------------------------------
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { zipSync } from "fflate"

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

const meta = JSON.parse(await readFile(path("./src/meta.json"), "utf8"))
const source = await readFile(path("./src/main.js"), "utf8")

const slug = meta.repository.split("/")[1]
const repoUrl = `https://github.com/${meta.repository}`
const downloadUrl = `${repoUrl}/releases/latest/download/${slug}.user.js`

const dist = path("./dist/")
const extDir = path("./dist/extension/")
const iconDir = path("./dist/extension/icons/")

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
const manifestJson = JSON.stringify(manifest, null, 2) + "\n"

// --- 파일 쓰기 ------------------------------------------------------------
await rm(dist, { recursive: true, force: true })
await mkdir(iconDir, { recursive: true })

await writeFile(`${dist}${slug}.user.js`, userscript)
await writeFile(`${extDir}manifest.json`, manifestJson)
await writeFile(`${extDir}content.js`, body)

const sizes = [16, 48, 128]
const icons: Record<string, Uint8Array> = Object.fromEntries(
  await Promise.all(
    sizes.map(async (size) => [
      `icons/icon-${size}.png`,
      new Uint8Array(await readFile(path(`./icons/icon-${size}.png`))),
    ]),
  ),
)
await Promise.all(
  Object.entries(icons).map(([name, bytes]) => writeFile(`${extDir}${name}`, bytes)),
)

// --- 확장 zip 생성 (웹스토어 업로드용) ------------------------------------
const enc = new TextEncoder()
const zip = zipSync({
  "manifest.json": enc.encode(manifestJson),
  "content.js": enc.encode(body),
  ...icons,
})
await writeFile(`${dist}${slug}-extension.zip`, zip)

console.log(`✓ dist/${slug}.user.js`)
console.log(`✓ dist/extension/ (manifest.json, content.js, icons/)`)
console.log(`✓ dist/${slug}-extension.zip`)
