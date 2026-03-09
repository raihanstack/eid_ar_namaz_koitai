import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('mosque_locator.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS mosques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT,
    name_bn TEXT,
    lat REAL,
    lng REAL,
    eid_date TEXT,
    status TEXT DEFAULT 'approved', -- Immediate approval for public access
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS namaz_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mosque_id INTEGER,
    namaz_time TEXT,
    FOREIGN KEY(mosque_id) REFERENCES mosques(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id TEXT, -- Client-side generated unique ID
    mosque_id INTEGER,
    is_true INTEGER, -- 1 for True, 0 for False
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(mosque_id) REFERENCES mosques(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mosque_id INTEGER,
    reporter_id TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(mosque_id) REFERENCES mosques(id) ON DELETE CASCADE
  );
`);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

app.use(express.json());

// API Routes
app.get('/api/mosques', (req, res) => {
  const mosques = db.prepare(`
    SELECT m.*, 
           (SELECT COUNT(*) FROM votes WHERE mosque_id = m.id AND is_true = 1) as true_votes,
           (SELECT COUNT(*) FROM votes WHERE mosque_id = m.id AND is_true = 0) as false_votes,
           (SELECT COUNT(*) FROM reports WHERE mosque_id = m.id) as report_count
    FROM mosques m
    WHERE m.status = 'approved'
  `).all();

  const mosquesWithTimes = mosques.map((m: any) => {
    const times = db.prepare('SELECT namaz_time FROM namaz_times WHERE mosque_id = ?').all(m.id);
    return { ...m, namaz_times: times.map((t: any) => t.namaz_time) };
  });

  res.json(mosquesWithTimes);
});

app.post('/api/mosques', (req, res) => {
  const { name_en, name_bn, lat, lng, eid_date, namaz_times } = req.body;
  
  // Basic validation
  if (!name_en || !lat || !lng || !eid_date || !Array.isArray(namaz_times) || namaz_times.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const insertMosque = db.prepare(`
    INSERT INTO mosques (name_en, name_bn, lat, lng, eid_date, status)
    VALUES (?, ?, ?, ?, ?, 'approved')
  `);

  const insertTime = db.prepare(`
    INSERT INTO namaz_times (mosque_id, namaz_time)
    VALUES (?, ?)
  `);

  const transaction = db.transaction((mosqueData, times) => {
    const result = insertMosque.run(mosqueData.name_en, mosqueData.name_bn, mosqueData.lat, mosqueData.lng, mosqueData.eid_date);
    const mosqueId = result.lastInsertRowid;
    for (const time of times) {
      insertTime.run(mosqueId, time);
    }
    return mosqueId;
  });

  try {
    const mosqueId = transaction({ name_en, name_bn, lat, lng, eid_date }, namaz_times);
    
    const newMosque = { 
      id: mosqueId, 
      name_en, name_bn, lat, lng, eid_date,
      namaz_times,
      status: 'approved',
      true_votes: 0,
      false_votes: 0
    };
    
    io.emit('mosque_added', newMosque);
    res.json(newMosque);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/votes', (req, res) => {
  const { mosque_id, is_true, voter_id } = req.body;
  
  if (!mosque_id || !voter_id) {
    return res.status(400).json({ error: 'Missing mosque_id or voter_id' });
  }

  try {
    db.prepare('INSERT INTO votes (voter_id, mosque_id, is_true) VALUES (?, ?, ?)').run(voter_id, mosque_id, is_true ? 1 : 0);
    
    const counts: any = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM votes WHERE mosque_id = ? AND is_true = 1) as true_votes,
        (SELECT COUNT(*) FROM votes WHERE mosque_id = ? AND is_true = 0) as false_votes
    `).get(mosque_id, mosque_id);
    
    io.emit('vote_updated', { mosque_id, ...counts });
    res.json(counts);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reports', (req, res) => {
  const { mosque_id, reporter_id, reason } = req.body;
  if (!mosque_id || !reporter_id) return res.status(400).json({ error: 'Missing data' });

  try {
    db.prepare('INSERT INTO reports (mosque_id, reporter_id, reason) VALUES (?, ?, ?)').run(mosque_id, reporter_id, reason || 'Reported');
    
    // Check if mosque should be auto-deleted (e.g., 3 or more reports)
    const reportCount: any = db.prepare('SELECT COUNT(*) as count FROM reports WHERE mosque_id = ?').get(mosque_id);
    
    if (reportCount.count >= 3) {
      db.prepare('DELETE FROM mosques WHERE id = ?').run(mosque_id);
      io.emit('mosque_removed', { id: parseInt(mosque_id) });
      res.json({ success: true, deleted: true });
    } else {
      res.json({ success: true, deleted: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Actions (Simple password check for demo/prototype)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.delete('/api/mosques/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM mosques WHERE id = ?').run(id);
    io.emit('mosque_removed', { id: parseInt(id) });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/namaz-times/:id', (req, res) => {
  const { id } = req.params;
  const { namaz_time } = req.body;
  if (!namaz_time) return res.status(400).json({ error: 'Missing time' });

  try {
    db.prepare('INSERT INTO namaz_times (mosque_id, namaz_time) VALUES (?, ?)').run(id, namaz_time);
    const updatedTimes = db.prepare('SELECT namaz_time FROM namaz_times WHERE mosque_id = ?').all(id);
    io.emit('mosque_updated', { 
      id: parseInt(id), 
      namaz_times: updatedTimes.map((t: any) => t.namaz_time) 
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/namaz-times/:mosqueId/:index', (req, res) => {
  const { mosqueId, index } = req.params;
  try {
    // Get all times for this mosque
    const times = db.prepare('SELECT id FROM namaz_times WHERE mosque_id = ? ORDER BY id ASC').all(mosqueId);
    const timeToDelete = times[parseInt(index)];
    
    if (timeToDelete) {
      db.prepare('DELETE FROM namaz_times WHERE id = ?').run(timeToDelete.id);
      
      // Fetch updated mosque data to broadcast
      const updatedTimes = db.prepare('SELECT namaz_time FROM namaz_times WHERE mosque_id = ?').all(mosqueId);
      io.emit('mosque_updated', { 
        id: parseInt(mosqueId), 
        namaz_times: updatedTimes.map((t: any) => t.namaz_time) 
      });
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Time not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite Integration
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
