const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'qq',
  auth: { user: '481237959@qq.com', pass: 'mxtnxxpejiykcaje' }
});
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const SCHOOL_DOMAIN = '@bistu.edu.cn';
const DB_FILE = path.join(__dirname, 'data.json');

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (!db.pendingUsers) db.pendingUsers = {};
      if (!db.users) db.users = {};
      if (!db.items) db.items = [];
      if (!db.messages) db.messages = [];
      if (!db.nextItemId) db.nextItemId = 1;
      return db;
    }
  } catch (e) {}
  return { users: {}, items: [], messages: [], pendingUsers: {}, nextItemId: 1 };
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'u_' + Math.abs(hash).toString(36);
}

function generateDefaultNickname(department, grade, role) {
  const shortDept = department.replace('学院', '').replace('与', '').substring(0, 4);
  const animals = ['小树', '小星', '小鹿', '小海', '小阳', '小云', '小风', '小月', '小辰', '小禾'];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  if (role === 'teacher') return shortDept + '·教师·' + animal;
  return shortDept + '·' + grade + '级·' + animal;
}

app.post('/api/register', (req, res) => {
  const { studentId, password, realName, displayName, department, grade, role, email } = req.body;

  if (!studentId || studentId.length < 4) return res.json({ ok: false, msg: '请输入有效的学号/工号' });
  if (!password || password.length < 6) return res.json({ ok: false, msg: '密码至少6位' });
  if (!realName) return res.json({ ok: false, msg: '请输入真实姓名' });
  if (!email) return res.json({ ok: false, msg: '请输入学校邮箱' });
  if (!email.endsWith(SCHOOL_DOMAIN)) return res.json({ ok: false, msg: '请使用学校邮箱（' + SCHOOL_DOMAIN + '）' });
  if (!department) return res.json({ ok: false, msg: '请选择院系' });
  if (!grade) return res.json({ ok: false, msg: '请选择入学年份' });

  const db = readDB();
  const hashedId = simpleHash(studentId);
  if (db.users[hashedId]) return res.json({ ok: false, msg: '该学号已注册，请直接登录' });
  if (db.pendingUsers[hashedId]) return res.json({ ok: false, msg: '该学号已有待验证的注册，请检查邮箱' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const finalDisplayName = displayName || generateDefaultNickname(department, grade, role);

  db.pendingUsers[hashedId] = {
    id: hashedId, real_name: realName, password: sha256(password),
    department, grade, role, email, display_name: finalDisplayName, code, created_at: Date.now()
  };
  writeDB(db);

    transporter.sendMail({
    from: '北信科咸鱼 <481237959@qq.com>',
    to: email,
    subject: '北信科咸鱼 - 邮箱验证码',
    text: '你的验证码是：' + code + '，有效期10分钟。'
  }, (err) => {
    if (err) console.log('邮件发送失败:', err);
    else console.log('验证码已发送至 ' + email);
  });
  res.json({ ok: true, msg: '验证码已发送至 ' + email + '，请查看邮箱输入验证码', needVerify: true });
});

app.post('/api/verify-email', (req, res) => {
  const { studentId, code } = req.body;
  if (!studentId || !code) return res.json({ ok: false, msg: '验证码不能为空' });

  const db = readDB();
  const hashedId = simpleHash(studentId);
  const pending = db.pendingUsers[hashedId];

  if (!pending) return res.json({ ok: false, msg: '未找到待验证的注册信息，请重新注册' });
  if (pending.code !== code) return res.json({ ok: false, msg: '验证码错误' });

  db.users[hashedId] = {
    id: pending.id, real_name: pending.real_name, password: pending.password,
    department: pending.department, grade: pending.grade, role: pending.role,
    email: pending.email, display_name: pending.display_name, created_at: pending.created_at
  };
  delete db.pendingUsers[hashedId];
  writeDB(db);

  const user = { studentId: hashedId, department: pending.department, grade: pending.grade, role: pending.role, displayName: pending.display_name, createdAt: pending.created_at };
  res.json({ ok: true, msg: '✅ 验证通过！注册成功', user });
});

app.post('/api/login', (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || studentId.length < 4) return res.json({ ok: false, msg: '请输入有效的学号/工号' });
  if (!password) return res.json({ ok: false, msg: '请输入密码' });

  const db = readDB();
  const hashedId = simpleHash(studentId);
  const user = db.users[hashedId];

  if (!user) return res.json({ ok: false, msg: '账号不存在，请先注册' });
  if (user.password !== sha256(password)) return res.json({ ok: false, msg: '密码错误' });

  const sessionUser = {
    studentId: user.id, department: user.department, grade: user.grade,
    role: user.role, displayName: user.display_name, createdAt: user.created_at
  };
  res.json({ ok: true, msg: '✅ 登录成功！欢迎回来', user: sessionUser });
});

app.post('/api/user/nickname', (req, res) => {
  const { studentId, displayName } = req.body;
  if (!displayName || displayName.length > 12) return res.json({ ok: false, msg: '昵称不合法' });

  const db = readDB();
  if (db.users[studentId]) db.users[studentId].display_name = displayName;
  db.items.forEach(item => { if (item.user_id === studentId) item.display_name = displayName; });
  writeDB(db);
  res.json({ ok: true, msg: '✅ 昵称已更新' });
});
app.get('/api/items', (req, res) => {
  const { category, search } = req.query;
  const db = readDB();
  let items = db.items.filter(i => i.status === 'active');

  if (category && category !== 'all') items = items.filter(i => i.type === category);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(s) || (i.course && i.course.toLowerCase().includes(s)) ||
      i.description.toLowerCase().includes(s) || i.department.toLowerCase().includes(s)
    );
  }
  items.sort((a, b) => b.created_at - a.created_at);
  res.json({ ok: true, items });
});

