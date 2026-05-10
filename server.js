const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fe-fy27-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hour session
}));

// Auth middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login submit
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

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Protected dashboard
app.use(requireLogin, express.static(path.join(__dirname, 'public')));
app.get('/', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Forest FY27 Dashboard running on port ${PORT}`));
