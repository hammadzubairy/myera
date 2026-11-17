import express from 'express';
import cors from 'cors';
import { env } from './env';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import doseRoutes from './routes/doses';
import weightRoutes from './routes/weights';
import measurementRoutes from './routes/measurements';
import pushRoutes from './routes/push';
import uploadRoutes from './routes/uploads';
import photoRoutes from './routes/photos';
import foodRoutes from './routes/food';
import communityRoutes from './routes/community';
import shotScheduleRoutes from './routes/shotSchedule';
import injectionScheduleRoutes from './routes/injectionSchedules';
import announcementRoutes from './routes/announcements';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';
import { runReminderTick } from './jobs/reminders';

const app = express();
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin }));
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'myera-api' });
});

/** Vercel Cron (and manual) — no setInterval on serverless. */
app.get('/admin/cron/reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  try {
    await runReminderTick();
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[cron/reminders]', e);
    res.status(500).json({ error: e?.message || 'Cron failed' });
  }
});

app.use('/auth', authRoutes);
app.use('/me', profileRoutes);
app.use('/doses', doseRoutes);
app.use('/weights', weightRoutes);
app.use('/measurements', measurementRoutes);
app.use('/push', pushRoutes);
app.use('/uploads', uploadRoutes);
app.use('/photos', photoRoutes);
app.use('/food', foodRoutes);
app.use('/community', communityRoutes);
app.use('/shot-schedule', shotScheduleRoutes);
app.use('/injection-schedules', injectionScheduleRoutes);
app.use('/announcements', announcementRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

export default app;
