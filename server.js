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

server.listen(PORT, () => {
  console.log(`🚀 Local Ingestion Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`👉 Endpoint nhận API: POST http://localhost:${PORT}/api/touchpoint`);
});