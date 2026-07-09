// fallgarden SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallgarden/index.html · 42118 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

'use strict';
// ─── State ───────────────────────────────────────────────────────
const G = {
  vaultHandle: null,           // FileSystemDirectoryHandle (or null)
  vaultName: 'vault',
  files: new Map(),            // path → {path, name, body, mtime, handle}
  currentPath: null,
  openTabs: [],                // [path, path, ...]
  dirty: false,
  saveTimer: null,
  mode: 'edit',                // edit|split|preview
  activePane: 'editor',        // editor|graph|search
  filter: '',
  tagFilter: null,
  idb: null,
  fk: null,
  fkFallback: !!window.__fkFail,
};
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const esc = s => (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ─── IDB fallback (Firefox/Safari) ─────────────────────────────
function openIDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open('fallgarden',1);
    r.onupgradeneeded = e => { const db = e.target.result; if(!db.objectStoreNames.contains('files')) db.createObjectStore('files',{keyPath:'path'}); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbAll(){ const db = G.idb||(G.idb=await openIDB()); return new Promise(r=>{ const tx=db.transaction('files','readonly'); const rq=tx.objectStore('files').getAll(); rq.onsuccess=()=>r(rq.result||[]); }); }
async function idbPut(rec){ const db = G.idb||(G.idb=await openIDB()); return new Promise(r=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(rec); tx.oncomplete=r; }); }
async function idbDel(path){ const db = G.idb||(G.idb=await openIDB()); return new Promise(r=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(path); tx.oncomplete=r; }); }
// ─── Vault load ────────────────────────────────────────────────
async function openVault(){
  try {
    G.vaultHandle = h;
    G.vaultName = h.name;
    G.files.clear();
    await walkDir(h, '');
    if (G.files.size===0){
      const name = 'Welcome.md';
      const body = welcomeBody();
      G.files.set(name,{path:name,name,body,mtime:Date.now(),handle:null});
      await writeFileFS(name, body);
    }
    renderTree(); renderTags(); openFile([...G.files.keys()][0]);
    $('s-sync').textContent = 'FS · '+G.vaultName;
  } catch(e){ if (e.name!=='AbortError') alert('Open failed: '+e.message); }
}
async function openIDBVault(){
  const recs = await idbAll();
  G.vaultHandle = null;
  G.vaultName = 'idb-vault';
  G.files.clear();
  for(const r of recs) G.files.set(r.path,{path:r.path,name:r.path.split('/').pop(),body:r.body,mtime:r.mtime||Date.now(),handle:null});
  if (G.files.size===0){
    const b = welcomeBody();
    G.files.set('Welcome.md',{path:'Welcome.md',name:'Welcome.md',body:b,mtime:Date.now(),handle:null});
    await idbPut({path:'Welcome.md',body:b,mtime:Date.now()});
  }
  renderTree(); renderTags(); openFile([...G.files.keys()][0]);
  $('s-sync').textContent = 'IDB · '+G.vaultName;
  const inp = document.createElement('input');
  inp.type='file'; inp.multiple=true; inp.accept='.md,.markdown,.txt';
  inp.onchange = async () => {
    for(const f of inp.files){
      const body = await f.text();
      const path = f.webkitRelativePath || f.name;
      G.files.set(path,{path,name:f.name,body,mtime:Date.now(),handle:null});
      await idbPut({path,body,mtime:Date.now()});
    }
    renderTree(); renderTags();
  };
  window.__fgImport = () => inp.click();
}
async function walkDir(dir, prefix){
  for await (const [name, handle] of dir.entries()){
    if (name.startsWith('.')) continue;
    const path = prefix ? prefix + '/' + name : name;
    if (handle.kind === 'file'){
      if (!/\.(md|markdown|txt)$/i.test(name)) continue;
      try {
        const f = await handle.getFile();
        const body = await f.text();
        G.files.set(path, {path, name, body, mtime:f.lastModified, handle});
      } catch(e){}
    } else if (handle.kind === 'directory'){
      await walkDir(handle, path);
    }
  }
}
async function writeFileFS(path, body){
  if (!G.vaultHandle) return idbPut({path,body,mtime:Date.now()});
  const parts = path.split('/');
  const fname = parts.pop();
  let dir = G.vaultHandle;
  for(const p of parts) dir = await dir.getDirectoryHandle(p,{create:true});
  const fh = await dir.getFileHandle(fname,{create:true});
  const ws = await fh.createWritable();
  await ws.write(body);
  await ws.close();
  const rec = G.files.get(path);
  if (rec){ rec.handle = fh; rec.mtime = Date.now(); }
}
async function deleteFileFS(path){
  const rec = G.files.get(path); if(!rec) return;
  if (G.vaultHandle){
    const parts = path.split('/'); const fname = parts.pop();
    let dir = G.vaultHandle;
    try { for(const p of parts) dir = await dir.getDirectoryHandle(p); await dir.removeEntry(fname); }catch(e){}
  } else await idbDel(path);
  G.files.delete(path);
}
function welcomeBody(){
  return `# Welcome to *FallGarden*
Sovereign, file-based second brain. Obsidian-shape. Nothing leaves your device unless you opt in.
## Try it
- Create a note with **New Note** (top bar)
- Link between notes with \`[[double brackets]]\` — try this: [[Ideas]]
- Add a tag with \`#\` — like #welcome or #sovereign
- Open the **Graph** to see how everything connects
- Search with **Ctrl+Shift+F**
- Command palette: **Ctrl+K**
- Split view: **Ctrl+E**
## What FallGarden is not
FallGarden is not [[fallnote]] (block-based, Notion-shape). It's the file-based cousin.
It doesn't collide with [[fallvault]] (encrypted backup, different purpose).
## Semantic search
Optional. Opt-in via ⚙ Settings → cascade. Uses fall-kit (T0/T2 WebLLM / T3 BYOK).
Off by default. Your prose stays sovereign.
\`\`\`
\`\`\`
`;
}
// ─── Markdown parser (mini) ─────────────────────────────────────
function md(src, filesSet){
  const lines = src.split(/\r?\n/);
  let out = ''; let i = 0;
  const inline = t => {
    t = esc(t);
    // code
    t = t.replace(/`([^`]+)`/g, (_,c)=>`<code>${c}</code>`);
    // wikilink
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_,link,alias)=>{
      const target = link.trim();
      const disp = (alias||target).trim();
      const key = target.endsWith('.md')?target:target+'.md';
      const broken = filesSet && !hasNote(filesSet, key) ? ' broken' : '';
      return `<span class="wikilink${broken}" data-link="${esc(key)}">${esc(disp)}</span>`;
    });
    // tag
    t = t.replace(/(^|\s)#([a-zA-Z0-9_/-]+)/g,'$1<span class="tag" data-tag="$2">#$2</span>');
    // bold/italic
    t = t.replace(/\*\*([^\*]+)\*\*/g,'<strong>$1</strong>');
    t = t.replace(/\*([^\*]+)\*/g,'<em>$1</em>');
    t = t.replace(/__([^_]+)__/g,'<strong>$1</strong>');
    t = t.replace(/(^|[^\w])_([^_]+)_/g,'$1<em>$2</em>');
    // strikethrough
    t = t.replace(/~~([^~]+)~~/g,'<del>$1</del>');
    // markdown link (plain)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    // task
    t = t.replace(/^\[( |x|X)\]\s*/, m=>`<input type="checkbox" disabled${/x/i.test(m)?' checked':''}>`);
    return t;
  };
  while(i<lines.length){
    let ln = lines[i];
    if (/^```/.test(ln)){
      const lang = ln.slice(3).trim(); let code=''; i++;
      while(i<lines.length && !/^```/.test(lines[i])){ code += lines[i]+'\n'; i++; }
      out += `<pre><code data-lang="${esc(lang)}">${esc(code)}</code></pre>`; i++; continue;
    }
    if (/^#{1,6}\s/.test(ln)){
      const m = ln.match(/^(#{1,6})\s+(.*)$/);
      out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue;
    }
    if (/^>\s?/.test(ln)){
      let buf=''; while(i<lines.length && /^>\s?/.test(lines[i])){ buf += lines[i].replace(/^>\s?/,'')+'\n'; i++; }
      out += `<blockquote>${md(buf.trim(),filesSet)}</blockquote>`; continue;
    }
    if (/^(\s*)[-*+]\s+/.test(ln)){
      let buf=''; while(i<lines.length && /^(\s*)[-*+]\s+/.test(lines[i])){ buf += '<li>'+inline(lines[i].replace(/^(\s*)[-*+]\s+/,''))+'</li>'; i++; }
      out += `<ul>${buf}</ul>`; continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)){
      let buf=''; while(i<lines.length && /^\s*\d+\.\s+/.test(lines[i])){ buf += '<li>'+inline(lines[i].replace(/^\s*\d+\.\s+/,''))+'</li>'; i++; }
      out += `<ol>${buf}</ol>`; continue;
    }
    if (/^\|.+\|/.test(ln) && i+1<lines.length && /^\|[-:| ]+\|$/.test(lines[i+1])){
      const parseRow = r => r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      const head = parseRow(ln); i+=2;
      let rows = '';
      while(i<lines.length && /^\|.+\|/.test(lines[i])){ rows += '<tr>'+parseRow(lines[i]).map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>'; i++; }
      out += `<table><thead><tr>${head.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`; continue;
    }
    if (/^---+$/.test(ln.trim())){ out += '<hr>'; i++; continue; }
    if (!ln.trim()){ i++; continue; }
    let para = ln; i++;
    while(i<lines.length && lines[i].trim() && !/^(#|>|```|\||-|\*|\+|\d+\.)/.test(lines[i])){ para += ' '+lines[i]; i++; }
    out += `<p>${inline(para)}</p>`;
  }
  return out;
}
function hasNote(filesSet, key){
  if (filesSet.has(key)) return true;
  for(const p of filesSet.keys()){ if (p.endsWith('/'+key) || p === key) return true; }
  return false;
}
function resolveNote(key){
  key = key.endsWith('.md')?key:key+'.md';
  if (G.files.has(key)) return key;
  for(const p of G.files.keys()){ if (p.endsWith('/'+key)) return p; }
  return null;
}
// ─── Rendering ──────────────────────────────────────────────────
function renderTree(){
  const tree = $('filetree'); tree.innerHTML = '';
  const paths = [...G.files.keys()].filter(p=>{
    if (G.filter && !p.toLowerCase().includes(G.filter.toLowerCase())) return false;
    if (G.tagFilter){ const body = G.files.get(p).body; const rx = new RegExp('(^|\\s)#'+G.tagFilter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|$)'); if (!rx.test(body)) return false; }
    return true;
  }).sort();
  if (!paths.length){ tree.appendChild(el('div','tree-empty','no matches')); return; }
  // group by folder
  const root = {folders:{}, files:[]};
  for(const p of paths){
    const parts = p.split('/');
    let cur = root;
    for(let i=0;i<parts.length-1;i++){
      cur.folders[parts[i]] = cur.folders[parts[i]] || {folders:{},files:[]};
      cur = cur.folders[parts[i]];
    }
    cur.files.push({name:parts[parts.length-1],path:p});
  }
  function render(node, parent){
    for(const fname of Object.keys(node.folders).sort()){
      const div = el('div','tree-item tree-folder');
      div.innerHTML = `<span class="icon">▸</span> ${esc(fname)}`;
      const children = el('div','tree-children');
      let open = true;
      div.onclick = () => { open=!open; children.style.display=open?'':'none'; div.querySelector('.icon').textContent=open?'▾':'▸'; };
      div.querySelector('.icon').textContent = '▾';
      parent.appendChild(div); parent.appendChild(children);
      render(node.folders[fname], children);
    }
    for(const f of node.files){
      const div = el('div','tree-item');
      if (f.path===G.currentPath) div.classList.add('on');
      div.innerHTML = `<span class="icon">·</span> ${esc(f.name.replace(/\.md$/,''))}`;
      div.onclick = () => openFile(f.path);
      div.oncontextmenu = e => { e.preventDefault(); if (confirm('Delete '+f.name+'?')){ deleteFileFS(f.path); if (G.currentPath===f.path){ G.currentPath=null; G.openTabs=G.openTabs.filter(t=>t!==f.path); showEmpty(); } renderTree(); renderTags(); } };
      parent.appendChild(div);
    }
  }
  render(root, tree);
}
function renderTags(){
  const tags = new Map();
  for(const [,f] of G.files){
    const found = f.body.match(/(^|\s)#[a-zA-Z0-9_/-]+/g) || [];
    for(const t of found){ const k = t.trim().slice(1); tags.set(k,(tags.get(k)||0)+1); }
  }
  const cont = $('taglist'); cont.innerHTML = '';
  if (!tags.size){ cont.appendChild(el('div','tree-empty','—')); cont.querySelector('.tree-empty').style.padding='0'; return; }
  const sorted = [...tags.entries()].sort((a,b)=>b[1]-a[1]);
  for(const [t,n] of sorted){
    const c = el('span','tag-chip','#'+t+' '+n);
    if (G.tagFilter===t) c.classList.add('on');
    c.onclick = () => { G.tagFilter = G.tagFilter===t?null:t; renderTree(); renderTags(); };
    cont.appendChild(c);
  }
}
function renderTabs(){
  const tabs = $('tabs'); tabs.innerHTML = '';
  for(const p of G.openTabs){
    const t = el('div','tab');
    if (p===G.currentPath) t.classList.add('on');
    const rec = G.files.get(p);
    if (!rec) continue;
    const label = el('span',null,rec.name.replace(/\.md$/,''));
    label.onclick = () => openFile(p);
    const x = el('span','close','×');
    x.onclick = e => { e.stopPropagation(); closeTab(p); };
    t.appendChild(label); t.appendChild(x);
    tabs.appendChild(t);
  }
}
function showEmpty(){
  $('dropzone2').onclick = openVault;
  $('s-path').textContent = 'no file';
  $('s-count').textContent = '0 words';
}
function renderEditor(){
  const path = G.currentPath;
  if (!path){ showEmpty(); return; }
  const rec = G.files.get(path); if(!rec) return;
  const pane = $('pane-editor');
  pane.innerHTML = `<div class="editor-wrap ${G.mode==='split'?'split':''}"><div class="editor" id="ed" contenteditable="plaintext-only" spellcheck="false"></div><div class="preview" id="pv"></div></div>`;
  const ed = $('ed'); const pv = $('pv');
  if (G.mode==='preview'){ ed.style.display='none'; pv.style.display='block'; pane.querySelector('.editor-wrap').style.gridTemplateColumns='1fr'; }
  ed.textContent = rec.body;
  pv.innerHTML = md(rec.body, G.files);
  ed.addEventListener('input', () => {
    rec.body = ed.textContent;
    pv.innerHTML = md(rec.body, G.files);
    markDirty();
  });
  ed.addEventListener('keydown', handleEdKey);
  pv.addEventListener('click', e => {
    const w = e.target.closest('.wikilink'); if (w){ e.preventDefault(); const k = w.dataset.link; const real = resolveNote(k.replace(/\.md$/,'')); if (real) openFile(real); else offerCreate(k); return; }
    const t = e.target.closest('.tag'); if (t){ G.tagFilter = t.dataset.tag; renderTree(); renderTags(); }
  });
  updateStatus(rec);
  renderBacklinks();
  renderOutgoing();
  renderMinimap();
}
let acState = null;
function handleEdKey(e){
  if (acState && (e.key==='Enter' || e.key==='Tab')){
    e.preventDefault(); insertAcSelection(); return;
  }
  if (acState && e.key==='Escape'){ hideAc(); return; }
  if (acState && e.key==='ArrowDown'){ e.preventDefault(); acState.idx=(acState.idx+1)%acState.items.length; renderAc(); return; }
  if (acState && e.key==='ArrowUp'){ e.preventDefault(); acState.idx=(acState.idx-1+acState.items.length)%acState.items.length; renderAc(); return; }
  setTimeout(checkAutocomplete, 0);
}
function checkAutocomplete(){
  if (!sel.rangeCount){ hideAc(); return; }
  const r = sel.getRangeAt(0);
  const node = r.startContainer;
  if (node.nodeType!==3){ hideAc(); return; }
  const text = node.textContent.slice(0, r.startOffset);
  const m = text.match(/\[\[([^\]]{0,40})$/);
  if (!m){ hideAc(); return; }
  const q = m[1].toLowerCase();
  const items = [...G.files.keys()].filter(p=>p.toLowerCase().includes(q)).slice(0,8);
  if (!items.length){ hideAc(); return; }
  const rect = r.getBoundingClientRect();
  const pw = $('workspace').getBoundingClientRect();
  acState = { items, idx:0, prefixLen:m[1].length };
  const box = $('acbox');
  box.style.left = (rect.left - pw.left) + 'px';
  box.style.top = (rect.bottom - pw.top + 4) + 'px';
  renderAc();
}
function renderAc(){
  if (!acState){ return; }
  const box = $('acbox'); box.innerHTML = '';
  acState.items.forEach((p,i)=>{
    const a = el('div','ac',p.replace(/\.md$/,''));
    if (i===acState.idx) a.classList.add('on');
    a.onmousedown = e => { e.preventDefault(); acState.idx=i; insertAcSelection(); };
    box.appendChild(a);
  });
  box.classList.add('on');
}
function hideAc(){ acState=null; $('acbox').classList.remove('on'); }
function insertAcSelection(){
  if (!acState) return;
  const target = acState.items[acState.idx].replace(/\.md$/,'');
  const r = sel.getRangeAt(0);
  const node = r.startContainer;
  const before = node.textContent.slice(0, r.startOffset - acState.prefixLen);
  const after = node.textContent.slice(r.startOffset);
  node.textContent = before + target + ']]' + after;
  const nr = document.createRange();
  nr.setStart(node, before.length + target.length + 2);
  nr.collapse(true);
  sel.removeAllRanges(); sel.addRange(nr);
  hideAc();
  const rec = G.files.get(G.currentPath); if (rec){ rec.body = $('ed').textContent; $('pv').innerHTML = md(rec.body, G.files); markDirty(); }
}
function markDirty(){
  G.dirty = true;
  $('save-dot').classList.add('dirty');
  $('save-status').textContent='dirty';
  clearTimeout(G.saveTimer);
  G.saveTimer = setTimeout(saveCurrent, 2000);
  updateStatus(G.files.get(G.currentPath));
}
async function saveCurrent(){
  if (!G.currentPath || !G.dirty) return;
  const rec = G.files.get(G.currentPath); if (!rec) return;
  try {
    await writeFileFS(rec.path, rec.body);
    G.dirty = false;
    $('save-dot').classList.remove('dirty');
    $('save-status').textContent='saved';
    setTimeout(()=>{ if (!G.dirty) $('save-status').textContent='ready'; }, 1500);
    renderBacklinks(); renderTags();
  } catch(e){ $('save-status').textContent='save fail: '+e.message; }
}
function updateStatus(rec){
  if (!rec){ return; }
  $('s-path').textContent = rec.path;
  const wc = (rec.body.match(/\S+/g)||[]).length;
  $('s-count').textContent = wc + ' words';
}
function renderBacklinks(){
  const cont = $('backlinks'); cont.innerHTML = '';
  if (!G.currentPath){ cont.appendChild(el('div','empty','—')); return; }
  const name = G.currentPath.split('/').pop().replace(/\.md$/,'');
  const hits = [];
  for(const [p,f] of G.files){
    if (p===G.currentPath) continue;
    const rx = new RegExp('\\[\\['+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\||\\])','i');
    if (rx.test(f.body)){
      const idx = f.body.search(rx);
      const snip = f.body.slice(Math.max(0,idx-30), idx+80).replace(/\n/g,' ');
      hits.push({path:p,snip});
    }
  }
  if (!hits.length){ cont.appendChild(el('div','empty','no backlinks')); return; }
  for(const h of hits){
    const d = el('div','item');
    d.innerHTML = `<div>${esc(h.path.split('/').pop().replace(/\.md$/,''))}</div><div class="snip">…${esc(h.snip)}…</div>`;
    d.onclick = () => openFile(h.path);
    cont.appendChild(d);
  }
}
function renderOutgoing(){
  const cont = $('outgoing'); cont.innerHTML = '';
  if (!G.currentPath){ cont.appendChild(el('div','empty','—')); return; }
  const rec = G.files.get(G.currentPath); if (!rec) return;
  const links = new Set(); let m;
  const rx = /\[\[([^\]|]+)/g;
  while((m=rx.exec(rec.body))){ links.add(m[1].trim()); }
  if (!links.size){ cont.appendChild(el('div','empty','no outgoing')); return; }
  for(const l of links){
    const target = resolveNote(l);
    const d = el('div','item');
    d.innerHTML = `<div>${esc(l)}${target?'':' <span style="color:var(--coral);font-size:10px">·new</span>'}</div>`;
    d.onclick = () => { if (target) openFile(target); else offerCreate(l+'.md'); };
    cont.appendChild(d);
  }
}
// ─── Graph view ───────────────────────────────────────────────
let graphSim = null;
function buildGraphData(includeTags=true){
  const nodes = []; const links = [];
  const idx = new Map();
  for(const p of G.files.keys()){
    const id = p; idx.set(id, nodes.length);
    const name = p.split('/').pop().replace(/\.md$/,'');
    nodes.push({id, label:name, kind:'note', x: Math.random()*800, y: Math.random()*500, vx:0, vy:0, degree:0});
  }
  const tagMap = new Map();
  for(const [p,f] of G.files){
    const rx = /\[\[([^\]|]+)/g; let m;
    while((m=rx.exec(f.body))){
      const target = resolveNote(m[1].trim());
      if (target && target !== p){
        links.push({source:idx.get(p), target:idx.get(target)});
        nodes[idx.get(p)].degree++; nodes[idx.get(target)].degree++;
      }
    }
    if (includeTags){
      const tags = f.body.match(/(^|\s)#[a-zA-Z0-9_/-]+/g)||[];
      for(const t of tags){
        const tag = t.trim().slice(1);
        if (!tagMap.has(tag)){ tagMap.set(tag, nodes.length); nodes.push({id:'#'+tag, label:'#'+tag, kind:'tag', x:Math.random()*800, y:Math.random()*500, vx:0, vy:0, degree:0}); }
        links.push({source:idx.get(p), target:tagMap.get(tag)});
      }
    }
  }
  return {nodes, links};
}
function runGraphSim(data, svg, W, H){
  const nodes = data.nodes; const links = data.links;
  // simple velocity Verlet
  function step(){
    for(let i=0;i<nodes.length;i++){
      const a = nodes[i];
      for(let j=i+1;j<nodes.length;j++){
        const b = nodes[j];
        const dx = b.x-a.x, dy = b.y-a.y; let d2 = dx*dx+dy*dy+0.01;
        const d = Math.sqrt(d2);
        const rep = 3000/d2;
        const rx = dx/d*rep, ry = dy/d*rep;
        a.vx -= rx; a.vy -= ry; b.vx += rx; b.vy += ry;
      }
    }
    for(const l of links){
      const a = nodes[l.source], b = nodes[l.target];
      const dx = b.x-a.x, dy = b.y-a.y; const d = Math.sqrt(dx*dx+dy*dy)+0.01;
      const spring = (d-60)*0.03;
      const fx = dx/d*spring, fy = dy/d*spring;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    const cx = W/2, cy = H/2;
    for(const n of nodes){
      n.vx += (cx-n.x)*0.002; n.vy += (cy-n.y)*0.002;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
    }
  }
  return step;
}
function renderGraph(){
  const svg = $('graph');
  const box = svg.getBoundingClientRect();
  const W = box.width||900, H = box.height||600;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const includeTags = $('g-tags').classList.contains('on');
  const data = buildGraphData(includeTags);
  const step = runGraphSim(data, svg, W, H);
  for(let i=0;i<180;i++) step();
  svg.innerHTML = '';
  const gLinks = document.createElementNS('http://www.w3.org/2000/svg','g');
  for(const l of data.links){
    const a = data.nodes[l.source], b = data.nodes[l.target];
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
    line.setAttribute('class','edge');
    gLinks.appendChild(line);
  }
  svg.appendChild(gLinks);
  const gNodes = document.createElementNS('http://www.w3.org/2000/svg','g');
  for(const n of data.nodes){
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',n.x); c.setAttribute('cy',n.y);
    const r = n.kind==='tag' ? 4 : (4 + Math.min(n.degree,10));
    c.setAttribute('r',r);
    c.setAttribute('class','node'+(n.kind==='tag'?' tag':(n.degree===0?' orphan':'')));
    c.onclick = () => { if (n.kind==='note'){ openFile(n.id); switchPane('editor'); } };
    g.appendChild(c);
    const lb = document.createElementNS('http://www.w3.org/2000/svg','text');
    lb.setAttribute('x',n.x); lb.setAttribute('y',n.y-r-3);
    lb.setAttribute('class','label');
    lb.textContent = n.label.length>18?n.label.slice(0,15)+'…':n.label;
    g.appendChild(lb);
    gNodes.appendChild(g);
  }
  svg.appendChild(gNodes);
  $('g-stat').textContent = `${data.nodes.length} nodes · ${data.links.length} edges`;
  // pan+zoom
  let panX=0, panY=0, zoom=1;
  let dragging=false, sx=0, sy=0;
  svg.onmousedown = e => { dragging=true; sx=e.clientX-panX; sy=e.clientY-panY; };
  svg.onmousemove = e => { if(dragging){ panX=e.clientX-sx; panY=e.clientY-sy; apply(); } };
  svg.onmouseup = svg.onmouseleave = () => dragging=false;
  svg.onwheel = e => { e.preventDefault(); zoom *= e.deltaY>0?0.9:1.1; zoom = Math.max(.2,Math.min(4,zoom)); apply(); };
  function apply(){ [gLinks,gNodes].forEach(g=>g.setAttribute('transform',`translate(${panX},${panY}) scale(${zoom})`)); }
  $('g-reset').onclick = () => { panX=0; panY=0; zoom=1; apply(); };
}
function renderMinimap(){
  if (!G.currentPath) return;
  const svg = $('minimap');
  const W=260, H=220;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const nodes = [{id:G.currentPath, x:W/2, y:H/2, kind:'center'}];
  const seen = new Set([G.currentPath]);
  const rec = G.files.get(G.currentPath); if(!rec){ svg.innerHTML=''; return; }
  const outLinks = new Set(); const rx = /\[\[([^\]|]+)/g; let m;
  while((m=rx.exec(rec.body))){ const t = resolveNote(m[1].trim()); if (t) outLinks.add(t); }
  const inLinks = new Set();
  for(const [p,f] of G.files){ if (p===G.currentPath) continue; const nm=G.currentPath.split('/').pop().replace(/\.md$/,''); if (new RegExp('\\[\\['+nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\||\\])','i').test(f.body)) inLinks.add(p); }
  const linked = [...outLinks, ...inLinks];
  const N = linked.length;
  const R = 80;
  linked.forEach((p,i)=>{
    if (seen.has(p)) return;
    const a = (i/N)*Math.PI*2;
    nodes.push({id:p,x:W/2+Math.cos(a)*R,y:H/2+Math.sin(a)*R,kind:'linked'});
    seen.add(p);
  });
  svg.innerHTML = '';
  for(let i=1;i<nodes.length;i++){
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',nodes[0].x); l.setAttribute('y1',nodes[0].y);
    l.setAttribute('x2',nodes[i].x); l.setAttribute('y2',nodes[i].y);
    l.setAttribute('stroke','var(--line2)'); l.setAttribute('stroke-width','1');
    svg.appendChild(l);
  }
  for(const n of nodes){
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',n.x); c.setAttribute('cy',n.y); c.setAttribute('r', n.kind==='center'?7:4);
    c.setAttribute('fill', n.kind==='center'?'var(--amber)':'var(--sage)');
    c.style.cursor='pointer';
    c.onclick = () => openFile(n.id);
    svg.appendChild(c);
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',n.x); t.setAttribute('y',n.y+15); t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size','9'); t.setAttribute('fill','var(--muted)');
    t.setAttribute('font-family','var(--sans)');
    const nm = n.id.split('/').pop().replace(/\.md$/,'');
    t.textContent = nm.length>14?nm.slice(0,12)+'…':nm;
    svg.appendChild(t);
  }
}
// ─── Search ───────────────────────────────────────────────────
function buildIndex(){
  const idx = new Map();
  for(const [p,f] of G.files){
    const words = (f.body.toLowerCase().match(/[a-z0-9_-]{2,}/g)||[]);
    for(const w of words){
      if (!idx.has(w)) idx.set(w,new Set());
      idx.get(w).add(p);
    }
  }
  return idx;
}
let searchIndex = null;
async function runSearch(q){
  const cont = $('q-hits'); cont.innerHTML = '';
  if (!q.trim()){ return; }
  if (mode==='semantic'){
    if (!G.fk || !G.fk.aiComplete){ cont.innerHTML = '<div style="color:var(--muted);padding:10px">Semantic search needs fall-kit. Open ⚙ Settings → cascade to enable T2 (WebLLM) or T3 (BYOK).</div>'; return; }
    cont.innerHTML = '<div style="color:var(--muted);padding:10px">Ranking with cascade… (may take a moment on T2 first call)</div>';
    const scores = [];
    // simple: ask the LLM to rank; degrade to keyword if it returns null
    const noteList = [...G.files.entries()].slice(0,40).map(([p,f])=>({p, s: f.body.slice(0,200)}));
    const prompt = `Question: ${q}\n\nGiven these notes, list the file paths most relevant, one per line. Notes:\n${noteList.map(n=>`- ${n.p}: ${n.s.replace(/\n/g,' ')}`).join('\n')}`;
    let out = null;
    try { out = await G.fk.aiComplete('You are a semantic ranker for a personal note vault.', prompt, 400); } catch(e){}
    if (!out){ cont.innerHTML = '<div style="color:var(--muted);padding:10px">Cascade returned nothing — falling back to full-text.</div>'; runFullText(q); return; }
    const paths = out.split(/\n/).map(l=>l.replace(/^[-*·\s]+/,'').split(':')[0].trim()).filter(p=>G.files.has(p));
    cont.innerHTML = '';
    for(const p of paths){
      const rec = G.files.get(p);
      const d = el('div','hit');
      d.innerHTML = `<div class="path">${esc(p)}</div><div class="snip">${esc(rec.body.slice(0,200))}…</div>`;
      d.onclick = () => { openFile(p); switchPane('editor'); };
      cont.appendChild(d);
    }
    return;
  }
  runFullText(q);
}
function runFullText(q){
  const cont = $('q-hits'); cont.innerHTML='';
  if (!searchIndex) searchIndex = buildIndex();
  const terms = q.toLowerCase().match(/[a-z0-9_-]{2,}/g) || [q.toLowerCase()];
  const scores = new Map();
  for(const t of terms){
    const set = searchIndex.get(t) || new Set();
    for(const p of set){ scores.set(p,(scores.get(p)||0)+1); }
    // partial (prefix) match
    for(const [w,ps] of searchIndex){ if (w.startsWith(t) && w!==t){ for(const p of ps){ scores.set(p,(scores.get(p)||0)+.3); } } }
  }
  const ranked = [...scores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,50);
  if (!ranked.length){ cont.innerHTML='<div style="color:var(--muted);padding:10px">No matches.</div>'; return; }
  const highlightRx = new RegExp('('+terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
  for(const [p] of ranked){
    const rec = G.files.get(p);
    const lc = rec.body.toLowerCase();
    let idx = -1;
    for(const t of terms){ const i = lc.indexOf(t); if (i>=0 && (idx<0 || i<idx)) idx = i; }
    if (idx<0) idx = 0;
    const raw = rec.body.slice(Math.max(0,idx-40), idx+180).replace(/\n/g,' ');
    const snip = esc(raw).replace(highlightRx,'<mark>$1</mark>');
    const d = el('div','hit');
    d.innerHTML = `<div class="path">${esc(p)}</div><div class="snip">…${snip}…</div>`;
    d.onclick = () => { openFile(p); switchPane('editor'); };
    cont.appendChild(d);
  }
}
// ─── Files / tabs ─────────────────────────────────────────────
function openFile(path){
  if (!G.files.has(path)) return;
  if (G.dirty) saveCurrent();
  G.currentPath = path;
  if (!G.openTabs.includes(path)) G.openTabs.push(path);
  switchPane('editor');
  renderTabs(); renderTree(); renderEditor();
}
function closeTab(path){
  G.openTabs = G.openTabs.filter(p=>p!==path);
  if (G.currentPath===path){ G.currentPath = G.openTabs[G.openTabs.length-1] || null; }
  if (G.currentPath) renderEditor(); else showEmpty();
  renderTabs(); renderTree();
}
async function newNote(name){
  name = name || prompt('Note name (no extension)', 'Untitled');
  if (!name) return;
  if (!name.endsWith('.md')) name += '.md';
  if (G.files.has(name)){ alert('Already exists.'); return openFile(name); }
  G.files.set(name,{path:name,name,body:`# ${name.replace(/\.md$/,'')}\n\n`,mtime:Date.now(),handle:null});
  await writeFileFS(name, G.files.get(name).body);
  searchIndex = null;
  renderTree(); openFile(name);
}
function offerCreate(name){
  if (confirm(`Note "${name}" doesn't exist yet. Create?`)) newNote(name.replace(/\.md$/,''));
}
// ─── Command palette ─────────────────────────────────────────
let paletteState = null;
function openPalette(){
  const bg = $('palette-bg'); bg.classList.add('on');
  const inp = $('p-input'); inp.value = ''; inp.focus();
  paletteState = {sel:0};
  buildPalette('');
  inp.oninput = () => { paletteState.sel=0; buildPalette(inp.value); };
  inp.onkeydown = e => {
    const rows = $('p-list').children;
    if (e.key==='ArrowDown'){ e.preventDefault(); paletteState.sel = Math.min(rows.length-1,paletteState.sel+1); updateSel(); }
    else if (e.key==='ArrowUp'){ e.preventDefault(); paletteState.sel = Math.max(0,paletteState.sel-1); updateSel(); }
    else if (e.key==='Enter'){ e.preventDefault(); if (rows[paletteState.sel]) rows[paletteState.sel].click(); }
    else if (e.key==='Escape'){ closePalette(); }
  };
}
function updateSel(){ [...$('p-list').children].forEach((r,i)=>r.classList.toggle('on',i===paletteState.sel)); const r = $('p-list').children[paletteState.sel]; if (r) r.scrollIntoView({block:'nearest'}); }
function closePalette(){ $('palette-bg').classList.remove('on'); paletteState=null; }
function buildPalette(q){
  const list = $('p-list'); list.innerHTML='';
  const rows = [];
  // commands
  const cmds = [
    ['action','New Note',()=>{closePalette();newNote();}],
    ['action','Toggle Split View (Ctrl+E)',()=>{closePalette();setMode(G.mode==='split'?'edit':'split');}],
    ['action','Preview',()=>{closePalette();setMode('preview');}],
    ['action','Graph View (Ctrl+G)',()=>{closePalette();switchPane('graph');}],
    ['action','Full-text Search',()=>{closePalette();switchPane('search');$('q').focus();}],
    ['action','Settings',()=>{closePalette();openSettings();}],
    ['action','Open Vault',()=>{closePalette();openVault();}],
    ['action','Insert Wikilink at cursor',()=>{closePalette();insertText('[[]]',2);}],
    ['action','Sign this note (FallSignature)',()=>{closePalette();signCurrent();}],
    ['action','Publish this note (FallCast)',()=>{closePalette();publishCurrent();}],
  ];
  for(const [k,l,fn] of cmds){ if (!q || l.toLowerCase().includes(q.toLowerCase())) rows.push({kind:k,label:l,fn}); }
  // files
  for(const p of G.files.keys()){
    if (!q || p.toLowerCase().includes(q.toLowerCase())) rows.push({kind:'file',label:p.replace(/\.md$/,''),fn:()=>{closePalette();openFile(p);}});
  }
  rows.slice(0,30).forEach((r,i)=>{
    const div = el('div','row');
    if (i===0) div.classList.add('on');
    div.innerHTML = `<span class="kind">${r.kind}</span><span>${esc(r.label)}</span>`;
    div.onclick = r.fn;
    list.appendChild(div);
  });
}
function insertText(t, backOffset){
  const ed = $('ed'); if (!ed) return;
  ed.focus();
  document.execCommand('insertText', false, t);
  const rec = G.files.get(G.currentPath); if (rec){ rec.body = ed.textContent; markDirty(); }
}
// ─── Panes ─────────────────────────────────────────────
function switchPane(name){
  G.activePane = name;
  ['editor','graph','search'].forEach(n=>$('pane-'+n).classList.toggle('hide', n!==name));
  if (name==='graph') requestAnimationFrame(renderGraph);
  if (name==='search'){ setTimeout(()=>$('q').focus(),20); searchIndex=null; }
  const m = {editor:'btn-mode-'+G.mode, graph:'btn-graph', search:'btn-search'}[name];
  const b = $(m); if (b) b.classList.add('on');
}
function setMode(m){
  G.mode = m;
  ['btn-mode-edit','btn-mode-split','btn-mode-preview'].forEach(id=>$(id).classList.remove('on'));
  $({edit:'btn-mode-edit',split:'btn-mode-split',preview:'btn-mode-preview'}[m]).classList.add('on');
  if (G.currentPath) renderEditor();
}
// ─── Settings modal ─────────────────────────────────────
function openSettings(){
  const mb = $('modal-bg'); mb.classList.add('on');
  const m = $('modal');
  const cascade = G.fk && G.fk.getConfig ? G.fk.getConfig() : {tier:'T0'};
  m.innerHTML = `
    <h2>Settings <em>· sovereign</em></h2>
    <div class="settingrow"><span>Cascade tier</span><span style="color:var(--sage);font-family:var(--mono);font-size:11px">${cascade.tier||'T0'}</span></div>
    <div class="settingrow"><span>Semantic search</span><label><input type="checkbox" id="opt-semantic" ${localStorage.fgSemantic==='1'?'checked':''}> enable</label></div>
    <div class="settingrow"><span>Ed25519 sign on save</span><label><input type="checkbox" id="opt-sign" ${localStorage.fgSign==='1'?'checked':''}> auto-sign</label></div>
    <div class="settingrow"><span>Publish via FallCast</span><label><input type="checkbox" id="opt-publish" ${localStorage.fgPublish==='1'?'checked':''}> enable</label></div>
    <div class="settingrow"><span>Multi-device sync (FallSync)</span><label><input type="checkbox" id="opt-sync" ${localStorage.fgSync==='1'?'checked':''}> enable</label></div>
    <p style="margin-top:14px">Cascade options (T2 WebLLM / T3 BYOK) live in the fall-kit chip. Semantic search + sync + sign + publish integrate with fall-kit, fallsignature, fallsync, fallcast — all sovereign estate modules.</p>
    <div class="row">
      <button onclick="if(G.fk&&G.fk.openSettings)G.fk.openSettings();else alert('fall-kit not loaded')">Open cascade</button>
      <button class="primary" id="save-settings">Save</button>
    </div>`;
  $('save-settings').onclick = () => {
    localStorage.fgSemantic = $('opt-semantic').checked?'1':'0';
    localStorage.fgSign = $('opt-sign').checked?'1':'0';
    localStorage.fgPublish = $('opt-publish').checked?'1':'0';
    localStorage.fgSync = $('opt-sync').checked?'1':'0';
    mb.classList.remove('on');
  };
  mb.onclick = e => { if (e.target===mb) mb.classList.remove('on'); };
}
// ─── Sign / publish (opt-in stubs that hit estate modules) ─
async function signCurrent(){
  if (!G.currentPath) return;
  const rec = G.files.get(G.currentPath);
  try {
    const enc = new TextEncoder().encode(rec.body);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    const stamp = `\n\n<!-- fallsignature\n  sha256: ${hex}\n  stamped: ${new Date().toISOString()}\n  tool: fallgarden@1\n  estate: ai-nativesolutions.com\n-->\n`;
    rec.body += stamp;
    await writeFileFS(rec.path, rec.body);
    renderEditor();
    alert('Signed. See https://sjgant80-hub.github.io/fallsignature/ to verify with your key.');
  } catch(e){ alert('Sign failed: '+e.message); }
}
async function publishCurrent(){
  if (!G.currentPath) return;
  if (!confirm('Publish this note via FallCast? (opens external module)')) return;
  const rec = G.files.get(G.currentPath);
  const payload = encodeURIComponent(btoa(unescape(encodeURIComponent(rec.body))));
}
// ─── Boot ──────────────────────────────────────────────
function boot(){
  $('btn-open').onclick = openVault;
  $('btn-new').onclick = () => newNote();
  $('btn-mode-edit').onclick = () => { switchPane('editor'); setMode('edit'); };
  $('btn-mode-split').onclick = () => { switchPane('editor'); setMode('split'); };
  $('btn-mode-preview').onclick = () => { switchPane('editor'); setMode('preview'); };
  $('btn-graph').onclick = () => switchPane('graph');
  $('btn-search').onclick = () => switchPane('search');
  $('btn-palette').onclick = openPalette;
  $('btn-settings').onclick = openSettings;
  $('dropzone').onclick = openVault;
  $('filter').oninput = e => { G.filter = e.target.value; renderTree(); };
  $('q').oninput = e => runSearch(e.target.value);
  $('g-tags').onclick = () => { $('g-tags').classList.toggle('on'); renderGraph(); };
  $('g-cluster').onclick = () => { $('g-cluster').classList.toggle('on'); renderGraph(); };
    if ((e.ctrlKey||e.metaKey) && e.key==='k'){ e.preventDefault(); openPalette(); }
    else if ((e.ctrlKey||e.metaKey) && e.key==='e'){ e.preventDefault(); setMode(G.mode==='split'?'edit':'split'); }
    else if ((e.ctrlKey||e.metaKey) && e.key==='g'){ e.preventDefault(); switchPane('graph'); }
    else if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='f'){ e.preventDefault(); switchPane('search'); }
    else if ((e.ctrlKey||e.metaKey) && e.key==='s'){ e.preventDefault(); saveCurrent(); }
    else if ((e.ctrlKey||e.metaKey) && e.key==='n' && !e.shiftKey){ e.preventDefault(); newNote(); }
  });
  // fall-kit init
  setTimeout(() => {
      try { G.fk.init && G.fk.init({ toolName:'fallgarden', helpUrl:'https://github.com/sjgant80-hub/fallgarden' }); } catch(e){}
      const cfg = G.fk.getConfig ? G.fk.getConfig() : null;
      if (cfg && cfg.tier) $('s-cascade').textContent = cfg.tier + ' · ' + (cfg.tier==='T0'?'off':'on');
    } else {
      $('s-cascade').textContent = 'T0 · off';
    }
  }, 100);
  // MCP hook — expose queryable surface
    query: (text) => {
      const idx = buildIndex();
      const terms = text.toLowerCase().match(/[a-z0-9_-]{2,}/g)||[text.toLowerCase()];
      const scores = new Map();
      for(const t of terms){ const s = idx.get(t)||new Set(); for(const p of s) scores.set(p,(scores.get(p)||0)+1); }
      return [...scores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([p,s])=>({path:p,score:s,body:G.files.get(p).body.slice(0,400)}));
    },
    list: () => [...G.files.keys()],
    read: (path) => G.files.has(path) ? G.files.get(path).body : null,
    write: async (path, body) => { G.files.set(path,{path,name:path.split('/').pop(),body,mtime:Date.now(),handle:null}); await writeFileFS(path,body); renderTree(); return true; },
    graph: () => buildGraphData(false),
  };
  // SW
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  showEmpty();
}

// Named exports for the primary API surface
export { openIDB };
export { idbAll };
export { idbPut };
export { idbDel };
export { openVault };
export { openIDBVault };
export { walkDir };
export { writeFileFS };
export { deleteFileFS };
export { welcomeBody };

export { G };
export { W };
export { N };
export { R };
