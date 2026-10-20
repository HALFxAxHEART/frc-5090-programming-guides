// Print edition of the 5090 programming guides.
// Renders each guide (and the cover, intro and contents pages) to a content-only PDF.
// assemble.py then adds the logo header / page footer and builds the binder + individual PDFs.
// Usage: bun render-print.ts <guides dir> <work dir>   (writes <work dir>/parts/*.pdf + parts.json)
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import puppeteer from "puppeteer";
import QRCode from "qrcode";

const [guidesDir, workDir] = process.argv.slice(2);
const partsDir = join(workDir, "parts");
mkdirSync(partsDir, { recursive: true });
const here = import.meta.dir;
const fonts = join(here, "node_modules/@fontsource");

export const BLUE = "#000AB5";
export const GOLD = "#FFA700";

// Pinned repos -> the short name printed on paper
const REPOS: [string, string][] = [
  ["TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/", "Hephaestus (2026)"],
  ["TorqueNados-FRC5090/Robot-Template/blob/b8dddd0e338841e867c0cc260162e6097adecd7b/", "Robot-Template"],
  ["HALFxAxHEART/frc-auto-align/blob/c95ddf4a2ee25c406ea6e2ed04e232b17b39b8f7/", "frc-auto-align"],
  ["TorqueNados-FRC5090/Stingray-2025/blob/97c843705075c729538ad0b3925f67a35e3bf791/", "Stingray-2025"],
  ["TorqueNados-FRC5090/Petrichor-2023/blob/f8931338bb4aa79e3dd94a0dab2027ead4281bdb/", "Petrichor-2023"],
  ["TorqueNados-FRC5090/Thunderstrike-2024/blob/876b8c14682ccf57ec0ab2767ee2da54c34cee6e/", "Thunderstrike-2024"],
];

