/**
 * The fruit book: one page of every fruit in the game, written from the game's own tables, so it says what the game does. Each
 * fruit's name, card (as the game words it, keywords picked out), what each keyword means, how it scores and its sprite come from
 * src/rules and assets/; its build family, roles, what it works with and what the bots measured come from tools/fruit-book/book.ts.
 * The Pages workflow writes it beside the game (fruits.html), so it is rebuilt with every change to main.
 *
 *     node tools/fruit-book.ts [out file, default dist/fruit-book.html]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { FRUITS, LEGENDARY, OFFERABLE, pumpkinSeedText, type FruitKind } from "../src/rules/fruits.ts";
import { KEYWORDS, keywordsIn, ruleWords } from "../src/rules/terms.ts";
import { BOOK, BUILDS, FAMILIES, MEASURED, ROLES } from "./fruit-book/book.ts";

const ROOT = resolve(import.meta.dirname, "..");
const out = resolve(process.argv[2] ?? join(ROOT, "dist", "fruit-book.html"));

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The card's text as the game draws it: keywords, and the numbers that go with them, in the accent colour. */
function cardHtml(text: string): string {
  return ruleWords(text)
    .map((w) => (w.keyword ? `<b class="kw">${esc(w.word)}</b>` : esc(w.word)))
    .join(" ");
}

/** Where a fruit comes from in a run. */
function source(kind: FruitKind): string {
  if (OFFERABLE.includes(kind)) return "Picks and the shop";
  if (LEGENDARY.includes(kind)) return "Picks, rarely";
  if (kind === "melon") return "Merges, and 1 pick in 10";
  if (["cherry", "grape", "orange"].includes(kind)) return "Starting pool and merges";
  return "Made in the jar";
}

function stamp(): string {
  let commit = "";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    // Not a checkout: the date alone.
  }
  const day = new Date().toISOString().slice(0, 10);
  return commit === "" ? day : `${day}, commit ${commit}`;
}

const kinds = Object.keys(FRUITS) as FruitKind[];
const fruit = kinds.map((kind) => {
  const def = FRUITS[kind];
  const entry = BOOK[kind];
  // A Pumpkin Seed's card changes as the run goes; the book shows it at the start of a run.
  const text = kind === "pumpkinseed" ? pumpkinSeedText(0) : def.text;
  const sprite = readFileSync(join(ROOT, "assets", `fruit-${kind}.png`)).toString("base64");
  return {
    kind,
    name: def.name,
    card: cardHtml(text),
    terms: keywordsIn(text).map((k) => [KEYWORDS[k].name, KEYWORDS[k].text]),
    scoring: def.scoring[0]!.toUpperCase() + def.scoring.slice(1),
    slots: def.slots ?? 1,
    source: source(kind),
    family: entry.family,
    roles: entry.roles,
    works: entry.works,
    clashes: entry.clashes ?? [],
    gap: entry.gap ?? "",
    sprite: `data:image/png;base64,${sprite}`,
  };
});

