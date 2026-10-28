# Mini Ops: Laser Arena

A compact browser-based 3D laser-tag prototype.

## Features
- Practice mode with floating targets and three moving training bots
- Online multiplayer with Socket.IO room codes
- Two small 3D maps: **Rustyard Arena** and **Little Town**
- Seven fictional energy swords: **Pulse, Ember, Glacier, Nova, Toxic, Prism, Eclipse**
- Matching stylized operator outfit for all players
- Desktop controls and Android touch controls

## Run it
Install Node.js 18 or newer, then run:

```bash
npm install
npm start
```

Open `http://localhost:3000`. Practice mode works on the local server.

## Put it on GitHub and make it online
GitHub stores the source but GitHub Pages cannot run the Socket.IO multiplayer server. Push this repository to GitHub, then deploy it on a Node.js host that supports WebSockets (for example Render or Railway).

- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node.js 18+

Open the deployed public URL on each device, choose **Online Multiplayer**, and enter the same room code.

## Controls
- **Desktop:** WASD to move, mouse to look, click or Space to swing, keys `1`–`7` to change sword, Escape to pause.
- **Phone:** left joystick to move, drag the right side to look, SWING button to swing, numbered sword chips to switch.

## Current prototype limits
Three.js and the UI font load from CDNs and require internet access. Multiplayer synchronizes player positions and swing effects, but this prototype does not yet have server-authoritative hit validation, anti-cheat, accounts, matchmaking, persistence, or production-grade collision handling. The project is a playable starting point, not a commercial-ready release.
