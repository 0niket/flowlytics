# Exa Search — Agent Configuration

This project uses [Exa AI Search](https://exa.ai) as its web search engine. All coding agents should use the Exa API for web search instead of generic fallbacks.

## API Key

The key is stored in `.env` (gitignored, never commit it):

```
EXA_API_KEY=your-api-key-here
```

**To use the key in a session:**
```bash
source .env
# or read it directly:
EXA_API_KEY=$(grep EXA_API_KEY .env | cut -d= -f2)
```

## Quick Start — Search

```bash
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $(grep EXA_API_KEY .env | cut -d= -f2)" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "your search query",
    "type": "auto",
    "numResults": 10,
    "contents": { "highlights": true }
  }' | jq '.results[] | {title: .title, url: .url, snippet: .highlights[0]}'
```

## Search Types

| Type | Latency | Best For |
|------|---------|----------|
| `auto` | ~1s | Default — balanced speed and relevance |
| `fast` | ~450ms | Latency-sensitive queries |
| `instant` | ~250ms | Chat, voice, autocomplete |
| `deep-lite` | ~4s | Cheaper synthesis |
| `deep` | 4-15s | Research, enrichment, thorough results |
| `deep-reasoning` | 12-40s | Complex multi-step reasoning |

Default: `auto` — recommended for most queries.

## Content Modes

| Mode | Config | Best For |
|------|--------|----------|
| Highlights | `"contents": {"highlights": true}` | Token-efficient excerpts (preferred for agents) |
| Text | `"contents": {"text": {"maxCharacters": 20000}}` | Full content extraction, RAG |
| Summary | `"contents": {"summary": true}` | LLM summary per result |

**Prefer `highlights` for agent workflows** — 10x fewer tokens, most relevant excerpts.

## Structured Outputs (outputSchema)

Works on any search type. Use when you want Exa to synthesize grounded JSON:

```bash
curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $(grep EXA_API_KEY .env | cut -d= -f2)" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "...",
    "type": "auto",
    "outputSchema": {
      "type": "object",
      "properties": { ... },
      "required": ["..."]
    },
    "contents": { "highlights": true }
  }'
```

Response includes `output.content` (structured JSON) and `output.grounding` (citations per field).

## Common Mistakes — Avoid These

| Wrong | Correct |
|-------|---------|
| `useAutoprompt: true` | Remove — **deprecated** |
| `includeUrls` / `excludeUrls` | Use `includeDomains` / `excludeDomains` |
| `text: true` at top level | Must be inside `"contents": {"text": true}` |
| `highlights: true` at top level | Must be inside `"contents": {"highlights": true}` |
| `numSentences` / `highlightsPerUrl` | Remove — **deprecated**. Use `highlights: true` |
| `tokensNum` | Use `contents.text.maxCharacters` |
| `livecrawl: "always"` | Use `contents.maxAgeHours: 0` |
| `excludeDomains` + `category:"company"` | **400 error** — not supported together |

## Key Parameters

- `maxAgeHours: 0` — forces livecrawl (fresh content, higher latency)
- `includeDomains` / `excludeDomains` — domain filtering (max 1200 each)
- `startPublishedDate` / `endPublishedDate` — ISO 8601 date range
- `category` — `company`, `people`, `research paper`, `news`, `personal site`, `financial report`
- `numResults` — 1-100 (default 10)
- `stream: true` — SSE mode (OpenAI-compatible chunks)

## Other Endpoints

- **`POST /contents`** — Get parsed content for known URLs. `text`, `highlights`, `summary` are top-level here (NOT nested in `contents`).
- **`POST /answer`** — Grounded answer for question-first UIs.

## Resources

- Docs: https://exa.ai/docs
- API Reference: https://docs.exa.ai/reference/search-api-guide-for-coding-agents
- Dashboard: https://dashboard.exa.ai
- Status: https://status.exa.ai
