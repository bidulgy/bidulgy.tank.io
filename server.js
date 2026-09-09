'use strict';

const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gomwkcqkslaoypdbebid.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_iuGd7i15GSv3nszxJhQt0Q_OkNbGbm7';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ARENA_ID = 'iron-cell-arena-global-v1';
const MAX_ARENA_PLAYERS = Number(process.env.MAX_ARENA_PLAYERS || 64);
const MAX_MESSAGES_PER_SECOND = 180;
const MAX_STATE_MESSAGES_PER_SECOND = 25;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const BACKPRESSURE_DROP_BYTES = 256 * 1024;

const RELAY_EVENTS = new Set([
  'state',
  'shot',
  'shotSync',
  'shotEnd',
  'damage',
  'status',
  'kill',
  'skill',
  'worldSnapshot',
  'worldRequest',
  'shapeDamage',
  'shapeImpulse'
]);

const app = express();
const arenas = new Map(); // arenaId -> Map<userId, socket>

function arenaSockets(arenaId) {
  if (!arenas.has(arenaId)) arenas.set(arenaId, new Map());
  return arenas.get(arenaId);
}

function safeSend(socket, payload, { droppable = false } = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  if (droppable && socket.bufferedAmount > BACKPRESSURE_DROP_BYTES) return false;
  try {
    const wire = typeof payload === 'string' ? payload : JSON.stringify(payload);
    socket.send(wire);
    return true;
  } catch (_) {
    return false;
  }
}

function broadcastWire(arenaId, wire, exceptSocket = null, { droppable = false } = {}) {
  const room = arenas.get(arenaId);
  if (!room) return;
  for (const socket of room.values()) {
    if (socket === exceptSocket) continue;
    safeSend(socket, wire, { droppable });
  }
}

function presencePayload(arenaId) {
  const room = arenas.get(arenaId);
  const players = [];
  if (room) {
    for (const socket of room.values()) {
      if (socket.readyState !== WebSocket.OPEN || !socket.userId) continue;
      players.push({
        userId: socket.userId,
        username: socket.username || 'PLAYER'
      });
    }
  }
  players.sort((a, b) => a.userId.localeCompare(b.userId));
  return { type: 'presence', arenaId, players, serverTime: Date.now() };
}

function broadcastPresence(arenaId) {
  const wire = JSON.stringify(presencePayload(arenaId));
  broadcastWire(arenaId, wire);
}

function cleanupArena(arenaId) {
  const room = arenas.get(arenaId);
  if (room && room.size === 0) arenas.delete(arenaId);
}

function removeSocket(socket) {
  const arenaId = socket.arenaId;
  const userId = socket.userId;
  socket.arenaId = null;
  socket.userId = null;
  if (!arenaId || !userId) return;

  const room = arenas.get(arenaId);
  if (room?.get(userId) === socket) room.delete(userId);
  cleanupArena(arenaId);

  if (arenas.has(arenaId)) broadcastPresence(arenaId);
}

function resetRateWindow(socket, now) {
  socket.rateWindowAt = now;
  socket.rateCount = 0;
  socket.stateRateCount = 0;
}

function enforceRate(socket, eventName) {
  const now = Date.now();
  if (!socket.rateWindowAt || now - socket.rateWindowAt >= 1000) resetRateWindow(socket, now);

  socket.rateCount += 1;
  if (eventName === 'state') socket.stateRateCount += 1;

  if (socket.rateCount > MAX_MESSAGES_PER_SECOND) return false;
  if (socket.stateRateCount > MAX_STATE_MESSAGES_PER_SECOND) return false;
  return true;
}

async function fetchSupabaseUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`AUTH_${response.status}`);
  const user = await response.json();
  if (!user?.id) throw new Error('AUTH_NO_USER');
  return user;
}

function normalizeUsername(value) {
  return String(value || 'PLAYER')
    .replace(/[^\p{L}\p{N}_\- .]/gu, '')
    .trim()
    .slice(0, 24) || 'PLAYER';
}

