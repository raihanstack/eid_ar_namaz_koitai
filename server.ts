import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env (Checked VITE_SUPABASE_URL and SUPABASE_URL)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

app.use(express.json());

// API Routes
app.get('/api/mosques', async (req, res) => {
  try {
    const { data: mosques, error } = await supabase
      .from('mosques')
      .select(`
        *,
        namaz_times ( namaz_time ),
        votes ( is_true ),
        reports ( id )
      `)
      .eq('status', 'approved');

    if (error) throw error;

    const formattedMosques = mosques.map((m: any) => {
      const true_votes = m.votes?.filter((v: any) => v.is_true === 1).length || 0;
      const false_votes = m.votes?.filter((v: any) => v.is_true === 0).length || 0;
      const namaz_times = m.namaz_times?.map((nt: any) => nt.namaz_time) || [];
      const report_count = m.reports?.length || 0;

      return {
        ...m,
        namaz_times,
        true_votes,
        false_votes,
        report_count,
        votes: undefined,
        reports: undefined
      };
    });

    res.json(formattedMosques);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mosques', async (req, res) => {
  const { name_en, name_bn, lat, lng, eid_date, namaz_times } = req.body;

  if (!name_en || !lat || !lng || !eid_date || !Array.isArray(namaz_times) || namaz_times.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data: mosque, error: mosqueError } = await supabase
      .from('mosques')
      .insert([{ name_en, name_bn, lat, lng, eid_date, status: 'approved' }])
      .select()
      .single();

    if (mosqueError) throw mosqueError;

    const timesToInsert = namaz_times.map(time => ({
      mosque_id: mosque.id,
      namaz_time: time
    }));

    const { error: timesError } = await supabase
      .from('namaz_times')
      .insert(timesToInsert);

    if (timesError) throw timesError;

    const newMosque = {
      ...mosque,
      namaz_times,
      true_votes: 0,
      false_votes: 0
    };

    io.emit('mosque_added', newMosque);
    res.json(newMosque);
  } catch (err: any) {
    console.error('Error inserting mosque:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/votes', async (req, res) => {
  const { mosque_id, is_true, voter_id } = req.body;
  if (!mosque_id || !voter_id) return res.status(400).json({ error: 'Missing mosque_id or voter_id' });

  try {
    const { error } = await supabase
      .from('votes')
      .insert([{ voter_id, mosque_id, is_true: is_true ? 1 : 0 }]);

    if (error) throw error;

    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('is_true')
      .eq('mosque_id', mosque_id);

    if (votesError) throw votesError;

    const true_votes = votes.filter(v => v.is_true === 1).length;
    const false_votes = votes.filter(v => v.is_true === 0).length;

    io.emit('vote_updated', { mosque_id, true_votes, false_votes });
    res.json({ true_votes, false_votes });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reports', async (req, res) => {
  const { mosque_id, reporter_id, reason } = req.body;
  if (!mosque_id || !reporter_id) return res.status(400).json({ error: 'Missing data' });

  try {
    const { error } = await supabase
      .from('reports')
      .insert([{ mosque_id, reporter_id, reason: reason || 'Reported' }]);

    if (error) throw error;

    const { count, error: countError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('mosque_id', mosque_id);

    if (countError) throw countError;

    if (count && count >= 3) {
      const { error: delError } = await supabase
        .from('mosques')
        .delete()
        .eq('id', mosque_id);

      if (delError) throw delError;

      io.emit('mosque_removed', { id: parseInt(mosque_id) });
      res.json({ success: true, deleted: true });
    } else {
      res.json({ success: true, deleted: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.delete('/api/mosques/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('mosques').delete().eq('id', id);
    if (error) throw error;
    io.emit('mosque_removed', { id: parseInt(id) });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/namaz-times/:id', async (req, res) => {
  const { id } = req.params;
  const { namaz_time } = req.body;
  if (!namaz_time) return res.status(400).json({ error: 'Missing time' });

  try {
    const { error: insertError } = await supabase
      .from('namaz_times')
      .insert([{ mosque_id: id, namaz_time }]);

    if (insertError) throw insertError;

    const { data: times, error: timesError } = await supabase
      .from('namaz_times')
      .select('namaz_time')
      .eq('mosque_id', id)
      .order('id', { ascending: true });

    if (timesError) throw timesError;

    io.emit('mosque_updated', {
      id: parseInt(id),
      namaz_times: times.map((t: any) => t.namaz_time)
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/namaz-times/:mosqueId/:index', async (req, res) => {
  const { mosqueId, index } = req.params;
  try {
    const { data: times, error: listError } = await supabase
      .from('namaz_times')
      .select('id, namaz_time')
      .eq('mosque_id', mosqueId)
      .order('id', { ascending: true });

    if (listError) throw listError;

    const timeToDelete = times[parseInt(index)];

    if (timeToDelete) {
      const { error: delError } = await supabase
        .from('namaz_times')
        .delete()
        .eq('id', timeToDelete.id);

      if (delError) throw delError;

      const { data: updatedTimes, error: fetchError } = await supabase
        .from('namaz_times')
        .select('namaz_time')
        .eq('mosque_id', mosqueId)
        .order('id', { ascending: true });

      if (fetchError) throw fetchError;

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