type Guide = { file: string; num: string; title: string; md: string };
const guides: Guide[] = readdirSync(guidesDir)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort()
  .map((file) => {
    const md = readFileSync(join(guidesDir, file), "utf8");
    const h1 = md.match(/^# (.+)$/m)?.[1] ?? file;
    return { file, num: file.slice(0, 2), title: h1.replace(/^\d+\.\s*/, ""), md };
  });
const titleOf = new Map(guides.map((g) => [g.num, g.title]));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Code permalink -> "Repo · path · lines" as printed text (null if not one of our pinned repos) */
function codeRef(href: string): string | null {
  const m = href.match(/^https:\/\/github\.com\/(.+?)(?:#L(\d+)(?:-L(\d+))?)?$/);
  if (!m) return null;
  for (const [prefix, name] of REPOS) {
    if (m[1].startsWith(prefix)) {
      let path = m[1].slice(prefix.length).replace(/^src\/main\/java\/frc\/robot\//, "");
      path = path.replace(/^src\/main\/deploy\//, "deploy/");
      const lines = m[2] ? (m[3] && m[3] !== m[2] ? `lines ${m[2]}–${m[3]}` : `line ${m[2]}`) : "";
      return [name, path, lines].filter(Boolean).join(" · ");
    }
  }
  return null;
}

/** Removes the indentation every line of a code block shares */
function dedent(code: string): string {
  const lines = code.split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

/** Turns one guide's Markdown into print HTML. Web links become numbered notes listed at the end. */
function renderGuide(md: string, num: string): string {
  const notes: string[] = [];
  // Strip shared indentation from code excerpts (they're copied from inside classes)
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, body) => "```" + lang + "\n" + dedent(body.replace(/\n$/, "")) + "\n```");
  // Put each bold label in the opening "Who it's for / You need first / Time" box on its own line
  md = md.replace(/^(>[^\n]*)\n> \*\*/gm, "$1\n>\n> **");
  md = md.replace(/^(>.*?\S) (\*\*(?:Time|What you need first|You need first|Need first):\*\*)/gm, "$1\n>\n> $2");
  const m = new Marked(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );
  m.use({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        if (depth === 1) return ""; // the title band replaces the H1
        return `<h${depth}>${text}</h${depth}>\n`;
      },
      checkbox() {
        return `<span class="box"></span>`;
      },
      // ![Caption](images/x.png "60")  -> figure at 60% width with a caption. Caption starting with "-" = no caption.
      image({ href, title, text }) {
        const src = /^https?:/.test(href) ? href : "file://" + join(guidesDir, href);
        const width = title && /^\d+$/.test(title) ? `${title}%` : "";
        const cap = text && !text.startsWith("-") ? `<figcaption>${text}</figcaption>` : "";
        return `<figure${width ? ` style="width:${width}"` : ""}><img src="${src}">${cap}</figure>`;
      },
      paragraph({ tokens }) {
        const real = tokens.filter((t) => !(t.type === "text" && !t.raw.trim()));
        const inner = this.parser.parseInline(tokens);
        if (real.length > 0 && real.every((t) => t.type === "image")) {
          return real.length > 1 ? `<div class="figrow">${inner}</div>\n` : `<div class="figone">${inner}</div>\n`;
        }
        return `<p>${inner}</p>\n`;
      },
      blockquote({ tokens }) {
        const inner = this.parser.parse(tokens);
        const plain = inner.replace(/<[^>]+>/g, "").trim();
        const kind = /^AI can help/i.test(plain) ? " class=\"ai\"" : /^(Watch out|Warning|Safety)/i.test(plain) ? " class=\"warn\"" : /^(Tip|Pro tip)\b/i.test(plain) ? " class=\"tip\"" : "";
        return `<blockquote${kind}>${inner}</blockquote>\n`;
      },
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        const plainText = text.replace(/<[^>]+>/g, "");
        // Another guide in this set
        const local = href.match(/^(?:\.\/)?(\d\d)-[^/#]*\.md/);
        if (local) {
          const n = local[1];
          return plainText.trim().startsWith(n) || /guide\s*\d\d/i.test(plainText)
            ? `<span class="xref">${text}</span>`
            : `<span class="xref">${text}</span> <span class="xnum">(guide ${n})</span>`;
        }
        // Our code: print where to find it
        const ref = codeRef(href);
        if (ref) return `${text} <span class="cref">${esc(ref)}</span>`;
        // A bare URL written out in the text: print it as-is
        if (plainText === href || plainText === href.replace(/^https?:\/\//, "")) {
          return `<span class="url">${esc(href.replace(/^https?:\/\//, ""))}</span>`;
        }
        // Any other web link: numbered note
        let i = notes.indexOf(href);
        if (i < 0) { notes.push(href); i = notes.length - 1; }
        return `${text}<sup class="note">${i + 1}</sup>`;
      },
    },
  });
  let html = m.parse(md) as string;
  if (notes.length) {
    html += `<section class="notes"><h2>Web links in this guide</h2><ol>${notes
      .map((n) => `<li>${esc(n.replace(/^https?:\/\//, ""))}</li>`)
      .join("")}</ol></section>`;
  }
  return html;
}

const css = `
@font-face { font-family: Inter; font-weight: 400; src: url(file://${fonts}/inter/files/inter-latin-400-normal.woff2); }
@font-face { font-family: Inter; font-weight: 400; font-style: italic; src: url(file://${fonts}/inter/files/inter-latin-400-italic.woff2); }
@font-face { font-family: Inter; font-weight: 600; src: url(file://${fonts}/inter/files/inter-latin-600-normal.woff2); }
@font-face { font-family: Inter; font-weight: 700; src: url(file://${fonts}/inter/files/inter-latin-700-normal.woff2); }
@font-face { font-family: Oswald; font-weight: 500; src: url(file://${fonts}/oswald/files/oswald-latin-500-normal.woff2); }
@font-face { font-family: Oswald; font-weight: 600; src: url(file://${fonts}/oswald/files/oswald-latin-600-normal.woff2); }
@font-face { font-family: Oswald; font-weight: 700; src: url(file://${fonts}/oswald/files/oswald-latin-700-normal.woff2); }
@font-face { font-family: JBMono; font-weight: 400; src: url(file://${fonts}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2); }
@font-face { font-family: JBMono; font-weight: 700; src: url(file://${fonts}/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2); }

/* Mirrored margins for double-sided printing: wide inner margin for binder holes. Header/footer space at top/bottom. */
@page { size: Letter; margin: 0.95in 0.6in 0.8in 0.6in; }
@page :right { margin-left: 0.95in; margin-right: 0.6in; }
@page :left { margin-left: 0.6in; margin-right: 0.95in; }

:root { --blue: ${BLUE}; --gold: ${GOLD}; --ink: #16181d; --muted: #555b66; --rule: #c9ced8; --paper2: #f4f5f9; --goldwash: #fff4dc; --bluewash: #eef0fb; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, Arial, sans-serif; color: var(--ink); font-size: 10.2pt; line-height: 1.48; margin: 0; }
p, li { orphans: 3; widows: 3; }
strong { font-weight: 700; }

/* Title band at the start of each guide */
.band { display: flex; align-items: stretch; margin: 0 0 14pt; border-radius: 4pt; overflow: hidden; break-inside: avoid; }
.band .num { background: var(--gold); color: var(--blue); font-family: Oswald; font-weight: 700; font-size: 40pt;
  line-height: 1; padding: 10pt 14pt 8pt; display: flex; align-items: center; }
.band .title { background: var(--blue); color: #fff; flex: 1; padding: 10pt 16pt; display: flex; flex-direction: column; justify-content: center; }
.band .title .kicker { font-family: Oswald; font-weight: 500; font-size: 9pt; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); }
.band .title .t { font-family: Oswald; font-weight: 600; font-size: 22pt; line-height: 1.1; }

h2 { font-family: Oswald; font-weight: 600; font-size: 15pt; color: var(--blue); margin: 18pt 0 6pt; padding: 0 0 3pt 9pt;
  border-left: 5pt solid var(--gold); border-bottom: 1pt solid var(--rule); break-after: avoid; line-height: 1.2; }
h3 { font-family: Oswald; font-weight: 600; font-size: 12pt; color: var(--blue); margin: 13pt 0 4pt; break-after: avoid; }
h4 { font-family: Inter; font-weight: 700; font-size: 10.2pt; margin: 10pt 0 3pt; break-after: avoid; }
h2 + p, h3 + p { margin-top: 2pt; }

code { font-family: JBMono, monospace; font-size: 8.4pt; background: var(--paper2); border: 0.5pt solid #e1e4ea; padding: 0 2.5pt; border-radius: 2pt; }
pre { background: var(--paper2); border: 0.75pt solid var(--rule); border-left: 3pt solid var(--blue); border-radius: 3pt;
  padding: 6pt 9pt; white-space: pre-wrap; word-break: break-word; margin: 7pt 0; }
pre code { background: none; border: none; padding: 0; font-size: 7.9pt; line-height: 1.38; }

blockquote { margin: 8pt 0; padding: 5pt 11pt; background: var(--goldwash); border-left: 4pt solid var(--gold); border-radius: 0 3pt 3pt 0; break-inside: avoid; }
blockquote p { margin: 3pt 0; }

table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 8.9pt; }
th { background: var(--blue); color: #fff; font-weight: 600; text-align: left; padding: 3.5pt 6pt; border: 0.75pt solid var(--blue); }
td { border: 0.75pt solid var(--rule); padding: 3.5pt 6pt; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f7f8fb; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
td code, th code { font-size: 7.9pt; }
th code { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); color: #fff; }

hr { border: none; border-top: 1pt solid var(--rule); margin: 14pt 0; }
a { color: inherit; text-decoration: none; }

/* Figures and callouts */
figure { margin: 8pt auto; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 4.2in; border-radius: 3pt; }
figcaption { font-size: 8.2pt; color: var(--muted); margin-top: 3pt; font-style: italic; text-align: center; }
.figone { margin: 6pt 0; }
.figrow { display: flex; gap: 10pt; align-items: flex-end; justify-content: center; margin: 6pt 0; break-inside: avoid; }
.figrow figure { flex: 1; margin: 0; }
.figrow figure img { max-height: 2.6in; }
blockquote.ai { background: var(--bluewash); border-left-color: var(--blue); }
blockquote.ai p:first-child strong:first-child { color: var(--blue); }
blockquote.warn { background: #fdecec; border-left-color: #c62828; }
blockquote.tip { background: #eef8ee; border-left-color: #2e7d32; }

/* What replaces links on paper */
.cref { font-family: JBMono, monospace; font-size: 7.4pt; color: var(--blue); background: var(--bluewash); border: 0.5pt solid #cfd3f2;
  border-radius: 2pt; padding: 0 3pt; white-space: nowrap; }
.xref { font-weight: 600; color: var(--blue); }
.xnum { color: var(--muted); font-size: 8.6pt; }
sup.note { color: var(--blue); font-weight: 700; font-size: 6.8pt; margin-left: 0.5pt; }
.url { font-family: JBMono, monospace; font-size: 7.6pt; color: var(--muted); word-break: break-all; }
.notes { margin-top: 16pt; break-inside: avoid-page; }
.notes h2 { font-size: 11pt; }
.notes ol { font-family: JBMono, monospace; font-size: 7.4pt; color: var(--muted); padding-left: 18pt; line-height: 1.5; }
.notes li { word-break: break-all; }

/* Tick boxes for checklists */
li:has(> .box), li:has(> p > .box) { list-style: none; }
ul:has(> li > .box), ul:has(> li > p > .box) { padding-left: 4pt; }
.box { display: inline-block; width: 8.5pt; height: 8.5pt; border: 1.1pt solid var(--blue); border-radius: 1.5pt; margin-right: 6pt; vertical-align: -1pt; background: #fff; }

/* Notes lines at the end of each guide */
.lines { margin-top: 16pt; break-inside: avoid; }
.lines h2 { font-size: 11pt; }
.lines div { border-bottom: 0.75pt solid var(--rule); height: 22pt; }

/* Cover */
.cover { height: 9.2in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.cover img { width: 4.1in; }
.cover .kicker { font-family: Oswald; font-weight: 500; letter-spacing: 0.25em; text-transform: uppercase; color: var(--blue); font-size: 12pt; margin-top: 22pt; }
.cover h1 { font-family: Oswald; font-weight: 700; font-size: 44pt; color: var(--blue); margin: 4pt 0 0; line-height: 1; }
.cover .bar { width: 3.2in; height: 6pt; background: var(--gold); margin: 12pt auto; border-radius: 3pt; }
.cover .sub { font-size: 11.5pt; color: var(--muted); max-width: 5in; }
.cover .ed { margin-top: 26pt; font-family: Oswald; font-weight: 500; font-size: 11pt; color: var(--ink); letter-spacing: 0.08em; }

/* Stage dividers */
.divider { height: 9.1in; display: flex; flex-direction: column; justify-content: center; }
.divider .stage-no { font-family: Oswald; font-weight: 600; color: var(--gold); font-size: 16pt; letter-spacing: 0.2em; text-transform: uppercase; }
.divider h1 { font-family: Oswald; font-weight: 700; color: var(--blue); font-size: 40pt; margin: 0; line-height: 1.05; }
.divider .bar { width: 2in; height: 6pt; background: var(--gold); border-radius: 3pt; margin: 10pt 0 16pt; }
.divider img { display: block; width: 100%; min-width: 0; height: 4.4in; object-fit: cover; box-sizing: border-box; border-radius: 5pt; border: 3pt solid var(--blue); }
.divider { width: 100%; overflow: hidden; }
.divider .list { margin-top: 16pt; }
.divider .row { font-size: 12.5pt; padding: 3pt 0; display: flex; align-items: center; }
.divider .row .n { font-family: Oswald; font-weight: 700; color: var(--blue); background: var(--gold); width: 26pt; text-align: center; border-radius: 2pt; margin-right: 10pt; }

/* Contents */
.toc h1, .intro h1 { font-family: Oswald; font-weight: 700; color: var(--blue); font-size: 26pt; margin: 0 0 4pt; }
.toc .bar, .intro .bar { width: 1.6in; height: 5pt; background: var(--gold); border-radius: 2.5pt; margin-bottom: 14pt; }
.toc .stage { font-family: Oswald; font-weight: 600; color: var(--blue); font-size: 10.5pt; margin: 7pt 0 1pt; text-transform: uppercase; letter-spacing: 0.06em; }
.toc .row { display: flex; align-items: baseline; padding: 1.6pt 0; font-size: 10.5pt; }
.toc .row .n { font-family: Oswald; font-weight: 700; color: var(--blue); background: var(--gold); width: 22pt; text-align: center; border-radius: 2pt; margin-right: 9pt; font-size: 10pt; }
.toc .row .dots { flex: 1; border-bottom: 1pt dotted #9aa1ad; margin: 0 6pt; transform: translateY(-3pt); }
.toc .row .p { font-family: Oswald; font-weight: 600; color: var(--ink); }
.qrs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8pt 12pt; margin: 8pt 0; }
.qr { display: flex; align-items: center; gap: 8pt; border: 0.75pt solid var(--rule); border-radius: 3pt; padding: 6pt; break-inside: avoid; }
.qr img { width: 0.8in; height: 0.8in; flex: none; }
.qr .name { font-family: Oswald; font-weight: 600; color: var(--blue); font-size: 10.5pt; }
.qr .what { font-size: 8pt; color: var(--muted); line-height: 1.3; }
.qr .addr { font-family: JBMono, monospace; font-size: 6.6pt; color: var(--ink); word-break: break-all; margin-top: 2pt; }
`;

const page = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"] });
async function toPdf(html: string, name: string) {
  const htmlPath = join(partsDir, name + ".html");
  writeFileSync(htmlPath, html);
  const p = await browser.newPage();
  await p.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
  await p.evaluateHandle("document.fonts.ready");
  await p.pdf({ path: join(partsDir, name + ".pdf"), printBackground: true, preferCSSPageSize: true });
  await p.close();
}

// ---- Guides ----
const notesBlock = `<section class="lines"><h2>Notes</h2>${"<div></div>".repeat(8)}</section>`;
for (const g of guides) {
  const band = `<div class="band"><div class="num">${g.num}</div><div class="title"><div class="kicker">FRC 5090 Programming Guide</div><div class="t">${esc(g.title)}</div></div></div>`;
  await toPdf(page(band + renderGuide(g.md, g.num) + notesBlock), `guide-${g.num}`);
}

// ---- Cover ----
const cover = `<section class="cover"><img src="file://${join(here, "logo.png")}">
  <div class="kicker">FRC Team 5090 · Trenton TorqueNados</div>
  <h1>Programming Guides</h1><div class="bar"></div>
  <div class="sub">CTRE Phoenix 6, command-based Java, Limelight and PathPlanner, with directions to the code we already wrote.</div>
  <div class="ed">2026–27 Season Edition</div></section>`;
await toPdf(page(cover), "cover");

// ---- Intro ("How to use these guides" + where the code is, with QR codes) ----
const repoCards: [string, string, string][] = [
  ["Hephaestus (2026)", "2026 robot, rebuilt as Theseus. Branch c3.", "https://github.com/TorqueNados-FRC5090/Hephaestus"],
  ["Robot-Template", "Starting point for a new robot. Branch 2026.", "https://github.com/TorqueNados-FRC5090/Robot-Template"],
  ["frc-auto-align", "Teaching repo: drive to a scoring spot.", "https://github.com/HALFxAxHEART/frc-auto-align"],
  ["Stingray-2025", "2025 robot: elevator and pivot.", "https://github.com/TorqueNados-FRC5090/Stingray-2025"],
  ["Petrichor-2023", "2023 robot: arm with presets.", "https://github.com/TorqueNados-FRC5090/Petrichor-2023"],
  ["Thunderstrike-2024", "2024 robot: Limelight aiming.", "https://github.com/TorqueNados-FRC5090/Thunderstrike-2024"],
];
const qrCards: string[] = [];
for (const [name, what, url] of repoCards) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#000000", light: "#ffffff" } });
  const dataUri = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  qrCards.push(`<div class="qr"><img src="${dataUri}"><div><div class="name">${name}</div><div class="what">${what}</div><div class="addr">${url.replace("https://", "")}</div></div></div>`);
}
const introMd = readFileSync(join(guidesDir, "README.md"), "utf8")
  .replace(/^# .*$/m, "")
  .replace(/<!-- REPO-CARDS -->/, `<div class="qrs">${qrCards.join("")}</div>`);
const intro = `<section class="intro"><h1>How to Use These Guides</h1><div class="bar"></div>${renderGuide(introMd, "00")}</section>`;
await toPdf(page(intro), "intro");

// ---- Contents (page numbers are filled in by assemble.py via a second render) ----
const stages: [string, string[]][] = [
  ["Getting started", ["23", "24", "25", "22"]],
  ["Robot basics", ["01", "02", "03", "30"]],
  ["Writing code", ["04", "05", "06", "31"]],
  ["Control", ["07", "08", "09"]],
  ["Mechanisms", ["10", "11", "12", "13", "14", "15", "26"]],
  ["Sensors and encoders", ["21", "27", "28", "29"]],
  ["Driving, vision and autos", ["16", "17", "32", "33", "18"]],
  ["Finding problems", ["19", "20", "34"]],
];
// Any guide not listed above goes at the end so nothing is silently dropped
const listed = new Set(stages.flatMap(([, n]) => n));
const extra = guides.map((g) => g.num).filter((n) => !listed.has(n));
if (extra.length) stages.push(["More", extra]);
for (const [, nums] of stages) for (const n of nums) if (!titleOf.has(n)) throw new Error(`Contents lists guide ${n} but there is no file for it`);
writeFileSync(join(workDir, "stages.json"), JSON.stringify(stages));

// ---- Stage divider pages (one per stage, with a big photo) ----
const stagePhotos = ["team-group-build.jpg", "team-2024-robot-on-field.jpg", "cad-theseus-2026.png", "team-practice-field.jpg",
  "cad-thunderstrike-2024.jpg", "photo-candle-lit.jpg", "team-onboard-360-cam.jpg", "team-students-table.jpg", "cad-thunderstrike-2024-b.jpg"];
for (let i = 0; i < stages.length; i++) {
  const [stage, nums] = stages[i];
  // Use the stage's photo if it's there, otherwise the first one that exists (the public repo leaves out some team photos)
  const candidates = [stagePhotos[i % stagePhotos.length], ...stagePhotos, "cad-theseus-2026.png"].map((f) => join(guidesDir, "images", f));
  const photo = candidates.find((f) => existsSync(f)) ?? candidates[candidates.length - 1];
  const html = `<section class="divider"><div class="stage-no">Part ${i + 1}</div><h1>${esc(stage)}</h1><div class="bar"></div>
    <img src="file://${photo}">
    <div class="list">${nums.map((n) => `<div class="row"><span class="n">${n}</span>${esc(titleOf.get(n) ?? "")}</div>`).join("")}</div></section>`;
  await toPdf(page(html), `divider-${i}`);
}
const pagesFile = join(workDir, "start-pages.json");
let startPages: Record<string, number> = {};
try { startPages = JSON.parse(readFileSync(pagesFile, "utf8")); } catch { /* first pass: no numbers yet */ }
const toc = `<section class="toc"><h1>Contents</h1><div class="bar"></div>
  <div class="row"><span class="n">–</span>How to use these guides<span class="dots"></span><span class="p">${startPages["intro"] ?? ""}</span></div>
  ${stages.map(([stage, nums]) => `<div class="stage">${stage}</div>` + nums.map((n) =>
    `<div class="row"><span class="n">${n}</span>${esc(titleOf.get(n) ?? "")}<span class="dots"></span><span class="p">${startPages[n] ?? ""}</span></div>`).join("")).join("")}
</section>`;
await toPdf(page(toc), "toc");

writeFileSync(join(workDir, "parts.json"), JSON.stringify(guides.map((g) => ({ num: g.num, title: g.title })), null, 1));
await browser.close();
console.log(`rendered ${guides.length} guides + cover, intro, contents`);
