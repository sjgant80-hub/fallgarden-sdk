/*!
 * @ai-native-solutions/fallgarden-sdk
 * Sovereign, file-based second brain toolkit.
 * Markdown + wikilinks + tags + graph + backlinks + full-text search.
 * MIT · ai-nativesolutions.com
 *
 * REAL extraction from FallGarden index.html:
 *   - md()               → markdown parser (headings, code, wikilinks, tags, tables, tasks, blockquotes, lists)
 *   - buildGraphData()   → nodes + edges + tag nodes + degree
 *   - buildIndex()       → inverted word index
 *   - runFullText()      → keyword search with partial-prefix matching
 *   - renderBacklinks()  → backlinks
 *   - renderOutgoing()   → outgoing links
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ─── Markdown parser (mini, verbatim from source) ─────────────────────────────
export function md(src, filesSet = null) {
  const lines = String(src).split(/\r?\n/);
  let out = ''; let i = 0;
  const inline = t => {
    t = esc(t);
    t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    // wikilink
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => {
      const target = link.trim();
      const disp = (alias || target).trim();
      const key = target.endsWith('.md') ? target : target + '.md';
      const broken = filesSet && !hasNote(filesSet, key) ? ' broken' : '';
      return `<span class="wikilink${broken}" data-link="${esc(key)}">${esc(disp)}</span>`;
    });
    // tag
    t = t.replace(/(^|\s)#([a-zA-Z0-9_/-]+)/g, '$1<span class="tag" data-tag="$2">#$2</span>');
    // bold/italic
    t = t.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^\w])_([^_]+)_/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/^\[( |x|X)\]\s*/, m => `<input type="checkbox" disabled${/x/i.test(m) ? ' checked' : ''}>`);
    return t;
  };
  while (i < lines.length) {
    let ln = lines[i];
    if (/^```/.test(ln)) {
      const lang = ln.slice(3).trim(); let code = ''; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
      out += `<pre><code data-lang="${esc(lang)}">${esc(code)}</code></pre>`; i++; continue;
    }
    if (/^#{1,6}\s/.test(ln)) {
      const m = ln.match(/^(#{1,6})\s+(.*)$/);
      out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue;
    }
    if (/^>\s?/.test(ln)) {
      let buf = ''; while (i < lines.length && /^>\s?/.test(lines[i])) { buf += lines[i].replace(/^>\s?/, '') + '\n'; i++; }
      out += `<blockquote>${md(buf.trim(), filesSet)}</blockquote>`; continue;
    }
    if (/^(\s*)[-*+]\s+/.test(ln)) {
      let buf = ''; while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i])) { buf += '<li>' + inline(lines[i].replace(/^(\s*)[-*+]\s+/, '')) + '</li>'; i++; }
      out += `<ul>${buf}</ul>`; continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      let buf = ''; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf += '<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'; i++; }
      out += `<ol>${buf}</ol>`; continue;
    }
    if (/^\|.+\|/.test(ln) && i + 1 < lines.length && /^\|[-:| ]+\|$/.test(lines[i + 1])) {
      const parseRow = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = parseRow(ln); i += 2;
      let rows = '';
      while (i < lines.length && /^\|.+\|/.test(lines[i])) { rows += '<tr>' + parseRow(lines[i]).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'; i++; }
      out += `<table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`; continue;
    }
    if (/^---+$/.test(ln.trim())) { out += '<hr>'; i++; continue; }
    if (!ln.trim()) { i++; continue; }
    let para = ln; i++;
    while (i < lines.length && lines[i].trim() && !/^(#|>|```|\||-|\*|\+|\d+\.)/.test(lines[i])) { para += ' ' + lines[i]; i++; }
    out += `<p>${inline(para)}</p>`;
  }
  return out;
}

// ─── Wikilink helpers ─────────────────────────────────────────────────────────
export function hasNote(filesSet, key) {
  const keys = filesSet instanceof Map ? filesSet.keys() : Object.keys(filesSet);
  const has = k => filesSet instanceof Map ? filesSet.has(k) : k in filesSet;
  if (has(key)) return true;
  for (const p of keys) { if (p.endsWith('/' + key) || p === key) return true; }
  return false;
}

export function resolveNote(files, key) {
  key = key.endsWith('.md') ? key : key + '.md';
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  if (map.has(key)) return key;
  for (const p of map.keys()) { if (p.endsWith('/' + key)) return p; }
  return null;
}

// ─── Wikilinks / tags extraction ──────────────────────────────────────────────
export function extractWikilinks(body) {
  const out = []; const rx = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g; let m;
  while ((m = rx.exec(String(body)))) out.push({ target: m[1].trim(), alias: m[2] ? m[2].trim() : null });
  return out;
}

