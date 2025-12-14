---
applyTo: 'controller_player.ts'
---

# Player Controller Entity

**Hierarchy**: `root` / [`Player Controller`](Player%20Controller.instructions.md)

## Metadata

| Property | Value |
|----------|-------|
| **Entity Type** | [Empty Object](../../../hw-mcp-tools/properties.js/entities/Empty_Object.json) |
| **Spawn Method** | [Manual](../../../hw-docs/Desktop%20editor/Objects/Object%20Spawning%20and%20Despawning.md) |

<style>
table { width: 100%; border-collapse: collapse; }
td:first-child { width: 40%; }
td:last-child { width: 60%; text-align: right; }
h2 { margin-bottom: 0; }
table { margin-top: 0; }
thead { display: none; }
</style>

## [Attributes](../../../hw-docs/Desktop%20editor/Objects/Using%20the%20Object%20Tools.md)
| |  |
|---|--:|
| **[Position](../../../types/horizon_core.d.ts#L1371)** | `x: 0`, `y: 0`, `z: 0` |
| **[Rotation](../../../types/horizon_core.d.ts#L1379)** | `x: 0`, `y: 0`, `z: 0` |
| **[Scale](../../../types/horizon_core.d.ts#L1375)** | `x: 1`, `y: 1`, `z: 1` |
| **Billboard** | `None` |

## [Behavior](../../../hw-docs/Desktop%20editor/Objects/Object%20Spawning%20and%20Despawning.md)
| |  |
|---|--:|
| **[Visible](../../../types/horizon_core.d.ts#L1518)** | `true` |
| **Reflect Light & Cast Shadow** | `false` |
| **[Collidable](../../../types/horizon_core.d.ts#L1523)** | `false` |
| **Allow Children to Override Collision** | `false` |
| **[Motion](../../../types/horizon_core.d.ts#L1532)** | `None` |

## [Gameplay Tags](../../../hw-docs/Scripting/Gameplay%20Tags%20API/Introduction%20to%20Gameplay%20Tags.md)
| |  |
|---|--:|
| **[Gameplay Tags](../../../types/horizon_core.d.ts#L1568)** | `[]` |

## [Navigation](../../../hw-docs/Desktop%20editor/NPCs/Nav%20Mesh%20Agents.md)
| |  |
|---|--:|
| **[Include in Bakes](../../../hw-docs/Desktop%20editor/NPCs/Nav%20Mesh%20Agents.md)** | `false` |

## [Navigation Locomotion](../../../hw-docs/Desktop%20editor/NPCs/Nav%20Mesh%20Agents.md)
| |  |
|---|--:|
| **[Enabled](../../../hw-docs/Desktop%20editor/NPCs/Nav%20Mesh%20Agents.md)** | `false` |

## More
| |  |
|---|--:|
| **Who Can Grab** | `Anyone` |
| **[Keep Ownership On Collision](../../../hw-docs/Scripting/Local%20scripting/Ownership%20in%20Meta%20Horizon%20Worlds.md)** | `false` |

## [controller_player.ts:Default](../../../controller_player.ts)
| |  |
|---|--:|
| **Execution Mode** | [`Local`](../../../hw-docs/Scripting/Local%20scripting/Getting%20Started%20with%20Local%20Scripting.md) |
| **raycastGizmo** | [`Click Detector`](Click%20Detector.instructions.md) |
| **cookieCollider** | [`Click Collider`](Click%20Collider.instructions.md) |
| **cookieGizmo** | [`Cookie`](Cookie.instructions.md) |
