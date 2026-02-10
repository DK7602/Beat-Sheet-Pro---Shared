/* Beat Sheet Pro - app.js (FULL REPLACE) */
(() => {
"use strict";

/**
 * ✅ STORAGE ISOLATION
 * Scopes localStorage keys to the FIRST folder in the URL path.
 * Examples:
 *  - https://dk7602.github.io/Beat-Sheet-Pro/           => scope "Beat-Sheet-Pro"
 *  - https://dk7602.github.io/Hobo-Beat-Sheet-/         => scope "Hobo-Beat-Sheet-"
 *
 * Result: Main + Shared DO NOT share projects/recordings.
 */

const APP_VERSION = "v20260210_shared_1"; // bump so you can confirm update is live

const need = (id) => document.getElementById(id);
const els = {
  exportBtn: need("exportBtn"),
  saveBtn: need("saveBtn"),
  bpm: need("bpm"),
  metroBtn: need("metroBtn"),
  highlightMode: need("highlightMode"),
  autoSplitMode: need("autoSplitMode"),
  projectSort: need("projectSort"),
  toast: need("toast"),
  statusText: need("statusText"),

  headerToggle: need("headerToggle"),
  headerToggle2: need("headerToggle2"),

  sectionTabs: need("sectionTabs"),
  bars: need("bars"),

  projectName: need("projectName"),
  projectList: need("projectList"),
  newProjectBtn: need("newProjectBtn"),

  recordBtn: need("recordBtn"),
  recordName: need("recordName"),
  recordingsList: need("recordingsList"),
  recHint: need("recHint"),

  rhymeDock: need("rhymeDock"),
  rhymeBase: need("rhymeBase"),
  rhymeList: need("rhymeList"),
  dockToggle: need("dockToggle"),
};

// ✅ NEW: repo/folder-scoped storage keys (this is the isolation)
const STORAGE_SCOPE = (() => {
  // first folder after domain, e.g. "/Beat-Sheet-Pro/" or "/Hobo-Beat-Sheet-/"
  const firstFolder = (location.pathname.split("/").filter(Boolean)[0] || "root");
  return firstFolder.replace(/[^a-z0-9_-]+/gi, "_");
})();
const KEY_PREFIX = `beatsheetpro__${STORAGE_SCOPE}__`;

const STORAGE_KEY = `${KEY_PREFIX}projects_v1`;
const RHYME_CACHE_KEY = `${KEY_PREFIX}rhyme_cache_v1`;
const DOCK_HIDDEN_KEY = `${KEY_PREFIX}rhymeDock_hidden_v1`;
const HEADER_COLLAPSED_KEY = `${KEY_PREFIX}header_collapsed_v1`;

// ✅ Optional: one-time migration from old global keys (ONLY if scoped is empty)
const OLD_STORAGE_KEY = "beatsheetpro_projects_v1";
const OLD_RHYME_CACHE_KEY = "beatsheetpro_rhyme_cache_v1";
const OLD_DOCK_HIDDEN_KEY = "beatsheetpro_rhymeDock_hidden_v1";
const OLD_HEADER_COLLAPSED_KEY = "beatsheetpro_header_collapsed_v1";

(function migrateOldKeysOnce(){
  try{
    if(!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_STORAGE_KEY)){
      localStorage.setItem(STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY));
    }
    if(!localStorage.getItem(RHYME_CACHE_KEY) && localStorage.getItem(OLD_RHYME_CACHE_KEY)){
      localStorage.setItem(RHYME_CACHE_KEY, localStorage.getItem(OLD_RHYME_CACHE_KEY));
    }
    if(!localStorage.getItem(DOCK_HIDDEN_KEY) && localStorage.getItem(OLD_DOCK_HIDDEN_KEY)){
      localStorage.setItem(DOCK_HIDDEN_KEY, localStorage.getItem(OLD_DOCK_HIDDEN_KEY));
    }
    if(!localStorage.getItem(HEADER_COLLAPSED_KEY) && localStorage.getItem(OLD_HEADER_COLLAPSED_KEY)){
      localStorage.setItem(HEADER_COLLAPSED_KEY, localStorage.getItem(OLD_HEADER_COLLAPSED_KEY));
    }
  }catch{}
})();

