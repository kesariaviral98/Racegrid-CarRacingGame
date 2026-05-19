# Contributing to RACEGRID

Thanks for taking the time to contribute!

## Getting started

1. Fork the repo and clone your fork
2. Follow the [Quick Start](../README.md#quick-start) to get a local environment running
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Make your changes, then open a pull request against `main`

## Project structure

```
client/src/
  constants/   shared game tuning values (speed, laps, hitboxes)
  game/r3f/    Three.js scene graph — edit here for visual/physics changes
  views/       React pages and HUD components
server/src/
  controllers/ authoritative game loop and WebSocket handler
  models/      game state, player types, Supabase services
```

## Code style

- TypeScript strict mode is enforced on both client and server
- ESLint + Prettier are configured; run `npm run lint` before committing
- Prefer named exports; avoid default exports except for pages

## Reporting bugs

Use the **Bug report** issue template and include:
- Steps to reproduce
- Expected vs actual behaviour
- Browser/OS if it's a rendering issue

## Suggesting features

Open a **Feature request** issue before starting work so we can align on scope.
