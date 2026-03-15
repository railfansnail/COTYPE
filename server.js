'use strict';
const express = require('express');
const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const config  = require('./config.json');
const db      = require('./db/database');

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1);

// Security headers
// 주의: HTML에 onclick/oninput 등 인라인 이벤트 핸들러가 있으므로
// scriptSrcAttr 에도 'unsafe-inline' 이 반드시 필요하다.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      // 인라인 <script> 블록 허용
      scriptSrc:     ["'self'", "'unsafe-inline'"],
      // onclick="" 등 인라인 이벤트 핸들러 허용 ← 이게 핵심
      scriptSrcAttr: ["'unsafe-inline'"],
      // 인라인 <style> + 구글 폰트 CSS
      styleSrc:      ["'self'", "'unsafe-inline'",
                      'https://fonts.googleapis.com'],
      // 구글 폰트 파일
      fontSrc:       ["'self'",
                      'https://fonts.gstatic.com',
                      'https://fonts.googleapis.com'],
      // self + data URI + 파비콘 외부 도메인(ibb.co)
      imgSrc:        ["'self'", 'data:', 'https://i.ibb.co'],
      // HTML 미리보기 iframe (same-origin sandbox)
      frameSrc:      ["'self'", 'blob:'],
      // API fetch
      connectSrc:    ["'self'"],
      // 기타 기본 차단
      objectSrc:     ["'none'"],
      baseUri:       ["'self'"],
    },
  },
  // iframe sandbox srcdoc 에서 필요
  crossOriginEmbedderPolicy: false,
  // X-Frame-Options 은 sameorigin 허용
  frameguard: { action: 'sameorigin' },
}));

app.use(cors({ origin: true, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '2kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
}));

// ── Rate limiter ──────────────────────────────────────────────────────────────
const rankLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

// ── Input validation helpers ──────────────────────────────────────────────────
const VALID_LANGS  = ['html','css','js','python','c','cpp','csharp','java','custom'];
const VALID_MODES  = ['code','kw'];
const NICK_RE      = /^[\w\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F!@#$%^&*()_+\-=[\]{};':",./<>?]+$/u;

function validateRankBody(body) {
  const { nickname, wpm, accuracy, lang, mode } = body;
  const min = config.ranking.nicknameMinLen;
  const max = config.ranking.nicknameMaxLen;
  if (!nickname || typeof nickname !== 'string')         return '닉네임이 필요합니다.';
  if (nickname.length < min || nickname.length > max)    return `닉네임은 ${min}~${max}자여야 합니다.`;
  if (!NICK_RE.test(nickname))                           return '닉네임에 사용할 수 없는 문자가 있습니다.';
  if (!Number.isInteger(wpm) || wpm < 1 || wpm > 300)   return 'WPM 값이 허용 범위를 초과합니다. (최대 300)';
  if (!Number.isInteger(accuracy) || accuracy < 0 || accuracy > 100) return '잘못된 정확도 값입니다.';
  if (!VALID_LANGS.includes(lang))  return '지원하지 않는 언어입니다.';
  if (!VALID_MODES.includes(mode))  return '지원하지 않는 모드입니다.';
  return null;
}

// ── API routes ────────────────────────────────────────────────────────────────

// GET /api/rankings?lang=html&mode=code&limit=50
app.get('/api/rankings', (req, res) => {
  try {
    const { lang, mode, limit } = req.query;
    if (lang && !VALID_LANGS.includes(lang)) return res.status(400).json({ error: '잘못된 언어 파라미터' });
    if (mode && !VALID_MODES.includes(mode)) return res.status(400).json({ error: '잘못된 모드 파라미터' });
    const rows = db.getRankings({ lang, mode, limit });
    res.json({ data: rows });
  } catch (e) {
    console.error('GET /api/rankings:', e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/rankings
app.post('/api/rankings', rankLimiter, (req, res) => {
  try {
    const err = validateRankBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const { nickname, wpm, accuracy, lang, mode, snippet } = req.body;
    const snippetClean = typeof snippet === 'string' ? snippet.slice(0, 60) : null;

    const id   = db.insertRanking({ nickname, wpm, accuracy, lang, mode, snippet: snippetClean });
    const rank = db.getRankPosition(id);
    res.json({ success: true, rank });
  } catch (e) {
    console.error('POST /api/rankings:', e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Server startup ────────────────────────────────────────────────────────────
function startHttp() {
  if (!config.http.enabled) return;
  const srv = http.createServer(app);
  srv.listen(config.http.port, () =>
    console.log(`[HTTP]  http://localhost:${config.http.port}`)
  );
  srv.on('error', e => console.error('[HTTP] error:', e.message));
}

function startHttps() {
  if (!config.https.enabled) return;
  let tlsOpts;
  try {
    tlsOpts = {
      cert: fs.readFileSync(path.resolve(config.https.certPath)),
      key:  fs.readFileSync(path.resolve(config.https.keyPath)),
    };
  } catch (e) {
    console.error('[HTTPS] 인증서 파일을 읽을 수 없습니다:', e.message);
    console.error('        config.json 의 certPath / keyPath 를 확인하세요.');
    return;
  }

  if (config.ca.enabled) {
    try {
      tlsOpts.ca = fs.readFileSync(path.resolve(config.ca.caPath));
      console.log('[CA]    CA 인증서 로드됨');
    } catch (e) {
      console.error('[CA]    CA 파일을 읽을 수 없습니다:', e.message);
    }
    if (config.ca.requestClientCert) {
      tlsOpts.requestCert       = true;
      tlsOpts.rejectUnauthorized = config.ca.rejectUnauthorized;
      console.log('[CA]    클라이언트 인증서 요청 활성화');
    }
  }

  const srv = https.createServer(tlsOpts, app);
  srv.listen(config.https.port, () =>
    console.log(`[HTTPS] https://localhost:${config.https.port}`)
  );
  srv.on('error', e => console.error('[HTTPS] error:', e.message));

  // Optional HTTP → HTTPS redirect
  if (config.http.enabled && config.https.redirectHttp) {
    const redirectApp = express();
    redirectApp.use((req, res) => {
      const host = req.headers.host?.replace(/:\d+$/, '');
      res.redirect(301, `https://${host}:${config.https.port}${req.url}`);
    });
    http.createServer(redirectApp).listen(config.http.port, () =>
      console.log(`[HTTP]  Redirecting to HTTPS on port ${config.http.port}`)
    );
  }
}

startHttp();
startHttps();
console.log('[DB]    Rankings DB ready →', path.resolve(config.db.path));
