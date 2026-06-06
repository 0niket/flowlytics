#!/usr/bin/env bash
set -euo pipefail

# Exa Search CLI — quick web search from the terminal
# Usage:
#   ./scripts/exa-search.sh "your query"
#   ./scripts/exa-search.sh "your query" --type=deep --num=5
#   ./scripts/exa-search.sh "your query" --domains=arxiv.org,github.com

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  export "$(grep -E '^EXA_API_KEY=' "$ENV_FILE")"
fi

if [ -z "${EXA_API_KEY:-}" ]; then
  echo "Error: EXA_API_KEY not found. Set it in .env or export it." >&2
  exit 1
fi

QUERY=""
TYPE="auto"
NUM=10
DOMAINS=""
EXCLUDE=""
MAX_AGE=""
CATEGORY=""
OUTPUT_SCHEMA=""
SYS_PROMPT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --type=*) TYPE="${1#*=}" ;;
    --num=*) NUM="${1#*=}" ;;
    --domains=*) DOMAINS="${1#*=}" ;;
    --exclude=*) EXCLUDE="${1#*=}" ;;
    --fresh) MAX_AGE=0 ;;
    --max-age=*) MAX_AGE="${1#*=}" ;;
    --category=*) CATEGORY="${1#*=}" ;;
    --schema) shift; OUTPUT_SCHEMA="$1" ;;  # expects JSON string
    --prompt) shift; SYS_PROMPT="$1" ;;
    --help|-h)
      echo "Usage: $0 <query> [options]"
      echo "  --type=TYPE      auto|fast|instant|deep-lite|deep|deep-reasoning (default: auto)"
      echo "  --num=N          Number of results 1-100 (default: 10)"
      echo "  --domains=X,Y    Only include these domains"
      echo "  --exclude=X,Y    Exclude these domains"
      echo "  --fresh          Force livecrawl (maxAgeHours=0)"
      echo "  --max-age=N      Max cache age in hours"
      echo "  --category=X     company|people|research paper|news|personal site|financial report"
      echo "  --schema JSON    JSON schema for structured output"
      echo "  --prompt STR     System prompt for synthesis"
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      [ -z "$QUERY" ] && QUERY="$1" || QUERY="$QUERY $1"
      ;;
  esac
  shift
done

if [ -z "$QUERY" ]; then
  echo "Error: No query provided." >&2
  echo "Usage: $0 <query> [options]" >&2
  exit 1
fi

# Build the JSON payload
PAYLOAD=$(jq -n \
  --arg query "$QUERY" \
  --arg type "$TYPE" \
  --argjson num "$NUM" \
  '{
    query: $query,
    type: $type,
    numResults: $num,
    contents: { highlights: true }
  }'
)

if [ -n "$DOMAINS" ]; then
  IFS=',' read -ra DOMAIN_LIST <<< "$DOMAINS"
  DOMAIN_JSON=$(printf '%s\n' "${DOMAIN_LIST[@]}" | jq -R . | jq -s .)
  PAYLOAD=$(echo "$PAYLOAD" | jq --argjson domains "$DOMAIN_JSON" '. + {includeDomains: $domains}')
fi

if [ -n "$EXCLUDE" ]; then
  IFS=',' read -ra EXCLUDE_LIST <<< "$EXCLUDE"
  EXCLUDE_JSON=$(printf '%s\n' "${EXCLUDE_LIST[@]}" | jq -R . | jq -s .)
  PAYLOAD=$(echo "$PAYLOAD" | jq --argjson exclude "$EXCLUDE_JSON" '. + {excludeDomains: $exclude}')
fi

if [ -n "$MAX_AGE" ]; then
  PAYLOAD=$(echo "$PAYLOAD" | jq --argjson maxAge "$MAX_AGE" '.contents += {maxAgeHours: $maxAge}')
fi

if [ -n "$CATEGORY" ]; then
  PAYLOAD=$(echo "$PAYLOAD" | jq --arg cat "$CATEGORY" '. + {category: $cat}')
fi

if [ -n "$SYS_PROMPT" ]; then
  PAYLOAD=$(echo "$PAYLOAD" | jq --arg prompt "$SYS_PROMPT" '. + {systemPrompt: $prompt}')
fi

if [ -n "$OUTPUT_SCHEMA" ]; then
  SCHEMA_JSON=$(echo "$OUTPUT_SCHEMA" | jq '.')
  PAYLOAD=$(echo "$PAYLOAD" | jq --argjson schema "$SCHEMA_JSON" '. + {outputSchema: $schema}')
fi

# Execute search
RESULT=$(curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD")

# Check for API errors
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "API Error: $(echo "$RESULT" | jq -r '.error')" >&2
  exit 1
fi

# Pretty-print results
echo "$RESULT" | jq -r '
  .results[] | 
  "\u001b[1m" + .title + "\u001b[0m" +
  "\n  URL:  " + .url +
  (if .publishedDate then "\n  Date: " + .publishedDate else "" end) +
  (if .highlights and (.highlights | length > 0) then "\n  " + (.highlights[0] | gsub("\n"; " ")) else "" end) +
  "\n"
' 2>/dev/null || echo "$RESULT" | jq '.'
