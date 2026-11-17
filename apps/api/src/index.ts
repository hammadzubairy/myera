import app from './app';
import { env } from './env';
import { startReminderScheduler } from './jobs/reminders';

app.listen(env.port, '0.0.0.0', () => {
  console.log(`MyEra API listening on http://0.0.0.0:${env.port}`);
  startReminderScheduler(60_000);
});
