---
applyTo: '**/*.ts'
---

# Code Organization

## Region Syntax
- Use `// #region <Description>` and `// #endregion`
- Blank line after each `// #endregion` before next region
- **NEVER use `/** */` JSDoc comments** - use `//` only

## File Structure

```typescript
// Desktop Editor Setup: ./controller_example_instructions.md

// #region 📋 README
// Component description
// #endregion

import * as hz from "horizon/core";

// #region 🏷️ Type Definitions
// #endregion

export class ComponentName extends hz.Component<typeof ComponentName> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  // #endregion

  // #region 🔄 Lifecycle Events
  // #endregion
}
```

## Region Emojis
📋 README | ⚙️ Props | 📊 State | 🔄 Lifecycle Events | 🎯 Main Logic | 🎬 Handlers | 🛠️ Helper Methods | 🔌 Public API | 🐛 Debug | 🔉 Audio