export function extractTags(body) {
  const tags = String(body).match(/(^|\s)#[a-zA-Z0-9_/-]+/g) || [];
  return [...new Set(tags.map(t => t.trim().slice(1)))];
}

// ─── Graph builder (verbatim shape from source) ───────────────────────────────
export function buildGraphData(files, { includeTags = true } = {}) {
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  const nodes = []; const links = [];
  const idx = new Map();
  for (const p of map.keys()) {
    const id = p; idx.set(id, nodes.length);
    const name = p.split('/').pop().replace(/\.md$/, '');
    nodes.push({ id, label: name, kind: 'note', degree: 0 });
  }
  const tagMap = new Map();
  for (const [p, f] of map) {
    const body = typeof f === 'string' ? f : f.body;
    const rx = /\[\[([^\]|]+)/g; let m;
    while ((m = rx.exec(body))) {
      const target = resolveNote(map, m[1].trim());
      if (target && target !== p) {
        links.push({ source: idx.get(p), target: idx.get(target) });
        nodes[idx.get(p)].degree++; nodes[idx.get(target)].degree++;
      }
    }
    if (includeTags) {
      const tags = body.match(/(^|\s)#[a-zA-Z0-9_/-]+/g) || [];
      for (const t of tags) {
        const tag = t.trim().slice(1);
        if (!tagMap.has(tag)) { tagMap.set(tag, nodes.length); nodes.push({ id: '#' + tag, label: '#' + tag, kind: 'tag', degree: 0 }); }
        links.push({ source: idx.get(p), target: tagMap.get(tag) });
      }
    }
  }
  return { nodes, links };
}

// ─── Backlinks ─────────────────────────────────────────────────────────────────
export function backlinks(files, path) {
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  const name = path.split('/').pop().replace(/\.md$/, '');
  const rx = new RegExp('\\[\\[' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\||\\])', 'i');
  const hits = [];
  for (const [p, f] of map) {
    if (p === path) continue;
    const body = typeof f === 'string' ? f : f.body;
    if (rx.test(body)) {
      const i = body.search(rx);
      const snip = body.slice(Math.max(0, i - 30), i + 80).replace(/\n/g, ' ');
      hits.push({ path: p, snippet: snip });
    }
  }
  return hits;
}

export function outgoingLinks(files, path) {
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  const rec = map.get(path); if (!rec) return [];
  const body = typeof rec === 'string' ? rec : rec.body;
  const out = new Set(); let m;
  const rx = /\[\[([^\]|]+)/g;
  while ((m = rx.exec(body))) out.add(m[1].trim());
  return [...out].map(l => ({ label: l, target: resolveNote(map, l) }));
}

// ─── Full-text search (verbatim scoring from source) ──────────────────────────
export function buildIndex(files) {
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  const idx = new Map();
  for (const [p, f] of map) {
    const body = typeof f === 'string' ? f : f.body;
    const words = (body.toLowerCase().match(/[a-z0-9_-]{2,}/g) || []);
    for (const w of words) {
      if (!idx.has(w)) idx.set(w, new Set());
      idx.get(w).add(p);
    }
  }
  return idx;
}

export function search(files, query, { limit = 50, index = null } = {}) {
  const map = files instanceof Map ? files : new Map(Object.entries(files));
  const searchIndex = index || buildIndex(map);
  const q = String(query || '');
  const terms = q.toLowerCase().match(/[a-z0-9_-]{2,}/g) || [q.toLowerCase()];
  const scores = new Map();
  for (const t of terms) {
    const set = searchIndex.get(t) || new Set();
    for (const p of set) scores.set(p, (scores.get(p) || 0) + 1);
    for (const [w, ps] of searchIndex) {
      if (w.startsWith(t) && w !== t) {
        for (const p of ps) scores.set(p, (scores.get(p) || 0) + 0.3);
      }
    }
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return ranked.map(([p, score]) => {
    const rec = map.get(p);
    const body = typeof rec === 'string' ? rec : rec.body;
    const lc = body.toLowerCase();
    let i = -1;
    for (const t of terms) { const j = lc.indexOf(t); if (j >= 0 && (i < 0 || j < i)) i = j; }
    if (i < 0) i = 0;
    const snippet = body.slice(Math.max(0, i - 40), i + 180).replace(/\n/g, ' ');
    return { path: p, score, snippet };
  });
}

// ─── Vault helpers (in-memory) ─────────────────────────────────────────────────
export class Vault {
  constructor(files = new Map()) {
    this.files = files instanceof Map ? files : new Map(Object.entries(files));
    this._index = null;
  }
  put(path, body) {
    this.files.set(path, { path, name: path.split('/').pop(), body, mtime: Date.now() });
    this._index = null; return this;
  }
  get(path) { return this.files.get(path); }
  delete(path) { this.files.delete(path); this._index = null; return this; }
  render(path) { const r = this.files.get(path); return r ? md(typeof r === 'string' ? r : r.body, this.files) : ''; }
  graph(opts) { return buildGraphData(this.files, opts); }
  backlinks(path) { return backlinks(this.files, path); }
  outgoing(path) { return outgoingLinks(this.files, path); }
  search(q, opts = {}) { if (!this._index) this._index = buildIndex(this.files); return search(this.files, q, { ...opts, index: this._index }); }
  tags(path) { const r = this.files.get(path); return r ? extractTags(typeof r === 'string' ? r : r.body) : []; }
  allTags() {
    const set = new Set();
    for (const f of this.files.values()) {
      const body = typeof f === 'string' ? f : f.body;
      for (const t of extractTags(body)) set.add(t);
    }
    return [...set].sort();
  }
}

export const VERSION = '1.0.0';
export default { md, extractWikilinks, extractTags, buildGraphData, backlinks, outgoingLinks, buildIndex, search, resolveNote, hasNote, Vault, VERSION };
