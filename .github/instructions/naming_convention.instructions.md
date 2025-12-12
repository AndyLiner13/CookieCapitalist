---
applyTo: '**/*.ts'
---

# Naming Conventions

## File Names
Format: `{prefix}_{camelCaseName}.ts`

| Prefix | Purpose |
|--------|---------|
| `manager_` | Server-only execution |
| `controller_` | Local-only execution |
| `util_` | Reusable utilities (non-entity) |
| `noesis_` | Noesis entities |
| `hud_` | CustomUI screen overlays |

## Entity Names
Name entities for **what they are**, not what the script does:

| Script | Entity Name |
|--------|-------------|
| `controller_example.ts` | `Example` (not ~~ExampleController~~) |
| `manager_example.ts` | `ExampleManager` |
| `hud_example.ts` | `HUD_Example` |

## Component Registration
- Single component in file → name it `Default`
- Multiple components → 1-2 words, PascalCase or camelCase