app.post('/api/items', (req, res) => {
    const { studentId, type, course, title, description, originalPrice, price, condition, emoji, image, department, grade, role, displayName } = req.body;

  if (!title) return res.json({ ok: false, msg: '请输入标题' });
  if (!price || price <= 0) return res.json({ ok: false, msg: '请输入有效的转让价格' });

  const db = readDB();
  const newItem = {
    id: db.nextItemId++, type, title, course: course || '', description: description || '',
    original_price: originalPrice || 0, price, condition: condition || '八成新',     emoji: emoji || '📦', image: image || '',
    department, grade, role, user_id: studentId, display_name: displayName,
    status: 'active', created_at: Date.now()
  };
  db.items.unshift(newItem);
  writeDB(db);
  res.json({ ok: true, msg: '✅ 发布成功！', item: { id: newItem.id } });
});

app.post('/api/items/:id/sold', (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;

  const db = readDB();
  const item = db.items.find(i => i.id === parseInt(id));
  if (!item) return res.json({ ok: false, msg: '物品不存在' });
  if (item.user_id !== studentId) return res.json({ ok: false, msg: '无权操作' });

  item.status = 'sold';
  writeDB(db);
  res.json({ ok: true, msg: '已标记为售出' });
});
// 编辑物品
app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { studentId, title, description, price, originalPrice, condition, emoji, image, course, type } = req.body;

  const db = readDB();
  const item = db.items.find(i => i.id === parseInt(id));
  if (!item) return res.json({ ok: false, msg: '物品不存在' });
  if (item.user_id !== studentId) return res.json({ ok: false, msg: '无权操作' });

  if (title) item.title = title;
  if (description !== undefined) item.description = description;
  if (price) item.price = price;
  if (originalPrice !== undefined) item.original_price = originalPrice;
  if (condition) item.condition = condition;
  if (emoji) item.emoji = emoji;
  if (image !== undefined) item.image = image;
  if (course !== undefined) item.course = course;
  if (type) item.type = type;

  writeDB(db);
  res.json({ ok: true, msg: '已更新' });
});

