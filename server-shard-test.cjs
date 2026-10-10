'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = `${fs.readFileSync('server.js', 'utf8')}\nmodule.exports.__test = { arenas, arenaSockets, selectAvailableArena, shardArenaId, MAX_ARENA_PLAYERS };`;
const fakeServer = { keepAliveTimeout: 0, headersTimeout: 0, on() {} };
const fakeApp = { get() {}, listen(_port, _host, callback) { callback?.(); return fakeServer; } };
class FakeWss { constructor() { this.clients = new Set(); } on() {} }
const sandbox = {
  module: { exports: {} }, exports: {}, process, console, fetch,
  AbortSignal, URL, setInterval: () => 0, clearInterval() {},
  require(name) {
    if (name === 'express') return () => fakeApp;
    if (name === 'ws') return { WebSocketServer: FakeWss, WebSocket: { OPEN: 1 } };
    return require(name);
  }
};
vm.runInNewContext(source, sandbox, { filename: 'server.js' });
const t = sandbox.module.exports.__test;
assert.strictEqual(t.MAX_ARENA_PLAYERS, 20);
assert.strictEqual(t.selectAvailableArena(), t.shardArenaId(1));
const room1 = t.arenaSockets(t.shardArenaId(1));
for (let i = 0; i < 20; i += 1) room1.set(`p${i}`, {});
assert.strictEqual(t.selectAvailableArena(), t.shardArenaId(2));
const room2 = t.arenaSockets(t.shardArenaId(2));
for (let i = 0; i < 19; i += 1) room2.set(`q${i}`, {});
assert.strictEqual(t.selectAvailableArena(), t.shardArenaId(2));
room2.set('q19', {});
assert.strictEqual(t.selectAvailableArena(), t.shardArenaId(3));
console.log('Shard allocation OK: 20 players per room, overflow advances to the next room');