const SECTION_DEFS = [
  { key:"verse1",  title:"Verse 1",  bars:16, extra:4 },
  { key:"chorus1", title:"Chorus 1", bars:12, extra:4 },
  { key:"verse2",  title:"Verse 2",  bars:16, extra:4 },
  { key:"chorus2", title:"Chorus 2", bars:12, extra:4 },
  { key:"verse3",  title:"Verse 3",  bars:16, extra:4 },
  { key:"chorus3", title:"Chorus 3", bars:12, extra:4 },
  { key:"bridge",  title:"Bridge",   bars: 8, extra:4 },
];

const FULL_ORDER = ["verse1","chorus1","verse2","chorus2","verse3","bridge","chorus3"];
const FULL_HEADINGS = FULL_ORDER.map(k => (SECTION_DEFS.find(s=>s.key===k)?.title || k).toUpperCase());
const headingSet = new Set(FULL_HEADINGS);

// ---------- utils ----------
const nowISO = () => new Date().toISOString();
const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

function showToast(msg){
  if(!els.toast) return;
  els.toast.textContent = msg || "Saved";
  els.toast.classList.add("show");
  setTimeout(()=>els.toast.classList.remove("show"), 1200);
}
function escapeHtml(s){
  return String(s || "").replace(/[&<>"]/g, (c)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;"
  }[c]));
}
function clampInt(v,min,max){
  if(Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// ---------- header collapse ----------
function loadHeaderCollapsed(){
  try{ return localStorage.getItem(HEADER_COLLAPSED_KEY) === "1"; }catch{ return false; }
}
function saveHeaderCollapsed(isCollapsed){
  try{ localStorage.setItem(HEADER_COLLAPSED_KEY, isCollapsed ? "1" : "0"); }catch{}
}
function setHeaderCollapsed(isCollapsed){
  document.body.classList.toggle("headerCollapsed", !!isCollapsed);
  if(els.headerToggle)  els.headerToggle.textContent  = isCollapsed ? "Show" : "Hide";
  if(els.headerToggle2) els.headerToggle2.textContent = isCollapsed ? "Show" : "Hide";
  saveHeaderCollapsed(!!isCollapsed);
  updateDockForKeyboard();
  updateBlinkTargets();
}
if(els.headerToggle){
  els.headerToggle.addEventListener("click", ()=>{
    const collapsed = document.body.classList.contains("headerCollapsed");
    setHeaderCollapsed(!collapsed);
  });
}
if(els.headerToggle2){
  els.headerToggle2.addEventListener("click", ()=>{
    const collapsed = document.body.classList.contains("headerCollapsed");
    setHeaderCollapsed(!collapsed);
  });
}

// Keep rhyme dock visible above keyboard (Android)
function updateDockForKeyboard(){
  const vv = window.visualViewport;
  if(!els.rhymeDock) return;
  if(!vv){
    els.rhymeDock.style.bottom = "10px";
    return;
  }
  const keyboardPx = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
  els.rhymeDock.style.bottom = (10 + keyboardPx) + "px";
}
if(window.visualViewport){
  window.visualViewport.addEventListener("resize", updateDockForKeyboard);
  window.visualViewport.addEventListener("scroll", updateDockForKeyboard);
}
window.addEventListener("resize", updateDockForKeyboard);

// ---------- rhyme dock hide/show ----------
function loadDockHidden(){
  try{ return localStorage.getItem(DOCK_HIDDEN_KEY) === "1"; }catch{ return false; }
}
function saveDockHidden(isHidden){
  try{ localStorage.setItem(DOCK_HIDDEN_KEY, isHidden ? "1" : "0"); }catch{}
}
function setDockHidden(isHidden){
  if(!els.rhymeDock || !els.dockToggle) return;
  els.rhymeDock.classList.toggle("dockHidden", !!isHidden);
  els.dockToggle.textContent = isHidden ? "R" : "Hide";
  saveDockHidden(!!isHidden);
  updateDockForKeyboard();
}
if(els.dockToggle){
  els.dockToggle.addEventListener("click", ()=>{
    const nowHidden = els.rhymeDock?.classList?.contains("dockHidden");
    setDockHidden(!nowHidden);
  });
}

// ---------- syllables ----------
function normalizeWord(w){ return (w||"").toLowerCase().replace(/[^a-z']/g,""); }

const SYLL_DICT = {
  "im":1,"i'm":1,"ive":1,"i've":1,"ill":1,"i'll":1,"id":1,"i'd":1,
  "dont":1,"don't":1,"cant":1,"can't":1,"wont":1,"won't":1,"aint":1,"ain't":1,
  "yeah":1,"ya":1,"yup":1,"nah":1,"yall":1,"y'all":1,"bruh":1,"bro":1,
  "wanna":2,"gonna":2,"tryna":2,"lemme":2,"gotta":2,"kinda":2,"outta":2,
  "toyota":3,"hiphop":2,"gfunk":2,"gangsta":2,"birthday":2
};

function countSyllablesWord(word){
  if(!word) return 0;

  const forced = String(word).match(/\((\d+)\)\s*$/);
  if(forced) return Math.max(1, parseInt(forced[1],10));

  let w = normalizeWord(word);
  if(!w) return 0;
  if(SYLL_DICT[w] != null) return SYLL_DICT[w];
  if(/^\d+$/.test(w)) return 1;
  if(w.length <= 3) return 1;

  w = w.replace(/'/g,"");
  if(/[^aeiou]e$/.test(w) && !/[^aeiou]le$/.test(w)) w = w.slice(0,-1);

  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  if(/(tion|sion|cion)$/.test(w)) count -= 1;
  if(/(ious|eous)$/.test(w)) count -= 1;
  if(/[^aeiou]le$/.test(w)) count += 1;

  return Math.max(1, count || 1);
}

function countSyllablesLine(line){
  const clean = (line||"").replace(/[\/]/g," ").trim();
  if(!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).reduce((sum,w)=>sum+countSyllablesWord(w),0);
}

function syllGlowClass(n){
  if(!n) return "";
  if(n <= 6) return "red";
  if(n <= 9) return "yellow";
  if(n <= 13) return "green";
  if(n <= 16) return "yellow";
  return "red";
}

// ---------- beat splitting ----------
function splitBySlashes(text){
  const parts = (text||"").split("/").map(s=>s.trim());
  return [parts[0]||"", parts[1]||"", parts[2]||"", parts[3]||""];
}

function autoSplitWords(text){
  const clean = (text||"").replace(/[\/]/g," ").trim();
  if(!clean) return ["","","",""];
  const words = clean.split(/\s+/);
  const per = Math.ceil(words.length/4) || 1;
  const per2 = per * 2;
  const per3 = per * 3;
  return [
    words.slice(0,per).join(" "),
    words.slice(per,per2).join(" "),
    words.slice(per2,per3).join(" "),
    words.slice(per3).join(" "),
  ];
}

function splitWordIntoChunks(word){
  const raw = String(word);
  const cleaned = raw.replace(/[^A-Za-z']/g,"");
  if(!cleaned) return [raw];
  const groups = cleaned.match(/[aeiouy]+|[^aeiouy]+/gi) || [cleaned];
  const out = [];
  for(const g of groups){
    if(out.length && /^[^aeiouy]+$/i.test(g) && g.length <= 2){
      out[out.length-1] += g;
    } else out.push(g);
  }
  return out.length ? out : [raw];
}

function chunkSyllCount(chunk){
  const w = String(chunk).toLowerCase().replace(/[^a-z']/g,"").replace(/'/g,"");
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, (groups ? groups.length : 0) || 1);
}

function buildTargets(total){
  const base = Math.floor(total/4);
  const rem = total % 4;
  const t = [base,base,base,base];
  for(let i=0;i<rem;i++) t[i] += 1;
  if(total < 4){
    t.fill(0);
    for(let i=0;i<total;i++) t[i] = 1;
  }
  return t;
}

function autoSplitSyllablesClean(text){
  const clean = (text||"").replace(/[\/]/g," ").trim();
  if(!clean) return ["","","",""];

  const words = clean.split(/\s+/).filter(Boolean);
  const sylls = words.map(w=>countSyllablesWord(w));
  const total = sylls.reduce((a,b)=>a+b,0);
  if(!total) return ["","","",""];

  const targets = buildTargets(total);
  const beats = [[],[],[],[]];
  const beatSyll = [0,0,0,0];
  let b = 0;

  function pushWord(beatIndex, w){ beats[beatIndex].push(w); }

  for(let i=0;i<words.length;i++){
    const w = words[i];
    const s = sylls[i];

    while(b < 3 && beatSyll[b] >= targets[b]) b++;
    const remaining = targets[b] - beatSyll[b];
    if(remaining <= 0 && b < 3) b++;

    const rem2 = targets[b] - beatSyll[b];

    if(s <= rem2 || b === 3){
      pushWord(b, w);
      beatSyll[b] += s;
      continue;
    }

    if(rem2 <= 1 && b < 3){
      b++;
      pushWord(b, w);
      beatSyll[b] += s;
      continue;
    }

    const chunks = splitWordIntoChunks(w);
    const chunkS = chunks.map(chunkSyllCount);

    let take = [];
    let takeSyll = 0;

    for(let c=0;c<chunks.length;c++){
      if(takeSyll + chunkS[c] > rem2 && take.length > 0) break;
      take.push(chunks[c]);
      takeSyll += chunkS[c];
      if(takeSyll >= rem2) break;
    }

    if(!take.length){
      pushWord(b, w);
      beatSyll[b] += s;
      continue;
    }

    const left = take.join("");
    const right = chunks.slice(take.length).join("");

    pushWord(b, left);
    beatSyll[b] += takeSyll;

    if(b < 3){
      b++;
      pushWord(b, right);
      beatSyll[b] += Math.max(1, s - takeSyll);
    }else{
      pushWord(b, right);
      beatSyll[b] += Math.max(1, s - takeSyll);
    }
  }

  return beats.map(arr=>arr.join(" ").trim());
}

function computeBeats(text, mode){
  const hasSlash = (text||"").includes("/");
  if(hasSlash) return splitBySlashes(text);
  if(mode === "none") return ["","","",""];
  if(mode === "words") return autoSplitWords(text);
  return autoSplitSyllablesClean(text);
}

// ---------- rhymes ----------
const rhymeCache = (() => {
  try{ return JSON.parse(localStorage.getItem(RHYME_CACHE_KEY) || "{}"); }
  catch{ return {}; }
})();
function saveRhymeCache(){
  try{ localStorage.setItem(RHYME_CACHE_KEY, JSON.stringify(rhymeCache)); }catch{}
}
let rhymeAbort = null;

// ✅ Track last focused textarea so rhyme chips always insert
let lastFocusedTextarea = null;
document.addEventListener("focusin", (e) => {
  const t = e.target;
  if(t && t.tagName === "TEXTAREA") lastFocusedTextarea = t;
});

function lastWord(str){
  const s = (str||"").toLowerCase().replace(/[^a-z0-9'\s-]/g," ").trim();
  if(!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length-1].replace(/^-+|-+$/g,"") : "";
}

function caretBeatIndex(text, caretPos){
  const before = (text||"").slice(0, Math.max(0, caretPos||0));
  const count = (before.match(/\//g) || []).length;
  return Math.max(0, Math.min(3, count));
}

async function updateRhymes(seed){
  const w = (seed||"").toLowerCase().replace(/[^a-z0-9']/g,"").trim();
  if(!w){
    els.rhymeBase.textContent = "Tap into a beat…";
    els.rhymeList.innerHTML = `<span class="small">Rhymes appear for last word in previous beat box.</span>`;
    return;
  }

  els.rhymeBase.textContent = w;

  if(Array.isArray(rhymeCache[w]) && rhymeCache[w].length){
    renderRhymes(rhymeCache[w]);
    return;
  }

  els.rhymeList.innerHTML = `<span class="small">Loading…</span>`;

  try{
    if(rhymeAbort) rhymeAbort.abort();
    rhymeAbort = new AbortController();

    const url = `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(w)}&max=18`;
    const res = await fetch(url, { signal: rhymeAbort.signal });
    const data = await res.json();
    const words = (data||[]).map(x=>x.word).filter(Boolean);

    rhymeCache[w] = words;
    saveRhymeCache();
    renderRhymes(words);
  }catch(e){
    if(String(e).includes("AbortError")) return;
    els.rhymeList.innerHTML = `<span class="small" style="color:#b91c1c;">Rhyme lookup failed.</span>`;
  }
}

function renderRhymes(words){
  if(!words || !words.length){
    els.rhymeList.innerHTML = `<span class="small">No rhymes found.</span>`;
    return;
  }
  els.rhymeList.innerHTML = words.slice(0,18)
    .map(w=>`<button type="button" class="rhymeChip" data-rhyme="${escapeHtml(w)}">${escapeHtml(w)}</button>`)
    .join("");
}

// ✅ Always insert into the last textarea you were typing in
document.addEventListener("click", (e)=>{
  const chip = e.target.closest(".rhymeChip");
  if(!chip) return;

  const w = (chip.getAttribute("data-rhyme") || chip.textContent || "").trim();
  if(!w) return;

  const active = (document.activeElement && document.activeElement.tagName === "TEXTAREA")
    ? document.activeElement
    : lastFocusedTextarea;

  if(active && active.tagName === "TEXTAREA"){
    const start = active.selectionStart ?? active.value.length;
    const end = active.selectionEnd ?? active.value.length;
    const before = active.value.slice(0,start);
    const after = active.value.slice(end);
    const spacer = before && !/\s$/.test(before) ? " " : "";
    active.value = before + spacer + w + after;
    active.dispatchEvent(new Event("input",{ bubbles:true }));
    active.focus();
    const pos = (before + spacer + w).length;
    active.setSelectionRange(pos,pos);
    showToast("Inserted");
    return;
  }

  navigator.clipboard?.writeText?.(w)
    .then(()=>showToast("Copied rhyme"))
    .catch(()=>showToast("Copy failed"));
});

/* -----------------------
   EVERYTHING BELOW THIS
   stays the same as your existing app.js
   (projects, metronome, recording, rendering, etc.)
   ----------------------- */

// ---------- projects ----------
function blankSections(){
  const sections = {};
  for(const s of SECTION_DEFS){
    sections[s.key] = {
      key: s.key,
      title: s.title,
      bars: Array.from({length: s.bars + s.extra}, ()=>({ text:"" })),
    };
  }
  return sections;
}

function newProject(name=""){
  return {
    id: uid(),
    name: name || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    activeSection: "verse1",
    bpm: 95,
    highlightMode: "focused",
    autoSplitMode: "syllables",
    recordings: [],
    sections: blankSections(),
  };
}

function loadStore(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const p = newProject("");
    const s = { activeProjectId: p.id, projects:[p], projectSort:"recent" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  try{ return JSON.parse(raw); }
  catch{
    localStorage.removeItem(STORAGE_KEY);
    return loadStore();
  }
}

let store = loadStore();

function repairProject(p){
  if(!p.sections || typeof p.sections !== "object") p.sections = blankSections();
  for(const def of SECTION_DEFS){
    if(!p.sections[def.key] || !Array.isArray(p.sections[def.key].bars)){
      p.sections[def.key] = { key:def.key, title:def.title, bars:Array.from({length:def.bars+def.extra}, ()=>({text:""})) };
    }
  }
  if(!p.activeSection) p.activeSection = "verse1";
  if(!Array.isArray(p.recordings)) p.recordings = [];
  if(!p.bpm) p.bpm = 95;
  if(!p.highlightMode) p.highlightMode = "focused";
  if(!p.autoSplitMode) p.autoSplitMode = "syllables";
  return p;
}

store.projects = (store.projects || []).map(repairProject);
if(!store.projects.length){
  const p = newProject("");
  store.projects = [p];
  store.activeProjectId = p.id;
}
if(!store.activeProjectId || !store.projects.find(p=>p.id===store.activeProjectId)){
  store.activeProjectId = store.projects[0].id;
}

function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function getActiveProject(){ return store.projects.find(p=>p.id===store.activeProjectId) || store.projects[0]; }
function touchProject(p){ p.updatedAt = nowISO(); saveStore(); }

// ✅ NOTE: your eye-blink + metronome + recording code continues below exactly as you already have it.
// Paste the remainder of your existing file here unchanged.

})();