const measured = MEASURED.map((m) => ({ ...m, name: FRUITS[m.kind].name }));
const data = JSON.stringify({ fruit, families: FAMILIES, roles: ROLES, measured, builds: BUILDS, stamp: stamp() }).replace(/</g, "\\u003c");

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jam Jar Fruit Book</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,800&display=swap">
<style>
:root{--bg:#ffffff;--ink:#22141c;--mute:#6d5a64;--line:#eadde3;--card:#ffffff;--soft:#faf4f7;--jam:#8c1c4a;--jam2:#fbe6ee;--kw:#3c5e8b;--up:#1d7a32;--dn:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#170d14;--ink:#f6ecf1;--mute:#b9a6b0;--line:#3a2532;--card:#21141d;--soft:#1d1119;--jam2:#3b1428;--kw:#8fb8e8;--up:#7fd88f;--dn:#ff8a80}}
:root[data-theme="dark"]{--bg:#170d14;--ink:#f6ecf1;--mute:#b9a6b0;--line:#3a2532;--card:#21141d;--soft:#1d1119;--jam2:#3b1428;--kw:#8fb8e8;--up:#7fd88f;--dn:#ff8a80}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 "Nunito Sans",system-ui,sans-serif;overflow-x:clip}
h1,h2,h3{font-family:"Baloo 2",system-ui,sans-serif;letter-spacing:-.02em;line-height:1.05;margin:0}
.band{padding-block:clamp(24px,4vw,56px);padding-inline:max(5vw,16px)}
.wrap{max-width:1240px;margin:0 auto}
.top{background:var(--jam);color:#fff}
.top h1{font-size:clamp(34px,5vw,52px);font-weight:800}
.top p{margin:8px 0 0;max-width:70ch;color:#fbe6ee}
.chart{margin-top:24px;background:var(--card);color:var(--ink);border-radius:14px;padding:20px clamp(14px,2.5vw,28px)}
.chart h2{font-size:clamp(22px,2.6vw,28px);font-weight:800}
.sub{color:var(--mute);margin:4px 0 14px;font-size:15px}
.top .chart .sub{color:var(--mute)}
.row{display:grid;grid-template-columns:8.5em minmax(0,1fr) 4.2em;align-items:center;gap:10px;padding:5px 0;border-top:1px solid var(--line)}
.row:first-child{border-top:0}
.row small{display:block;color:var(--mute);font-size:13px;line-height:1.3}
.track{position:relative;height:26px}
.noise{position:absolute;top:0;bottom:0;background:var(--jam2);border-radius:3px}
.zero{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink)}
.bar{position:absolute;top:5px;height:16px;border-radius:3px}
.val{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;font-size:13px;color:var(--mute)}
.legend i{display:inline-block;width:14px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.chip{font:600 15px "Nunito Sans",sans-serif;min-height:44px;padding:0 16px;border-radius:22px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.chip[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.d{width:10px;height:10px;border-radius:50%;display:inline-block}
.chip:focus-visible,.wb:focus-visible,#q:focus-visible{outline:3px solid #e1337e;outline-offset:2px}
#q{font:16px "Nunito Sans",sans-serif;min-height:44px;padding:0 14px;border-radius:22px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);flex:1 1 200px;max-width:320px}
.count{color:var(--mute);font-size:14px;margin-left:auto}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.card{background:var(--card);border:1.5px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .3s}
.card.flash{box-shadow:0 0 0 4px #e1337e}
.head{display:flex;gap:12px;align-items:center;padding:14px 16px;color:#fff}
.head img{flex:none;width:48px;height:48px;image-rendering:pixelated;background:rgba(255,255,255,.18);border-radius:10px;padding:4px}
.head h3{font-size:26px;font-weight:800}
.fam{font-size:14px;font-weight:600;opacity:.95}
.tags{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px 0}
.tag{font-size:13px;font-weight:700;padding:2px 9px;border-radius:10px;background:var(--soft);border:1px solid var(--line);white-space:nowrap}
.tag .d{margin-right:6px}
.text{margin:10px 16px 0;padding:10px 12px;border-radius:10px;background:var(--soft);font-size:15px}
.kw{color:var(--kw)}
.terms{margin:6px 16px 0;padding:0;list-style:none;font-size:14px;color:var(--mute)}
.terms b{color:var(--ink)}
.sec{padding:6px 16px 0}
.sec h4{margin:6px 0 4px;font-size:13px;font-weight:800;color:var(--mute)}
.sec ul{list-style:none;margin:0;padding:0}
.sec li{padding:3px 0;font-size:15px;line-height:1.4}
.wb{font:800 15px "Nunito Sans",sans-serif;background:none;border:0;padding:0;color:inherit;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;cursor:pointer}
.wb.na{text-decoration:none;cursor:default}
.clash .wb{text-decoration-style:dashed}
.gap{padding:8px 16px 0;margin:0;font-size:14px;font-weight:700;color:var(--dn)}
.bal{margin-top:auto;padding:12px 16px;border-top:1px solid var(--line);background:var(--soft);font-size:14px;line-height:1.4}
.up{color:var(--up)}.dn{color:var(--dn)}
.mh{font-size:clamp(24px,3vw,32px);font-weight:800}
.scroll{overflow-x:auto}
.mx{min-width:820px;font-size:14px;border-collapse:collapse;width:100%}
.mx th,.mx td{border:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.mx thead th{border-bottom:2px solid var(--ink)}
.mx td:empty{background:var(--soft)}
.mx .wb{font-size:14px;font-weight:700;margin-right:8px;white-space:nowrap}
.rdesc{color:var(--mute);font-size:14px;width:100%;margin:0}
.empty{grid-column:1/-1;padding:30px;text-align:center;color:var(--mute)}
table.stack{width:100%;border-collapse:collapse;font-size:15px}
.stack th{text-align:left;font-size:13px;color:var(--mute);padding:8px 10px;border-bottom:2px solid var(--ink)}
.stack td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.stack td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.foot{color:var(--mute);font-size:14px;max-width:75ch;margin-top:16px}
@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.grid{grid-template-columns:minmax(0,1fr)}.row{grid-template-columns:6.6em minmax(0,1fr) 3.6em;gap:8px}.count{margin-left:0;width:100%}#q{max-width:none}}
@media(max-width:600px){.stack thead{display:none}.stack tr{display:grid;padding-block:10px;border-bottom:1px solid var(--line)}.stack td{display:flex;justify-content:space-between;gap:12px;border:0;padding:3px 0;text-align:right}.stack td::before{content:attr(data-l);font-weight:800;color:var(--mute);text-align:left}}
@media(prefers-reduced-motion:reduce){.card{transition:none}}
</style>
</head>
<body>
<header class="band top"><div class="wrap">
  <h1>Jam Jar fruit book</h1>
  <p>Every fruit in the game, with its card as the game words it, what each keyword means, its build family and roles, the fruit it works with, and what the balance bots have measured. Written from the game's code on <span id="stamp"></span>.</p>
  <div class="chart">
    <h2 id="headline"></h2>
    <p class="sub">Points a run for a bot that takes this fruit whenever offered, minus a bot that never picks, in the same test (24 seeds, rent ignored). Differences inside about ±40 are run-to-run noise.</p>
    <div id="rows"></div>
    <div class="legend"><span><i style="background:var(--jam2)"></i>Noise band, ±40</span><span><i style="background:var(--up)"></i>Above never picking</span><span><i style="background:var(--dn)"></i>Below</span></div>
  </div>
</div></header>
<section class="band" style="padding-bottom:0"><div class="wrap">
  <h2 class="mh">Roles by build family</h2>
  <p class="sub">Each fruit you can pick, by family and role. Empty cells are gaps; tap a name to jump to its card.</p>
  <div class="scroll"><table class="mx" id="mx"></table></div>
</div></section>
<main class="band"><div class="wrap">
  <div class="tools" id="rtools"></div>
  <div class="tools" id="tools"><input id="q" type="search" placeholder="Search fruit or card" aria-label="Search fruit or card"><span class="count" id="count"></span></div>
  <div class="grid" id="grid"></div>
</div></main>
<section class="band" style="background:var(--soft)"><div class="wrap">
  <h2 class="mh">Builds the bots have played</h2>
  <p class="sub">Whole decks rather than single picks. Points a run with the rent ignored; last rent is how many runs scored 400 in cycle 5.</p>
  <div class="scroll"><table class="stack"><thead><tr><th>Build</th><th>Fruit</th><th>Points a run</th><th>Last rent</th><th>What it shows</th></tr></thead><tbody id="builds"></tbody></table></div>
  <p class="foot">Baselines differ between tests, which is why each fruit is compared with never picking in its own test. Fruit with no measure have only been played inside builds. The bots buy nothing in the shop, so coins (the Golden Apple) show as nothing.</p>
</div></section>
<script>
{
const D=${data};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const id=n=>"f-"+n.toLowerCase().replace(/[^a-z]+/g,"-");
const names=new Set(D.fruit.map(f=>f.name));
document.getElementById("stamp").textContent=D.stamp;
{const ahead=D.measured.filter(m=>m.points-m.base>40).map(m=>m.name);const list=ahead.length<2?ahead.join(""):ahead.slice(0,-1).join(", ")+" and "+ahead.at(-1);
document.getElementById("headline").textContent=ahead.length===0?"No single fruit clearly beats skipping every pick":(ahead.length===1?"Only ":"Only ")+list+" clearly "+(ahead.length===1?"beats":"beat")+" skipping every pick";}
const lo=-160,hi=160,pct=v=>(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo)*100;
document.getElementById("rows").innerHTML=D.measured.map(m=>({...m,d:m.points-m.base})).sort((a,b)=>b.d-a.d).map(r=>{
  const a=pct(Math.min(0,r.d)),b=pct(Math.max(0,r.d));
  const col=Math.abs(r.d)<=40?"var(--mute)":(r.d>0?"var(--up)":"var(--dn)");
  return '<div class="row"><div><b>'+esc(r.name)+'</b><small>'+r.points.toLocaleString()+' vs '+r.base.toLocaleString()+'</small></div><div class="track"><div class="noise" style="left:'+pct(-40)+'%;width:'+(pct(40)-pct(-40))+'%"></div><div class="bar" style="left:'+a+'%;width:'+Math.max(b-a,.6)+'%;background:'+col+'"></div><div class="zero" style="left:'+pct(0)+'%"></div></div><div class="val">'+(r.d>0?"+":"")+r.d+'</div></div>';
}).join("");
const li=arr=>arr.map(([n,why])=>'<li>'+(names.has(n)?'<button class="wb" data-go="'+id(n)+'">'+esc(n)+'</button>':'<span class="wb na">'+esc(n)+'</span>')+' — '+esc(why)+'</li>').join("");
const card=f=>{
  const c=D.families[f.family].colour,m=D.measured.find(x=>x.kind===f.kind);
  let bal="No solo bot measure yet";
  if(m){const d=m.points-m.base,cls=Math.abs(d)<=40?"":(d>0?"up":"dn");bal='Bot taking it: <b>'+m.points.toLocaleString()+'</b> a run vs <b>'+m.base.toLocaleString()+'</b> never picking, <b class="'+cls+'">'+(d>0?"+":"")+d+'</b>'+(Math.abs(d)<=40?" (noise)":"")+(m.note?". "+esc(m.note):"");}
  return '<article class="card" id="'+id(f.name)+'"><div class="head" style="background:'+c+'"><img src="'+f.sprite+'" alt=""><div><h3>'+esc(f.name)+'</h3><div class="fam">'+esc(f.family)+' · '+esc(D.families[f.family].about)+'</div></div></div>'
   +'<div class="tags">'+f.roles.map(r=>'<span class="tag"><span class="d" style="background:'+D.roles[r].colour+'"></span>'+esc(r)+'</span>').join("")+'<span class="tag">'+esc(f.scoring)+'</span>'+(f.slots>1?'<span class="tag">'+f.slots+' tray slots</span>':'')+'<span class="tag">'+esc(f.source)+'</span></div>'
   +'<p class="text">'+f.card+'</p>'+(f.terms.length?'<ul class="terms">'+f.terms.map(([k,t])=>'<li><b>'+esc(k)+'</b>: '+esc(t)+'</li>').join("")+'</ul>':'')
   +(f.gap?'<p class="gap">'+esc(f.gap)+'</p>':'')
   +(f.works.length?'<div class="sec"><h4>Works with</h4><ul>'+li(f.works)+'</ul></div>':'')
   +(f.clashes.length?'<div class="sec clash"><h4>Clashes with</h4><ul>'+li(f.clashes)+'</ul></div>':'')
   +'<div class="bal" style="margin-top:14px">'+bal+'</div></article>';
};
let fam="All",role="All",q="";
const tools=document.getElementById("tools"),qi=document.getElementById("q"),grid=document.getElementById("grid"),count=document.getElementById("count");
qi.insertAdjacentHTML("beforebegin",["All",...Object.keys(D.families)].map(k=>'<button class="chip" data-f="'+esc(k)+'" aria-pressed="'+(k==="All")+'">'+(k==="All"?"":'<span class="d" style="background:'+D.families[k].colour+'"></span>')+esc(k)+'</button>').join(""));
const rtools=document.getElementById("rtools");
rtools.innerHTML=["All roles",...Object.keys(D.roles)].map(k=>'<button class="chip" data-r="'+esc(k)+'" aria-pressed="'+(k==="All roles")+'">'+(k==="All roles"?"":'<span class="d" style="background:'+D.roles[k].colour+'"></span>')+esc(k)+'</button>').join("")+'<p class="rdesc" id="rdesc"></p>';
const rdesc=document.getElementById("rdesc");
const render=()=>{
  const t=q.trim().toLowerCase();
  const list=D.fruit.filter(f=>(fam==="All"||f.family===fam)&&(role==="All"||f.roles.includes(role))&&(!t||(f.name+" "+f.card+" "+f.family).toLowerCase().includes(t)));
  grid.innerHTML=list.length?list.map(card).join(""):'<div class="empty">No fruit matches “'+esc(q)+'”.</div>';
  count.textContent=list.length+" of "+D.fruit.length+" shown";
};
tools.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;fam=b.dataset.f;tools.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",c===b));render()});
rtools.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;role=b.dataset.r==="All roles"?"All":b.dataset.r;rtools.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",c===b));rdesc.textContent=role==="All"?"":D.roles[role].about;render()});
qi.addEventListener("input",()=>{q=qi.value;render()});
const jump=e=>{
  const b=e.target.closest("[data-go]");if(!b)return;
  let el=document.getElementById(b.dataset.go);
  if(!el){fam="All";role="All";q="";qi.value="";rdesc.textContent="";tools.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.f==="All"));rtools.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.r==="All roles"));render();el=document.getElementById(b.dataset.go)}
  if(!el)return;
  el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
  el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),1400);
};
grid.addEventListener("click",jump);
const fams=Object.keys(D.families),roles=Object.keys(D.roles).filter(r=>r!=="Starter"&&r!=="Merge result");
const mx=document.getElementById("mx");
mx.innerHTML='<thead><tr><th>Role</th>'+fams.map(f=>'<th><span class="d" style="background:'+D.families[f].colour+';margin-right:6px"></span>'+esc(f)+'</th>').join("")+'</tr></thead><tbody>'+roles.map(r=>'<tr><th><span class="d" style="background:'+D.roles[r].colour+';margin-right:6px"></span>'+esc(r)+'</th>'+fams.map(f=>'<td>'+D.fruit.filter(x=>x.family===f&&x.roles.includes(r)).map(x=>'<button class="wb" data-go="'+id(x.name)+'">'+esc(x.name)+'</button>').join("")+'</td>').join("")+'</tr>').join("")+'</tbody>';
mx.addEventListener("click",jump);
render();
document.getElementById("builds").innerHTML=D.builds.map(r=>'<tr><td data-l="Build"><b>'+esc(r[0])+'</b></td><td data-l="Fruit">'+esc(r[1])+'</td><td data-l="Points a run" class="n">'+esc(r[2])+'</td><td data-l="Last rent" class="n">'+esc(r[3])+'</td><td data-l="What it shows">'+esc(r[4])+'</td></tr>').join("");
}
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`wrote ${out}: ${fruit.length} fruit`);
