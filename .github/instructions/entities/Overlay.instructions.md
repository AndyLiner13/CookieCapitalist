---
applyTo: 'noesis_overlay.ts'
---

# Overlay Entity

**Hierarchy**: `root` / [`Noesis Gizmos`](Noesis%20Gizmos.instructions.md) / [`Overlay`](Overlay.instructions.md)

## Metadata

| Property | Value |
|----------|-------|
| **Entity Type** | [NoesisUI](../../../hw-mcp-tools/properties.js/entities/NoesisUI.json) |
| **Spawn Method** | [Manual](../../../hw-docs/Desktop%20editor/Objects/Object%20Spawning%20and%20Despawning.md) |

<style>
table { width: 100%; border-collapse: collapse; }
td:first-child { width: 40%; }
td:last-child { width: 60%; text-align: right; }
h2 { margin-bottom: 0; }
table { margin-top: 0; }
thead { display: none; }
</style>

## [Attributes](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md)
| |  |
|---|--:|
| **[Position](../../../types/horizon_core.d.ts#L1371)** | `x: 0`, `y: 0`, `z: 0` |
| **[Rotation](../../../types/horizon_core.d.ts#L1379)** | `x: 0`, `y: 0`, `z: 0` |
| **[Scale](../../../types/horizon_core.d.ts#L1375)** | `x: 1`, `y: 1`, `z: 1` |

## [Behavior](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md)
| |  |
|---|--:|
| **[Visible](../../../types/horizon_core.d.ts#L1518)** | `true` |
| **[Collidable](../../../types/horizon_core.d.ts#L1523)** | `false` |
| **Allow Children to Override Collision** | `false` |

## [Noesis UI settings](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md)
| |  |
|---|--:|
| **[Noesis Project](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md#L43)** | `Noesis` |
| **[Root XAML](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md#L43)** | `Overlay.xaml` |
| **[Display Mode](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md#L43)** | `ScreenOverlay` |
| **[Input Mode](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md#L43)** | `Interactive, Blocking` |
| **[Render Order](../../../hw-docs/Desktop%20editor/NoesisUI/Create%20a%20Noesis%20UI%20Panel.md#L43)** | `4` |

## [Gameplay Tags](../../../hw-docs/Scripting/Gameplay%20Tags%20API/Introduction%20to%20Gameplay%20Tags.md)
| |  |
|---|--:|
| **[Gameplay Tags](../../../types/horizon_core.d.ts#L1568)** | `[]` |

## [noesis_overlay.ts:Default](../../../noesis_overlay.ts)
| |  |
|---|--:|
| **Execution Mode** | [`Shared`](../../../hw-docs/Desktop%20editor/NoesisUI/Shared%20Mode%20for%20Noesis%20UI%20Scripts.md) |
| **leaderboardGizmo** | [`WorldLeaderboard`](WorldLeaderboard.instructions.md) |
| **milkBackgroundGizmo** | [`Milk Background`](Milk%20Background.instructions.md) |
| **milkForegroundGizmo** | [`Milk Foreground`](Milk%20Foreground.instructions.md) |
