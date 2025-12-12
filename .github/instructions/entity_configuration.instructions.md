---
applyTo: '**/*.ts'
---

# Entity Configuration Tool

Use `configure_entity` MCP tool to view or modify Horizon Worlds entity configurations in the Desktop Editor.

## Purpose

- **Diagnose issues**: Verify entity has correct script attached, proper execution mode, etc.
- **Fix configuration problems**: Suggest changes when entity config is likely causing the issue
- **Understand context**: Keep track of how entities are configured while working on scripts

**Only use when:**
- Existing entity configuration is suspected to be problematic
- Need to confirm script attachment or entity settings
- Configuration changes are required to achieve the user's goal

**⚠️ Configure ONE entity at a time. Wait for user approval before the next.**

## Workflow

1. Submit JSON → Tool validates (errors guide you to correct values)
2. If valid → Opens localhost:3000 for user approval
3. User clicks "Save Entity" or "Cancel"

## JSON Structure

```json
{
  "metadata": {
    "entityType": "Empty_Object",
    "description": "Brief purpose",
    "assetSpawning": true,
    "spawnedBy": "manager_example.ts"
  },
  "properties": {
    "Behavior.Motion": "Interactive"
  },
  "attachedScript": {
    "scriptFile": "controller_example.ts",
    "componentName": "ExampleController",
    "executionMode": "Local",
    "properties": { "shootCooldown": 1.0 }
  }
}
```

## Key Rules

- **Entity name** = auto-derived from `scriptFile` (e.g., `controller_example.ts` → `controller_example`)
- **assetSpawning**: `true` requires `spawnedBy` field
- **executionMode**: `"Default"` (server), `"Local"` (owner client), `"Shared"` (all clients/Noesis)
- **Script properties**: Match `propsDefinition` types (`Number`, `Boolean`, `String`, `Vec3`, `Color`, `Entity`/`Asset` as `"object"`)

## Error-Driven Discovery

Submit invalid values to discover valid options:
- Invalid `entityType` → returns all valid entity types
- Invalid structure → returns available properties for that entity type
