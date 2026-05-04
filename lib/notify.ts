import { Resend } from 'resend';
import type { League } from './types';

const FROM = 'Statpad Score <onboarding@resend.dev>';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function notifyNewLeague(league: League, ip: string): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  const resend = getResend();
  if (!resend || !to) return;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New league: ${league.name}`,
      text: [
        `A new league was just created on Statpad Score.`,
        ``,
        `Name: ${league.name}`,
        `ID:   ${league.id}`,
        `URL:  https://statpadscore.vercel.app/${league.id}`,
        `IP:   ${ip}`,
        `When: ${league.createdAt}`,
      ].join('\n'),
    });
  } catch (err) {
    // Never block league creation on email failures.
    console.error('notifyNewLeague failed:', err);
  }
}
