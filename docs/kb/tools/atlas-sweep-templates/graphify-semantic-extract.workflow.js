export const meta = {
  name: 'graphify-semantic-extract',
  description: 'Estrazione semantica graphify: 52 chunk (35 doc + 17 immagini) -> .graphify_chunk_NN.json',
  phases: [{ title: 'Extract' }],
}

const OUT = 'D:/heuresys-advanced/graphify-out'
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const total = A.total || 52
const imageSet = new Set(A.imageChunks || [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52])

const RESULT = {
  type: 'object',
  properties: {
    chunk: { type: 'number' },
    nodes: { type: 'number' },
    edges: { type: 'number' },
    written: { type: 'boolean' },
  },
  required: ['chunk', 'nodes', 'edges', 'written'],
  additionalProperties: false,
}

function prompt(n) {
  const nn = String(n).padStart(2, '0')
  const isImage = imageSet.has(n)
  return `You are a graphify extraction subagent. Read the file list in ${OUT}/.gx_chunk_list_${nn}.txt (one absolute path per line), read those files, and extract a knowledge graph fragment. ${isImage ? 'This chunk is a single IMAGE file: use vision to understand what the image IS - do not just OCR. UI screenshot: layout patterns, design decisions, key elements, purpose. Chart: metric, trend/insight. Diagram: components and connections. Logo/brand SVG: what it represents.' : 'These are document files (markdown/yaml/text).'}

Rules:
- EXTRACTED: relationship explicit in source (import, call, citation, "see §3.2")
- INFERRED: reasonable inference (shared data structure, implied dependency)
- AMBIGUOUS: uncertain - flag for review, do not omit
- Doc files: extract named concepts, entities, citations. For rationale (WHY decisions were made, trade-offs, design intent): store as a "rationale" attribute on the relevant concept node - do NOT create a separate rationale node. Only create a node for something that is itself a named entity or concept. Use file_type "rationale" for concept-like nodes (ideas, principles, mechanisms, design patterns). Valid file_type values are only: code|document|paper|image|rationale.
- Semantic similarity: if two concepts solve the same problem without structural link, add a "semantically_similar_to" edge marked INFERRED with confidence_score 0.6-0.95. Only genuinely non-obvious, cross-cutting similarities.
- Hyperedges: if 3+ nodes clearly participate together in a shared concept/flow/pattern not captured pairwise, add a hyperedge. Max 3 per chunk, use sparingly.
- If a file has YAML frontmatter, copy source_url/captured_at/author/contributor onto every node from that file.
- confidence_score REQUIRED on every edge, never 0.5: EXTRACTED=1.0; INFERRED pick ONE of 0.95 (direct structural evidence) / 0.85 (strong inference) / 0.75 (reasonable) / 0.65 (weak) / 0.55 (speculative); AMBIGUOUS=0.1-0.3.
- Node ids: "filestem_entityname" (snake). Labels human-readable. source_file = path relative to D:/heuresys-advanced.
- Keep fragment PROPORTIONATE: for session-archive/QA-artifact files extract only the few genuinely reusable concepts (decisions, architecture facts), not every sentence. For canonical docs (docs/kb, docs/architecture, docs/product, docs/superpowers) be thorough.
- Skip secrets: never read .env, .secrets/, *.pem.

Write EXACTLY this JSON structure to ${OUT}/.graphify_chunk_${nn}.json (use the Write tool):
{"nodes":[{"id":"...","label":"...","file_type":"document","source_file":"...","source_location":null,"source_url":null,"captured_at":null,"author":null,"contributor":null}],"edges":[{"source":"...","target":"...","relation":"calls|implements|references|cites|conceptually_related_to|shares_data_with|semantically_similar_to|rationale_for","confidence":"EXTRACTED|INFERRED|AMBIGUOUS","confidence_score":1.0,"source_file":"...","source_location":null,"weight":1.0}],"hyperedges":[],"input_tokens":0,"output_tokens":0}

Then return via StructuredOutput: chunk=${n}, nodes=<count>, edges=<count>, written=true.`
}

phase('Extract')
log('Estrazione semantica: 52 chunk (35 doc + 17 immagini)')

const ids = Array.from({ length: total }, (_, i) => i + 1)
const results = await parallel(ids.map((n) => () =>
  agent(prompt(n), { label: 'gx:' + String(n).padStart(2, '0'), phase: 'Extract', schema: RESULT, effort: 'low' })
))

const ok = results.filter(Boolean).filter((r) => r.written)
const failed = ids.filter((n, i) => !results[i] || !results[i].written)
log(`Chunk completati: ${ok.length}/${total}` + (failed.length ? ' — FALLITI: ' + failed.join(',') : ''))

return {
  completed: ok.length,
  failed,
  totals: {
    nodes: ok.reduce((s, r) => s + r.nodes, 0),
    edges: ok.reduce((s, r) => s + r.edges, 0),
  },
}