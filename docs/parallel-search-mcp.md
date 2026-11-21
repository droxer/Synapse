# Parallel Search MCP

Connect [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
to give Synapse optional web search and page fetching for research tasks. The
hosted server is free for light use, with no Parallel account or API key required.
Anonymous searches use Fast mode.

This connection adds MCP tools alongside Synapse's built-in search and fetch
tools. It does not change `SEARCH_PROVIDER` or the Tavily/Exa credentials used by
the built-in search tool.

## Connect the server

Start Synapse using the [local setup guide](setup.md), including your LLM provider
configuration. The backend must be able to reach `https://search.parallel.ai`
over HTTPS. No additional package or local MCP server is needed for this
connection.

1. Open **MCP** in the sidebar and select **Add Server**.
2. Paste this single-server configuration into **Config JSON**:

   ```json
   {
     "mcpServers": {
       "parallel_search": {
         "type": "streamablehttp",
         "url": "https://search.parallel.ai/mcp",
         "headers": {
           "User-Agent": "Synapse/0.1.0 (https://github.com/droxer/Synapse)"
         }
       }
     }
   }
   ```

3. Select **Apply** to preview the server name `parallel_search`, transport
   `streamablehttp`, and one header, then select **Connect**.
4. Confirm that the server card shows **Connected** and **2 tools**:
   `web_search` and `web_fetch`.

Use `streamablehttp` exactly as shown. Synapse uses this transport name for HTTP
MCP connections; `http` is not an accepted configuration value.

## Try a research task

Start a new conversation after connecting the server and try:

> Use the parallel_search MCP server to find the latest stable Python release on
> python.org. Use its web_search tool to find the release page, then its web_fetch
> tool to read that page. Summarize the version, release date, and highlights,
> with source links.

Check the streamed tool calls to confirm the agent uses the tools from
`parallel_search`. Synapse prefixes MCP tool names with the server name and may
include a user-specific suffix before `__web_search` or `__web_fetch`, so they
remain distinct from the built-in tools. The model chooses which tools to call;
explicitly naming the server helps when several search tools are available.

## Manage the connection

- Disable the server with its toggle on the **MCP** page to stop exposing its
  tools. Enable it again to reconnect, or use **Remove** to delete the connection.
- If connecting fails, check the URL and transport above and outbound HTTPS
  access from the backend, then retry **Connect**.
- If search or fetch reports a free-tier limit, wait for the limit to reset or
  use an authenticated connection for higher limits. See the
  [Parallel installation instructions](https://docs.parallel.ai/integrations/mcp/search-mcp#installation)
  before adding an `Authorization` header. Anonymous access is intended for
  exploration and light use.
