const socket = io();

const statusBadge = document.getElementById('status-badge');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const actionBtns = document.querySelectorAll('.btn.action');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

function setConnected(connected) {
  statusBadge.textContent = connected ? 'Online' : 'Offline';
  statusBadge.className = 'badge ' + (connected ? 'online' : 'offline');
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
  actionBtns.forEach(b => b.disabled = !connected);
  chatInput.disabled = !connected;
  chatSendBtn.disabled = !connected;
}

function updateStats(status) {
  document.getElementById('stat-username').textContent = status.username || '-';
  document.getElementById('stat-server').textContent = status.server || '-';
  document.getElementById('stat-health').textContent = status.health !== null ? status.health : '-';
  document.getElementById('stat-food').textContent = status.food !== null ? status.food : '-';
  if (status.position) {
    const p = status.position;
    document.getElementById('stat-position').textContent = `${p.x} / ${p.y} / ${p.z}`;
  } else {
    document.getElementById('stat-position').textContent = '-';
  }
}

function addLogEntry(entry) {
  const list = document.getElementById('log-list');
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">${entry.time}</span><span class="log-msg">${entry.message}</span>`;
  list.prepend(div);
  while (list.children.length > 100) list.lastChild.remove();
}

socket.on('status', (status) => {
  setConnected(status.connected);
  updateStats(status);
  if (status.log) {
    document.getElementById('log-list').innerHTML = '';
    status.log.forEach(entry => addLogEntry(entry));
  }
});

socket.on('log', (entry) => addLogEntry(entry));

socket.on('stats', (data) => {
  if (data.health !== undefined) document.getElementById('stat-health').textContent = data.health;
  if (data.food !== undefined) document.getElementById('stat-food').textContent = data.food;
});

socket.on('position', (pos) => {
  document.getElementById('stat-position').textContent = `${pos.x} / ${pos.y} / ${pos.z}`;
});

document.getElementById('connect-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    host: document.getElementById('host').value.trim(),
    port: document.getElementById('port').value || 25565,
    username: document.getElementById('username').value.trim(),
    version: document.getElementById('version').value.trim() || undefined,
    auth: document.getElementById('auth').value
  };
  await fetch('/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
});

disconnectBtn.addEventListener('click', async () => {
  await fetch('/api/disconnect', { method: 'POST' });
});

actionBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: btn.dataset.action })
    });
  });
});

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = '';
  await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg })
  });
});
