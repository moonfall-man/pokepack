# Sprint Brief — Studio Pong (PONG)

- **Date:** 2026-08-13
- **Author:** Priya "PJ" Joshi, Senior Producer
- **Sprint:** PONG Sprint 1 — one dev, tickets built in order, each ticket leaves the game runnable

## Concept

A polished browser Pong: you versus a simple CPU opponent, keyboard only, first to 7 with a proper win screen and instant restart. Neon arcade presentation with just enough juice — ball trail, hit flash — to feel alive, shipped as static files anyone can double-click.

## Design pillars

1. **Readable at arcade speed.** Ball, paddles, and score are legible at a glance; nothing on screen exists that doesn't serve play.
2. **Juice, not clutter.** Every effect answers "what just happened?" If it doesn't map to a game event, it doesn't ship.
3. **Zero-friction to run.** Open `index.html`, play. No install, no build, no network.

## Ship constraint (non-negotiable)

The game ships as plain static files in one per-project folder — `pong/` containing `index.html`, `css/`, and `js/`. It must run by opening `index.html` from disk. No build step, no bundler, no npm, no frameworks, no server code. If a change breaks "double-click and play," it doesn't merge.

## This sprint ships

Three tickets, one dev, built sequentially. Each ticket ends in a runnable state.

### PONG-1 — Playable rally
Static scaffold in `pong/` (index.html + css/ + js/). Canvas court, player paddle on W/S **or** arrow keys, CPU paddle with simple ball tracking (speed-capped so it's beatable), ball movement with wall and paddle bounces. Endless rally, no scoring yet. **Done when:** a rally against the CPU feels fair and responsive at 60fps.

### PONG-2 — Match loop
Serve and reset, a point when the ball exits a side, first to 7, win/lose screen naming the winner, restart (key or button) into a fresh match. **Done when:** a full match can be played and replayed without reloading the page.

### PONG-3 — Neon presentation and juice
Neon art pass: dark court, glowing paddles and ball, center line, styled score. Juice: ball trail, hit flash on paddle and wall contact, small score pop. **Done when:** the game reads as "polished arcade" in a 10-second look, and every effect maps to a game event.

## Out of scope (do not build)

- Audio of any kind — SFX, music, mute toggles
- Two-player local, online play, or spectating
- Difficulty settings, CPU personalities, or adaptive AI
- Touch/mobile controls, gamepad support
- Pause menus, settings screens, leaderboards, persistence of any kind
- Power-ups, alternate modes, screen shake, particles — no juice beyond trail, hit flash, and score pop
- Frameworks, bundlers, TypeScript, asset pipelines — see ship constraint

If it isn't in a ticket above, it's a proposal for next sprint, not a commitment in this one.
