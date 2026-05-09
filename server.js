import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8080);

const mailTo = process.env.MAIL_TO || 'post@kvasetech.com';
const mailFrom = process.env.MAIL_FROM || mailTo;

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false
});

function clean(value) {
  return String(value || '').trim();
}

function createTransport() {
  const host = process.env.SMTP_HOST || '192.168.222.12';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 25),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
    tls: {
      servername: process.env.SMTP_SERVERNAME || 'email.kvasetech.com'
    },
    auth: user || pass ? { user, pass } : undefined
  });
}

app.post('/api/contact', contactLimiter, async (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email);
  const message = clean(req.body.message);
  const company = clean(req.body.company);

  if (company) {
    return res.json({ ok: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Fyll ut navn, e-post og melding.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Skriv inn en gyldig e-postadresse.' });
  }

  if (message.length > 4000) {
    return res.status(400).json({ ok: false, error: 'Meldingen er for lang.' });
  }

  const text = [
    'Ny henvendelse fra kvasetech.com',
    '',
    `Navn: ${name}`,
    `E-post: ${email}`,
    '',
    'Melding:',
    message
  ].join('\n');

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: email,
      subject: `Henvendelse fra ${name}`,
      text
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Contact form failed:', error);
    res.status(500).json({ ok: false, error: 'Kunne ikke sende meldingen akkurat nå.' });
  }
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Kvasetech website listening on ${port}`);
});
