const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      pv NUMERIC DEFAULT 0,
      bess NUMERIC DEFAULT 0,
      month_key TEXT,
      month TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Database ready');
}
initDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fe-fy27-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  if (req.path.startsWith('/api')) return res.status(401).json({ error: 'Unauthorised' });
  res.redirect('/login');
}

// Auth routes
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.DASHBOARD_USER || 'forest';
  const validPass = process.env.DASHBOARD_PASS || 'fy27';
  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// API — Projects
app.get('/api/projects', requireLogin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY month_key ASC, id ASC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', requireLogin, async (req, res) => {
  try {
    const { name, type, pv, bess, month_key, month } = req.body;
    const result = await pool.query(
      'INSERT INTO projects (name, type, pv, bess, month_key, month) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, type, pv || 0, bess || 0, month_key, month]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id', requireLogin, async (req, res) => {
  try {
    const { name, type, pv, bess, month_key, month } = req.body;
    const result = await pool.query(
      'UPDATE projects SET name=$1, type=$2, pv=$3, bess=$4, month_key=$5, month=$6 WHERE id=$7 RETURNING *',
      [name, type, pv || 0, bess || 0, month_key, month, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:id', requireLogin, async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Protected static files
app.use(requireLogin, express.static(path.join(__dirname, 'public')));
app.get('/', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Forest FY27 Dashboard running on port ${PORT}`));
