const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 5000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let bot = null;
let botStatus = {
  connected: false,
  username: '',
  server: '',
  position: null,
  health: null,
  food: null,
  log: []
};

function addLog(message) {
  const entry = { time: new Date().toLocaleTimeString(), message };
  botStatus.log.unshift(entry);
  if (botStatus.log.length > 100) botStatus.log.pop();
  io.emit('log', entry);
}

function createBot(options) {
  if (bot) {
    try { bot.quit(); } catch (e) {}
    bot = null;
  }

  addLog(`Connecting to ${options.host}:${options.port} as ${options.username}...`);

  bot = mineflayer.createBot({
    host: options.host,
    port: parseInt(options.port) || 25565,
    username: options.username,
    version: options.version || false,
    auth: options.auth || 'offline'
  });

  bot.once('spawn', () => {
    botStatus.connected = true;
    botStatus.username = bot.username;
    botStatus.server = `${options.host}:${options.port}`;
    addLog(`Bot spawned as ${bot.username}`);
    io.emit('status', botStatus);
  });

  bot.on('health', () => {
    botStatus.health = bot.health;
    botStatus.food = bot.food;
    io.emit('stats', { health: bot.health, food: bot.food });
  });

  bot.on('move', () => {
    if (bot.entity) {
      botStatus.position = {
        x: Math.floor(bot.entity.position.x),
        y: Math.floor(bot.entity.position.y),
        z: Math.floor(bot.entity.position.z)
      };
      io.emit('position', botStatus.position);
    }
  });

  bot.on('chat', (username, message) => {
    addLog(`[Chat] <${username}> ${message}`);
  });

  bot.on('kicked', (reason) => {
    addLog(`Kicked: ${reason}`);
    botStatus.connected = false;
    bot = null;
    io.emit('status', botStatus);
  });

  bot.on('error', (err) => {
    addLog(`Error: ${err.message}`);
    botStatus.connected = false;
    bot = null;
    io.emit('status', botStatus);
  });

  bot.on('end', () => {
    addLog('Bot disconnected');
    botStatus.connected = false;
    bot = null;
    io.emit('status', botStatus);
  });
}

app.get('/api/status', (req, res) => {
  res.json(botStatus);
});

app.post('/api/connect', (req, res) => {
  const { host, port, username, version, auth } = req.body;
  if (!host || !username) {
    return res.status(400).json({ error: 'host and username are required' });
  }
  createBot({ host, port: port || 25565, username, version, auth });
  res.json({ message: 'Connecting...' });
});

app.post('/api/disconnect', (req, res) => {
  if (bot) {
    try { bot.quit(); } catch (e) {}
    bot = null;
    botStatus.connected = false;
    addLog('Disconnected by user');
    io.emit('status', botStatus);
  }
  res.json({ message: 'Disconnected' });
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!bot || !botStatus.connected) {
    return res.status(400).json({ error: 'Bot is not connected' });
  }
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  bot.chat(message);
  addLog(`[Sent] ${message}`);
  res.json({ message: 'Message sent' });
});

app.post('/api/command', (req, res) => {
  const { action } = req.body;
  if (!bot || !botStatus.connected) {
    return res.status(400).json({ error: 'Bot is not connected' });
  }
  switch (action) {
    case 'jump':
      bot.setControlState('jump', true);
      setTimeout(() => bot && bot.setControlState('jump', false), 500);
      addLog('Bot jumped');
      break;
    case 'forward':
      bot.setControlState('forward', true);
      setTimeout(() => bot && bot.setControlState('forward', false), 2000);
      addLog('Bot moved forward');
      break;
    case 'sneak':
      bot.setControlState('sneak', !bot.getControlState('sneak'));
      addLog('Toggled sneak');
      break;
    default:
      return res.status(400).json({ error: 'Unknown action' });
  }
  res.json({ message: `Executed: ${action}` });
});

io.on('connection', (socket) => {
  socket.emit('status', botStatus);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Minecraft Bot Dashboard running on http://0.0.0.0:${PORT}`);
});
