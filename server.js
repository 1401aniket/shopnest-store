import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

if (!jwtSecret || jwtSecret === 'replace-with-a-long-random-secret') {
  if (isProduction) throw new Error('JWT_SECRET must be configured in production');
  console.warn('Using a development JWT secret. Set JWT_SECRET before deployment.');
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '100kb' }));

const db = new Database(path.join(__dirname, '..', 'shopnest.db'));
db.pragma('journal_mode = WAL');
db.exec(readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
try { db.exec("ALTER TABLE products ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]'"); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }

const seedProducts = [
  [1, 'Ripple ceramic vase', 'Home', 1290, 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=700&q=80', 12],
  [2, 'Everyday linen shirt', 'Style', 1899, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=700&q=80', 20],
  [3, 'Mellow desk lamp', 'Home', 2450, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=80', 8],
  [4, 'Pocket noise-cancel buds', 'Tech', 3299, 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=700&q=80', 15]
];
const insertProduct = db.prepare('INSERT OR IGNORE INTO products (id,name,category,price,image,stock) VALUES (?,?,?,?,?,?)');
seedProducts.forEach((product) => insertProduct.run(...product));

const otpStore = new Map();
const requestLog = new Map();
const otpTtlMs = Number(process.env.OTP_TTL_MINUTES || 5) * 60 * 1000;
const phonePattern = /^[6-9]\d{9}$/;
const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').replace(/^91/, '');

function createToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone }, jwtSecret || 'development-only-secret', { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  try {
    if (!token) throw new Error('Missing token');
    req.user = jwt.verify(token, jwtSecret || 'development-only-secret');
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}
function admin(req, res, next) {
  if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Admin access required.' });
  next();
}
function rateLimit(phone) {
  const last = requestLog.get(phone) || 0;
  if (Date.now() - last < 60_000) return false;
  requestLog.set(phone, Date.now());
  return true;
}
async function sendOtp(phone, code) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) throw new Error('MSG91 is not configured');
  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: `91${phone}`, otp: code })
  });
  if (!response.ok) throw new Error('Could not send OTP');
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'shopnest-api' }));
app.get('/api/products', (req, res) => {
  const category = req.query.category;
  const products = category ? db.prepare('SELECT * FROM products WHERE active = 1 AND category = ? ORDER BY id').all(category) : db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id').all();
  res.json({ products: products.map((product) => ({ ...product, images: JSON.parse(product.images_json || '[]') })) });
});

app.post('/api/auth/request-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phonePattern.test(phone)) return res.status(400).json({ error: 'Enter a valid Indian mobile number.' });
  if (!rateLimit(phone)) return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
  const code = String(crypto.randomInt(1000, 10000));
  otpStore.set(phone, { code, expiresAt: Date.now() + otpTtlMs, attempts: 0 });
  try {
    await sendOtp(phone, code);
    res.json({ message: 'OTP sent successfully.', ...(isProduction ? {} : { demoOtp: code }) });
  } catch (error) {
    otpStore.delete(phone);
    res.status(502).json({ error: error.message });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const entry = otpStore.get(phone);
  if (!entry || Date.now() > entry.expiresAt) return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  entry.attempts += 1;
  if (entry.attempts > 5) { otpStore.delete(phone); return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' }); }
  if (String(req.body.otp) !== entry.code) return res.status(400).json({ error: 'Incorrect OTP.' });
  otpStore.delete(phone);
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  const user = existing || { id: db.prepare('INSERT INTO users (phone) VALUES (?)').run(phone).lastInsertRowid, phone };
  res.json({ token: createToken(user), user: { id: user.id, phone: user.phone } });
});

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null;
app.post('/api/orders/razorpay', auth, async (req, res) => {
  if (!razorpay) return res.status(503).json({ error: 'Payments are not configured yet.' });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const shipping = req.body.shipping;
  if (!items.length || !shipping?.address || !shipping?.pincode) return res.status(400).json({ error: 'Cart and delivery address are required.' });
  const ids = items.map((item) => Number(item.productId)).filter(Boolean);
  const products = db.prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND active = 1`).all(...ids);
  const productMap = new Map(products.map((product) => [product.id, product]));
  let amount = 0;
  const safeItems = [];
  for (const item of items) {
    const product = productMap.get(Number(item.productId));
    const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
    if (!product || product.stock < quantity) return res.status(400).json({ error: `Product ${item.productId} is unavailable.` });
    amount += product.price * quantity;
    safeItems.push({ productId: product.id, quantity, unitPrice: product.price });
  }
  const paymentOrder = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: `sn_${Date.now()}`, notes: { userId: String(req.user.sub) } });
  const order = db.prepare('INSERT INTO orders (user_id,amount,status,razorpay_order_id,shipping_json) VALUES (?,?,?,?,?)').run(req.user.sub, amount, 'payment_pending', paymentOrder.id, JSON.stringify(shipping));
  const addItem = db.prepare('INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)');
  safeItems.forEach((item) => addItem.run(order.lastInsertRowid, item.productId, item.quantity, item.unitPrice));
  res.json({ orderId: order.lastInsertRowid, razorpay: { id: paymentOrder.id, amount: paymentOrder.amount, currency: paymentOrder.currency, keyId: process.env.RAZORPAY_KEY_ID } });
});

app.post('/api/orders/verify-payment', auth, (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  const validSignature = typeof signature === 'string' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return res.status(400).json({ error: 'Payment verification failed.' });
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ? AND user_id = ?').get(orderId, req.user.sub);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  db.prepare('UPDATE orders SET status = ?, razorpay_payment_id = ? WHERE id = ?').run('paid', paymentId, order.id);
  res.json({ success: true, orderId: order.id, status: 'paid' });
});

app.get('/api/orders', auth, (req, res) => res.json({ orders: db.prepare('SELECT id,amount,status,created_at FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.sub) }));
app.post('/api/admin/products', admin, (req, res) => {
  const { id, name, category, price, image, images = [], stock } = req.body;
  if (!id || !name || !category || !price || !image) return res.status(400).json({ error: 'id, name, category, price and image are required.' });
  const safeImages = Array.isArray(images) ? images.filter((value) => typeof value === 'string' && value.length < 2_000_000).slice(0, 4) : [];
  db.prepare('INSERT INTO products (id,name,category,price,image,images_json,stock) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,image=excluded.image,images_json=excluded.images_json,stock=excluded.stock').run(id, name, category, price, image, JSON.stringify(safeImages.length ? safeImages : [image]), stock || 0);
  res.status(201).json({ success: true });
});
app.delete('/api/admin/products/:id', admin, (req, res) => {
  const result = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ success: result.changes > 0 });
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.listen(port, () => console.log(`Shopnest API listening on http://localhost:${port}`));
