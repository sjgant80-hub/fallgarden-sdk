# @ai-native-solutions/fallgarden-sdk

Sovereign, file-based second brain toolkit. Markdown + wikilinks + tags + graph + backlinks + full-text search. Extracted verbatim from the [FallGarden](https://sjgant80-hub.github.io/fallgarden/) single-file app.

MIT · zero runtime dependencies · pure ESM.

## Install

```bash
npm i @ai-native-solutions/fallgarden-sdk
```

## Quick start

```js
import { Vault } from '@ai-native-solutions/fallgarden-sdk';

const v = new Vault();
v.put('Ideas.md', '# Ideas\n\nLinked to [[Projects]] with #sovereign tag.');
v.put('Projects.md', '# Projects\n\nBacklinks to [[Ideas]].');

v.render('Ideas.md');           // HTML with wikilinks + tags
v.graph({ includeTags: true }); // { nodes, links }
v.backlinks('Projects.md');     // [{ path, snippet }]
v.outgoing('Ideas.md');         // [{ label, target }]
v.search('sovereign');          // [{ path, score, snippet }]
v.allTags();                    // ['sovereign']
```

## Functional API

```js
import { md, buildGraphData, backlinks, outgoingLinks, search, buildIndex, extractWikilinks, extractTags } from '@ai-native-solutions/fallgarden-sdk';

md(source, filesSet);            // markdown -> HTML (wikilinks, tags, tables, tasks, blockquotes, code)
buildGraphData(files, opts);     // { nodes:[{id,label,kind,degree}], links:[{source,target}] }
backlinks(files, path);          // hits into a note
outgoingLinks(files, path);      // wikilinks in a note (with .target resolved or null)
search(files, query);            // ranked full-text hits with snippets
buildIndex(files);               // pre-build inverted word index
extractWikilinks(body);          // [{ target, alias }]
extractTags(body);               // ['tag', ...]
```

`files` can be a `Map` or an object of `{ path -> body | { body } }`.

## What was extracted (verbatim from source)

- `md()` — line-based markdown parser: headings, fenced code, blockquotes, unordered/ordered lists, GFM tables, tasks, horizontal rules, wikilinks `[[Note|alias]]`, tags `#tag`, bold/italic/strike/inline-code, plain links.
- `buildGraphData()` — nodes for notes + tags, edges from wikilinks + tag membership, degree computed inline.
- `backlinks()` — regex-based backlink search across all notes with snippet.
- `outgoingLinks()` — every `[[...]]` in a note, resolved (or `null` for broken).
- `buildIndex()` / `search()` — inverted index of `[a-z0-9_-]{2,}` tokens, term-match scoring with 0.3× prefix bonus, snippet around first hit.
- `resolveNote()` / `hasNote()` — path resolution matching the source's exact behavior.

## Playground

[docs/index.html](./docs/index.html) is a live demo you can open in a browser.

## Companion packages

- `@ai-native-solutions/fallgarden-mcp` — MCP stdio server exposing the SDK as tools.
- `@ai-native-solutions/fallgarden-api` — Express HTTP wrapper.

## Test

```bash
npm test
```

## License

MIT · [AI-Native Solutions](https://ai-nativesolutions.com)
