// server/index.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PORT = process.env.PORT || 4000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'replace_this_with_real_key';

const DATA_FILE = path.join(__dirname, 'products.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2,8) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('readData error', e);
    return [];
  }
}
function writeData(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' });
  const token = auth.split(' ')[1];
  if (token !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  next();
}

app.get('/api/products', (req, res) => {
  const data = readData();
  res.json(data);
});

app.get('/api/verify', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

app.post('/api/products', requireAdmin, upload.single('image'), (req, res) => {
  const { title, price, category, desc, img } = req.body;
  const fileImg = req.file ? `/uploads/${req.file.filename}` : (img || '');
  const products = readData();
  const id = 'prod-' + Date.now();
  const product = { id, title, price: Number(price || 0), category, img: fileImg, desc };
  products.push(product);
  writeData(products);
  res.status(201).json(product);
});

app.put('/api/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  const id = req.params.id;
  const { title, price, category, desc, img } = req.body;
  const products = readData();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const fileImg = req.file ? `/uploads/${req.file.filename}` : (img || products[idx].img || '');
  products[idx] = { ...products[idx], title, price: Number(price || products[idx].price || 0), category, img: fileImg, desc };
  writeData(products);
  res.json(products[idx]);
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  let products = readData();
  const found = products.find(p => p.id === id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  products = products.filter(p => p.id !== id);
  writeData(products);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`RS FSHUB API running on port ${PORT}`);
});