// 删除物品
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;

  const db = readDB();
  const idx = db.items.findIndex(i => i.id === parseInt(id));
  if (idx === -1) return res.json({ ok: false, msg: '物品不存在' });
  if (db.items[idx].user_id !== studentId) return res.json({ ok: false, msg: '无权操作' });

  db.items.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true, msg: '已删除' });
});
app.get('/api/my-items', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.json({ ok: false, msg: '未登录' });

  const db = readDB();
  const items = db.items.filter(i => i.user_id === studentId).sort((a, b) => b.created_at - a.created_at);
  res.json({ ok: true, items });
});
// 标记消息已读
app.post('/api/messages/read', (req, res) => {
  const { studentId, withUser, itemId } = req.body;
  if (!studentId || !withUser || !itemId) return res.json({ ok: false, msg: '参数不全' });

  const db = readDB();
  db.messages.forEach(m => {
    if (m.to_user === studentId && m.from_user === withUser && m.item_id === itemId) {
      m.is_read = true;
    }
  });
  writeDB(db);
  res.json({ ok: true });
});
app.post('/api/messages', (req, res) => {
  const { fromUser, fromName, toUser, itemId, content } = req.body;
   

  const db = readDB();
    db.messages.push({ id: db.messages.length + 1, from_user: fromUser, from_name: fromName, to_user: toUser, item_id: itemId, content, created_at: Date.now(), is_read: false });
  writeDB(db);
  res.json({ ok: true, msg: '消息已发送' });
});

app.get('/api/messages', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.json({ ok: false, msg: '未登录' });

  const db = readDB();
  const messages = db.messages.filter(m => m.to_user === studentId).sort((a, b) => b.created_at - a.created_at).map(m => {
    const item = db.items.find(i => i.id === m.item_id);
    return { ...m, item_title: item ? item.title : '' };
  });
  res.json({ ok: true, messages });
});

app.get('/api/messages/unread', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.json({ ok: false, count: 0 });
  const db = readDB();
  const count = db.messages.filter(m => m.to_user === studentId).length;
  res.json({ ok: true, count });
});
app.get('/api/conversations', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.json({ ok: false, msg: '未登录' });

  const db = readDB();
  const allMsgs = db.messages.filter(m => m.from_user === studentId || m.to_user === studentId);
  const convMap = {};
  allMsgs.forEach(m => {
    const other = m.from_user === studentId ? m.to_user : m.from_user;
    const key = other + '_' + m.item_id;
        if (!convMap[key] || m.created_at > convMap[key].lastTime) {
      const item = db.items.find(i => i.id === m.item_id);
      convMap[key] = {
        with: other,
        withName: m.from_user === studentId ? m.from_name : (db.users[other] ? db.users[other].display_name : '未知用户'),
        itemId: m.item_id,
        itemTitle: item ? item.title : '已删除',
        lastMsg: m.content,
        lastTime: m.created_at,
               unread: m.to_user === studentId && m.from_user === other && !m.is_read ? 1 : 0
      };
    } else if (m.to_user === studentId && m.from_user === other && !m.is_read) {
      convMap[key].unread = (convMap[key].unread || 0) + 1;
    }
  });
  const list = Object.values(convMap).sort((a, b) => b.lastTime - a.lastTime);
  res.json({ ok: true, conversations: list });
});

app.get('/api/conversation', (req, res) => {
  const { studentId, with: withUser, itemId } = req.query;
  if (!studentId || !withUser || !itemId) return res.json({ ok: false, msg: '参数不完整' });

  const db = readDB();
  const msgs = db.messages.filter(m =>
    m.item_id === parseInt(itemId) &&
    ((m.from_user === studentId && m.to_user === withUser) || (m.from_user === withUser && m.to_user === studentId))
  ).sort((a, b) => a.created_at - b.created_at);
  res.json({ ok: true, messages: msgs });
});
app.post('/api/user/delete', (req, res) => {
  const { studentId, password } = req.body;
  if (!studentId || !password) return res.json({ ok: false, msg: '参数不完整' });

  const db = readDB();
  const user = db.users[studentId];
  if (!user) return res.json({ ok: false, msg: '账号不存在' });
  if (user.password !== sha256(password)) return res.json({ ok: false, msg: '密码错误' });

  delete db.users[studentId];
  db.items = db.items.filter(i => i.user_id !== studentId);
  db.messages = db.messages.filter(m => m.from_user !== studentId && m.to_user !== studentId);
  writeDB(db);
  res.json({ ok: true, msg: '账号已注销' });
});
app.listen(PORT, () => {
  console.log(`🚀 北信科咸鱼服务器已启动: http://localhost:${PORT}`);
  console.log(`📄 前端页面: http://localhost:${PORT}/ 北信科咸鱼.html`);
});