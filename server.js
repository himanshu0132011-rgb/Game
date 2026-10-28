const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));
const rooms = new Map();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
io.on('connection', socket => {
  socket.on('joinRoom', info => {
    const code = String(info.code || 'STAR7').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'STAR7';
    if (socket.data.room) {
      const old = rooms.get(socket.data.room);
      if (old) old.delete(socket.id);
      socket.to(socket.data.room).emit('playerLeft', socket.id);
      socket.leave(socket.data.room);
    }
    socket.data.room = code;
    socket.join(code);
    if (!rooms.has(code)) rooms.set(code, new Map());
    const room = rooms.get(code);
    const player = { id: socket.id, name: String(info.name || 'Operator').slice(0, 16), x: Math.random()*6-3, z: Math.random()*6-3, rot: 0, sword: 0, map: info.map === 'town' ? 'town' : 'yard' };
    room.set(socket.id, player);
    socket.emit('roomJoined', { code, id: socket.id, players: [...room.values()] });
    socket.to(code).emit('playerJoined', player);
  });
  socket.on('state', state => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.has(socket.id)) return;
    const p = room.get(socket.id);
    p.x = clamp(Number(state.x) || 0, -48, 48); p.z = clamp(Number(state.z) || 0, -48, 48);
    p.rot = Number(state.rot) || 0; p.sword = clamp(Number(state.sword) || 0, 0, 6); p.map = state.map === 'town' ? 'town' : 'yard';
    socket.to(socket.data.room).emit('playerState', p);
  });
  socket.on('swing', data => socket.to(socket.data.room || '').emit('swing', { id: socket.id, sword: Number(data && data.sword) || 0 }));
  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.room);
    if (room) { room.delete(socket.id); socket.to(socket.data.room).emit('playerLeft', socket.id); if (!room.size) rooms.delete(socket.data.room); }
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Mini Ops Laser Arena listening on ${PORT}`));
