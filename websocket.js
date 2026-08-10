const WebSocket = require('ws');

let wss = null;
const clients = [];

function init(server) {
  wss = new WebSocket.Server({ server });
  wss.on('connection', (ws) => {
    console.log('💻 Dashboard đã kết nối WebSocket Realtime!');
    clients.push(ws);
    ws.on('close', () => {
      const index = clients.indexOf(ws);
      if (index !== -1) clients.splice(index, 1);
      console.log('❌ Dashboard đã ngắt kết nối.');
    });
  });
}

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = { init, broadcast, clients };