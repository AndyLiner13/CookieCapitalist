---
applyTo: '**/*.ts'
---

# Console Logging

**Use `util_logger.ts` instead of `console.log()`**

## Pattern

```typescript
import { Logger } from './util_logger';

class MyComponent {
  private log = new Logger('component_name');
  
  myFunction() {
    const log = this.log.active('myFunction');  // .inactive() to disable
    log.info('message');   // .warn() for issues, .error() for failures
  }
}
```

## Rules
- One Logger per class
- First line of every function: `this.log.active('fnName')` or `.inactive()`
- Use `.active()` for debugging, `.inactive()` for high-frequency/stable functions
