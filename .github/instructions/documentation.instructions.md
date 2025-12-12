---
applyTo: '**/*.ts'
---

# Documentation Requirements

## Documentation Location

**Primary source:** [Official Meta Horizon Worlds documentation](../../hw-mcp-tools/documentation/hw-docs/)

## Search Strategy

1. **Use `list_dir`** to explore [hw-mcp-tools/documentation/hw-docs/](../../hw-mcp-tools/documentation/hw-docs/) structure first
2. **Use `grep_search`** with targeted `includePattern` for specific subdirectories:
   - `"hw-mcp-tools/documentation/hw-docs/Scripting/**"` for scripting
   - `"hw-mcp-tools/documentation/hw-docs/Reference/**"` for API reference
   - `"hw-mcp-tools/documentation/hw-docs/Desktop%20editor/**"` for editor features
   - `"hw-mcp-tools/documentation/hw-docs/Performance/**"` for optimization
3. **Follow markdown links** between files to discover related concepts
4. **Read thoroughly** - understand full context, don't skim

## Key Principles

- **Search docs BEFORE implementing** any solution
- **Official docs take precedence** for API specifications
- **Cite sources** - reference specific file paths that informed your solution
