const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { PORT, adminHtmlPath, DEMO_USERS } = require('./config');
require('./db');
const websocket = require('./websocket');
const routes = require('./routes');

const app = express();

// CORS: cho phép domain từ env (Render/Railway) hoặc mọi origin khi dev local
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? {
  origin: [corsOrigin, /localhost/],
  credentials: true
} : {}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Simple cookie-based session ───────────────────────────────────────
// Dùng signed token đơn giản: base64(username:timestamp) lưu trong cookie
const AUTH_COOKIE = 'dth_session';
const SECRET     = process.env.SESSION_SECRET || 'dth_demo_secret_2024';

function makeToken(username) {
  return Buffer.from(`${username}:${Date.now()}:${SECRET}`).toString('base64');
}
function isValidToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    return parts.length === 3 && parts[2] === SECRET;
  } catch { return false; }
}

// Middleware kiểm tra auth cho /dashboard và /admin
function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE]
    || req.headers['x-auth-token'];
  if (isValidToken(token)) return next();
  // AJAX request → trả 401
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(401).json({ status: 'error', message: 'Chưa đăng nhập' });
  }
  // Browser request → redirect về login
  res.redirect('/login');
}

// Parse cookies thủ công (không dùng cookie-parser để tránh thêm dep)
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie || '';
  cookieHeader.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) req.cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  next();
});

// Serve static files từ thư mục public/
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth routes ───────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = DEMO_USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ status: 'error', message: 'Sai tên đăng nhập hoặc mật khẩu' });
  }
  const token = makeToken(username);
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.json({ status: 'success', token, username });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Path=/; Max-Age=0`);
  res.json({ status: 'success' });
});

// Endpoint cho Map UI kiểm tra token qua header
app.get('/api/auth/verify', (req, res) => {
  const token = req.cookies?.[AUTH_COOKIE] || req.headers['x-auth-token'];
  if (isValidToken(token)) {
    return res.json({ status: 'success' });
  }
  res.status(401).json({ status: 'error', message: 'Chưa đăng nhập' });
});

// ── Protected routes ──────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(adminHtmlPath);
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.use('/api', routes);

const server = http.createServer(app);
websocket.init(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server đang chạy tại: http://0.0.0.0:${PORT}`);
  console.log(`👉 Endpoint nhận API: POST http://0.0.0.0:${PORT}/api/touchpoint`);
});