# Onboarding Entity Setup

## Entity Configuration

Create a **NoesisUI** entity with the following settings:

| Property | Value |
|----------|-------|
| **Entity Name** | `noesis_onboarding` |
| **XAML File** | `Onboarding.xaml` |
| **Display Mode** | Screen Overlay |
| **Render Order** | 150 (must be above all other UI - WelcomeBack is ~100) |
| **Input Mode** | Interactive, blocking |
| **Texture Resolution** | 1024 (default) |

## Script Attachment

| Property | Value |
|----------|-------|
| **Script File** | `noesis_onboarding.ts` |
| **Component Name** | `Default` |
| **Execution Mode** | Shared |

## Onboarding Flow (Current Implementation)

| Step | Screen | Description |
|------|--------|-------------|
| 0 | Dark overlay | "Welcome to Cookie Capitalist! I'm Coogie, and I'll show you around!" |
| 1 | Dark overlay | "Your goal is to tap cookies and build a cookie empire!" |
| 2 | Dark overlay | "Let me show you the important parts of the screen..." |
| 3 | Header spotlight | "This is where your cookie count and cookies per second are displayed!" |

## Trigger Conditions

Onboarding starts automatically when:
- Player joins the world
- `cookies === 0` AND `cps === 0`
- Player is on a Mobile device

## Notes

- The mascot "Coogie" image is located at `Noesis/Images/Coogie.png`
- Onboarding blocks all input until completed (tap to continue advances steps)
- After step 3 (header spotlight), onboarding completes and hides
