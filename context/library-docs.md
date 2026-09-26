# Library Docs

Project-specific usage patterns for every third-party library this project actually uses.
This file only covers how *this project* uses each library — rules, patterns, and
constraints specific to it, not general documentation.

Read the relevant section before implementing any feature that touches these libraries.
Ships empty on purpose — a pattern gets added here the first time this project actually
uses the library, verified against what's installed, never written ahead of time from
memory. Writing an API example before it's needed manufactures exactly the stale
documentation this file exists to prevent.

---

## Before Using Any Library

Before implementing any feature that uses a third-party library:

1. **Check `AGENTS.md`** at the project root — it lists every skill installed for this
   project and how to use them. Skills contain up-to-date API documentation, usage
   patterns, and best practices specific to this codebase.

2. **Check if an MCP server is configured** for that library. Some tools have MCP servers
   that give the AI agent direct access to documentation, logs, and debugging tools. If one
   is available — use it before falling back to general knowledge.

3. **Read this file** for project-specific patterns that override general library
   knowledge.

The order of authority is:

```
MCP server (real-time docs) → Skills via AGENTS.md → This file (project rules) → General training knowledge
```

Never rely on general training knowledge alone for a library's API — it changes frequently
and training data may be outdated.
