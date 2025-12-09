# Cookie Capitalist

Cookie Capitalist is a Meta Horizon Worlds clicker game built with the TypeScript scripting API and Noesis UI. This repository contains the game logic, UI controllers, and supporting utilities used in the published world.

## Overview

- Server-side game logic in `backend.ts`
- Player/controller logic in `controller_player.ts` and `controller_sfx.ts`
- Noesis UI controllers in the `noesis_*.ts` files and XAML layouts in `Noesis/`
- Persistent player variables (PPVs) helpers in `util_ppv.ts`
- Shared game data types, events, and helpers in `util_gameData.ts`

This repo is primarily intended as a reference implementation and starting point for building similar Horizon Worlds projects.

## Requirements

- Meta Horizon Worlds Desktop Editor (for running the world and scripts)
- Node.js and npm (optional, for local TypeScript tooling)

## Getting Started

1. Clone or download this repository.
2. Open the `scripts` folder in your editor of choice.
3. Use the Meta Horizon Worlds Desktop Editor to create/import a world and attach these scripts and Noesis XAML assets to matching entities.
4. Use the existing code as a reference for:
   - Game state management on the server (`backend.ts`)
   - Noesis UI integration (`Noesis/` + `noesis_*.ts`)
   - Persistent player variables (`util_ppv.ts`)

This repo does **not** include a one-click importable world template; it focuses on the scripting and UI layer.

## Project Structure

- `backend.ts` – server-side game loop, state, leaderboards, PPVs
- `controller_player.ts` – local player controller, input, raycasts
- `controller_sfx.ts` – shared SFX controller for UI and gameplay
- `noesis_*.ts` – Noesis UI view models for cookie, shop, overlay, onboarding, etc.
- `Noesis/` – Noesis XAML layouts and related assets
- `util_gameData.ts` – shared types, events, upgrade config, formatting helpers
- `util_ppv.ts` – PPV manager for loading/saving player data
- `util_logger.ts` – structured logging helper for debugging
- `types/` – Horizon Worlds TypeScript API definitions (see licensing note below)
- `sfx/` – audio assets used by the world (see licensing note below)

## Licensing

- **Game code** (TypeScript, XAML authored for this project, and configuration in this repo) is licensed under the MIT License (see `LICENSE`).
- **Horizon API type definitions** in `types/*.d.ts` are provided by Meta as part of the Horizon Worlds SDK and remain subject to Meta's terms. They are **not** re-licensed under MIT by this repository.
- **Audio assets** under `sfx/` (for example, `JDSherbert - Ultimate UI SFX Pack (FREE)` and `kenney_interface-sounds`) are third-party assets with their own licenses. Review their respective license files/pages before reusing them outside this project.

If you fork or reuse this repository, ensure that your usage of the Horizon API definitions and third-party assets complies with their original licenses and terms of use.