async function joinArena(socket, message) {
  const arenaId = String(message.arenaId || '').trim();
  const accessToken = String(message.accessToken || '').trim();

  if (arenaId !== ARENA_ID) {
    safeSend(socket, { type: 'error', code: 'ARENA_NOT_ALLOWED' });
    socket.close(4003, 'arena_not_allowed');
    return;
  }
  if (!accessToken || accessToken.length > 10000) {
    safeSend(socket, { type: 'error', code: 'JOIN_DATA_REQUIRED' });
    socket.close(4001, 'join_data_required');
    return;
  }

  let user;
  try {
    user = await fetchSupabaseUser(accessToken);
  } catch (error) {
    safeSend(socket, { type: 'error', code: 'AUTH_FAILED', message: error.message });
    socket.close(4001, 'auth_failed');
    return;
  }

  const room = arenaSockets(arenaId);
  const existing = room.get(user.id);
  if (existing && existing !== socket) {
    existing.__manualServerClose = true;
    room.delete(user.id);
    try { existing.close(4000, 'replaced'); } catch (_) {}
  }

  if (room.size >= MAX_ARENA_PLAYERS) {
    safeSend(socket, { type: 'error', code: 'ARENA_FULL' });
    socket.close(4004, 'arena_full');
    return;
  }

  socket.arenaId = arenaId;
  socket.userId = String(user.id);
  socket.username = normalizeUsername(message.username || user?.user_metadata?.username);
  room.set(socket.userId, socket);

  safeSend(socket, {
    type: 'joined',
    arenaId,
    userId: socket.userId,
    players: presencePayload(arenaId).players,
    serverTime: Date.now()
  });

  broadcastPresence(arenaId);
}

function normalizeRelayPayload(eventName, payload, socket) {
  const p = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? { ...payload }
    : {};

  if (eventName === 'state') p.id = socket.userId;
  if (['shot', 'shotSync', 'shotEnd', 'skill'].includes(eventName)) p.ownerId = socket.userId;
  if (['damage', 'status', 'shapeDamage', 'shapeImpulse'].includes(eventName)) p.sourceId = socket.userId;
  if (eventName === 'worldSnapshot') p.hostId = socket.userId;
  if (eventName === 'worldRequest') p.requesterId = socket.userId;
  return p;
}

app.get('/', (_req, res) => {
  res.type('text/plain').send('Sworder VS Tank t3.small arena server OK');
});

app.get('/health', (_req, res) => {
  let players = 0;
  for (const room of arenas.values()) players += room.size;
  res.json({
    ok: true,
    arena: ARENA_ID,
    arenas: arenas.size,
    players,
    websocketClients: wss.clients.size,
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString()
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Tank arena server listening on ${HOST}:${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const wss = new WebSocketServer({
  server,
  path: '/arena-ws',
  maxPayload: MAX_PAYLOAD_BYTES,
  perMessageDeflate: false
});

wss.on('connection', socket => {
  socket.isAlive = true;
  socket.arenaId = null;
  socket.userId = null;
  socket.username = 'PLAYER';
  resetRateWindow(socket, Date.now());

  socket.on('pong', () => { socket.isAlive = true; });

  socket.on('message', async raw => {
    if (raw.length > MAX_PAYLOAD_BYTES) {
      socket.close(1009, 'message_too_large');
      return;
    }

    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (_) {
      safeSend(socket, { type: 'error', code: 'INVALID_JSON' });
      return;
    }

    const type = String(message?.type || '');

    if (type === 'join') {
      if (socket.arenaId) return;
      await joinArena(socket, message);
      return;
    }

    if (!socket.arenaId || !socket.userId) {
      safeSend(socket, { type: 'error', code: 'NOT_JOINED' });
      return;
    }

    if (type === 'client_ping') {
      safeSend(socket, {
        type: 'client_pong',
        sentAt: Number(message.sentAt || 0),
        serverTime: Date.now()
      });
      return;
    }

    if (type === 'leave') {
      removeSocket(socket);
      safeSend(socket, { type: 'left' });
      socket.__manualServerClose = true;
      try { socket.close(1000, 'left'); } catch (_) {}
      return;
    }

    if (type !== 'event') {
      safeSend(socket, { type: 'error', code: 'UNKNOWN_MESSAGE_TYPE' });
      return;
    }

    const eventName = String(message.event || '');
    if (!RELAY_EVENTS.has(eventName)) {
      safeSend(socket, { type: 'error', code: 'EVENT_NOT_ALLOWED' });
      return;
    }
    if (!enforceRate(socket, eventName)) {
      // 상태 패킷은 다음 프레임이 곧 오므로 rate-limit 시 조용히 버립니다.
      if (eventName !== 'state') safeSend(socket, { type: 'error', code: 'RATE_LIMIT' });
      return;
    }

    const payload = normalizeRelayPayload(eventName, message.payload, socket);
    const wire = JSON.stringify({
      type: 'event',
      event: eventName,
      payload,
      serverTime: Date.now()
    });

    // 위치 state는 밀렸을 때 과거 프레임을 보내지 않아도 되므로 backpressure에서 버릴 수 있습니다.
    broadcastWire(socket.arenaId, wire, socket, { droppable: eventName === 'state' });
  });

  socket.on('close', () => removeSocket(socket));
  socket.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      try { socket.terminate(); } catch (_) {}
      continue;
    }
    socket.isAlive = false;
    try { socket.ping(); } catch (_) {}
  }
}, 15000);

server.on('close', () => clearInterval(heartbeat));
