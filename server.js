const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { PORT, adminHtmlPath } = require('./config');
require('./db');
const websocket = require('./websocket');
const routes = require('./routes');

const app = express();

// CORS: cho phép domain từ env (Render) hoặc mọi origin khi dev local
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? {
  origin: [corsOrigin, /localhost/],
  credentials: true
} : {}));

app.use(express.json());

// Serve static files từ thư mục public/ (js, css, assets...)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(adminHtmlPath);
});

// /dashboard trỏ sang public/dashboard.html
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.use('/api', routes);

const server = http.createServer(app);
websocket.init(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server đang chạy tại: http://0.0.0.0:${PORT}`);
  console.log(`👉 Endpoint nhận API: POST http://0.0.0.0:${PORT}/api/touchpoint`);
});