#!/bin/sh
# Register Unl as a custom MCP toolkit in your Composio project (Composio's custom MCP support is
# experimental and REST-only today). Composio proxies Unl's tools; each of your users signs in with
# their own Unl key through the API_KEY auth scheme.
#   export COMPOSIO_API_KEY=...
#   sh register.sh
set -eu
curl -sS -X POST https://backend.composio.dev/api/v3.1/custom/toolkits/upsert \
  -H "x-api-key: ${COMPOSIO_API_KEY:?set COMPOSIO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "UNL",
    "toolkit_config": {
      "name": "Unl",
      "app_url": "https://api.unlimitless.ai/mcp",
      "auth_schemes": [{ "mode": "API_KEY", "headers": { "Authorization": "Bearer {{generic_api_key}}" } }]
    }
  }'
