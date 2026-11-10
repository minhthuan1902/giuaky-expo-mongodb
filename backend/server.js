require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI || !JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('thay_bang')) {
  console.error('Hay thiet lap MONGO_URI va JWT_SECRET (>=32 ky tu) trong backend/.env');
  process.exit(1);
}

// CHI DUNG 4 TRUONG THEO DE: email, matkhau, hoten, hinhanh.
// MongoDB tu them _id; khong tao role, timestamps hay __v.
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 180 },
  matkhau: { type: String, required: true }, // bcrypt hash, KHONG luu mat khau ro
  hoten: { type: String, required: true, trim: true, maxlength: 100 },
  hinhanh: { type: String, default: '' }      // data:image/...;base64,...
}, { versionKey: false, timestamps: false, strict: 'throw' });
const User = mongoose.model('User', userSchema, 'users');

app.use(cors()); // Cho phep localhost/IP laptop khi demo; cau hinh origin neu deploy Internet.
app.use(express.json({ limit: '7mb' }));

function cleanEmail(v) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 180; }
function validName(v) { return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100; }
function validPassword(v) { return typeof v === 'string' && v.length >= 6 && v.length <= 100; }
function validImage(v) {
  return typeof v === 'string' && (v === '' || (
    v.length <= 4_500_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)
  ));
}
function publicUser(u) {
  return { _id: String(u._id), email: u.email, hoten: u.hoten, hinhanh: u.hinhanh };
}
function sendError(res, error) {
  if (error?.code === 11000) return res.status(409).json({ error: 'Email da ton tai.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError' || error?.name === 'StrictModeError') {
    return res.status(400).json({ error: 'Du lieu khong hop le.' });
  }
  console.error('API error:', error.message);
  return res.status(500).json({ error: 'Loi may chu.' });
}
function tokenFor(user) {
  return jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: '12h' });
}
async function requireLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Ban can dang nhap.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!mongoose.isValidObjectId(payload.sub)) return res.status(401).json({ error: 'Phien dang nhap khong hop le.' });
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Tai khoan khong con ton tai.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Phien dang nhap het han hoac khong hop le.' });
  }
}
function validateInput(data, creating) {
  const email = cleanEmail(data.email);
  const hoten = typeof data.hoten === 'string' ? data.hoten.trim() : '';
  const matkhau = data.matkhau;
  const hinhanh = data.hinhanh === undefined ? '' : data.hinhanh;
  if (!validEmail(email)) return 'Email khong hop le.';
  if (!validName(hoten)) return 'Ho ten khong hop le.';
  if ((creating || (matkhau !== undefined && matkhau !== '')) && !validPassword(matkhau)) return 'Mat khau can 6-100 ky tu.';
  if (!validImage(hinhanh)) return 'Anh khong hop le, chi nhan JPG/PNG/WebP toi da khoang 3MB.';
  return null;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 }));
app.get('/api/auth/setup-status', async (_req, res) => {
  try { res.json({ needsSetup: !(await User.exists({})) }); }
  catch (error) { sendError(res, error); }
});

// Tao tai khoan dau tien KHI DB TRONG; khong luu truong role theo yeu cau de bai.
app.post('/api/auth/setup', async (req, res) => {
  try {
    if (await User.exists({})) return res.status(403).json({ error: 'Da co tai khoan; hay dang nhap.' });
    const { email, matkhau, hoten, hinhanh = '' } = req.body || {};
    const problem = validateInput({ email, matkhau, hoten, hinhanh }, true);
    if (problem) return res.status(400).json({ error: problem });
    const user = await User.create({ email: cleanEmail(email), matkhau: await bcrypt.hash(matkhau, 10), hoten: hoten.trim(), hinhanh });
    return res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { return sendError(res, error); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const matkhau = req.body?.matkhau;
    if (!validEmail(email) || typeof matkhau !== 'string') return res.status(400).json({ error: 'Nhap email va mat khau.' });
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(matkhau, user.matkhau))) {
      return res.status(401).json({ error: 'Email hoac mat khau khong dung.' });
    }
    return res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { return sendError(res, error); }
});
app.get('/api/auth/me', requireLogin, (req, res) => res.json(publicUser(req.user)));

app.get('/api/users', requireLogin, async (_req, res) => {
  try { res.json((await User.find({}).sort({ _id: -1 })).map(publicUser)); }
  catch (error) { sendError(res, error); }
});
app.post('/api/users', requireLogin, async (req, res) => {
  try {
    const { email, matkhau, hoten, hinhanh = '' } = req.body || {};
    const problem = validateInput({ email, matkhau, hoten, hinhanh }, true);
    if (problem) return res.status(400).json({ error: problem });
    const user = await User.create({ email: cleanEmail(email), matkhau: await bcrypt.hash(matkhau, 10), hoten: hoten.trim(), hinhanh });
    return res.status(201).json(publicUser(user));
  } catch (error) { return sendError(res, error); }
});
app.put('/api/users/:id', requireLogin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID khong hop le.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Khong tim thay nguoi dung.' });
    const data = {
      email: req.body?.email === undefined ? user.email : req.body.email,
      hoten: req.body?.hoten === undefined ? user.hoten : req.body.hoten,
      matkhau: req.body?.matkhau,
      hinhanh: req.body?.hinhanh === undefined ? user.hinhanh : req.body.hinhanh
    };
    const problem = validateInput(data, false);
    if (problem) return res.status(400).json({ error: problem });
    user.email = cleanEmail(data.email);
    user.hoten = data.hoten.trim();
    user.hinhanh = data.hinhanh;
    if (data.matkhau) user.matkhau = await bcrypt.hash(data.matkhau, 10);
    await user.save();
    return res.json(publicUser(user));
  } catch (error) { return sendError(res, error); }
});
app.delete('/api/users/:id', requireLogin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'ID khong hop le.' });
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Khong tim thay nguoi dung.' });
    return res.json({ ok: true });
  } catch (error) { return sendError(res, error); }
});
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Anh qua lon.' });
  console.error('Request error:', error.message);
  return res.status(400).json({ error: 'Du lieu yeu cau khong hop le.' });
});

mongoose.connect(MONGO_URI).then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API: http://localhost:${PORT}/api/health`);
    console.log(`MongoDB: ${mongoose.connection.name}`);
  });
}).catch(error => {
  console.error('Khong ket noi duoc MongoDB:', error.message);
  process.exit(1);
});
