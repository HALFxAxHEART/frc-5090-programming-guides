// Usage: bun /tmp/render/svgpreview.mjs <file.svg> [out.png]  -> renders an SVG to PNG so you can look at it with the Read tool
import puppeteer from "puppeteer";
import { resolve } from "node:path";
const [svg, out = svg.replace(/\.svg$/, ".preview.png")] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: 900, height: 700, deviceScaleFactor: 1.5 });
await p.goto("file://" + resolve(svg)); const el = await p.$("svg"); await el.screenshot({ path: out, omitBackground: false });
await b.close(); console.log(out);
