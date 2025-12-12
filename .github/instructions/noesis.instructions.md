---
applyTo: '**/{Noesis/**,noesis_*.ts}'
---

# NoesisGUI Integration

NoesisGUI is a XAML-based UI framework for Horizon Worlds. Horizon (3D runtime/TypeScript) and Noesis (2D XAML layer) communicate via `NoesisGizmo` and `dataContext`.

## Project Structure
```
Noesis/
├── CookieCapitalist.noesis    # Project definition (required)
├── Overlay.xaml               # StartupDocument (entry point)
├── *.xaml                     # Additional pages/components
├── Fonts/                # Font files
└── Images/               # Image assets
```

## Documentation
- [Horizon integration](../../hw-docs/Desktop%20Editor/NoesisUI/)
- [NoesisGUI API reference](../../noesis-docs/)

## Critical Requirements
- **Execution Mode**: Must use `Shared` (Default/Local won't work properly)
- **Fonts**: Anton, Bangers, Oswald, Roboto, Roboto-Mono only
- **Memory**: 512px ~1MB | 1024px ~4MB | 2048px ~16MB

## TypeScript Pattern
```typescript
import { NoesisGizmo, IUiViewModelObject } from "horizon/noesis";

private dataContext: IUiViewModelObject = {
  playerHealth: "100",
  events: { onButtonClick: () => this.handleClick() },
};

start(): void {
  this.entity.as(NoesisGizmo)?.dataContext = this.dataContext;
}
```

## XAML Binding
```xml
<TextBlock Text="{Binding Path=playerHealth}" />
<Button Command="{Binding Path=events.onButtonClick}" />
```
