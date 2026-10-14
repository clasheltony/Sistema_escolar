// Envio de e-mails do sistema (confirmacao de cadastro e redefinicao de senha).
//
// O Render (plano gratis) BLOQUEIA portas de SMTP (25/465/587) — por isso o
// envio por SMTP nao funciona em producao. Este modulo suporta envio por API
// HTTPS (porta 443, nao bloqueada), que e o recomendado em producao:
//
//   1. BREVO_API_KEY     -> API do Brevo (https://brevo.com)      [recomendado]
//   2. SENDGRID_API_KEY  -> API do SendGrid (https://sendgrid.com)
//   3. SMTP_*            -> SMTP generico (funciona local; bloqueado no Render gratis)
//   4. nenhum            -> modo "dev": imprime o e-mail/link no console
//
// Todos os envios usam um timeout curto para nunca ficar "pendurado".
const nodemailer = require('nodemailer');

const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE,
  MAIL_FROM, BREVO_API_KEY, SENDGRID_API_KEY
} = process.env;

const fromRaw = (MAIL_FROM || SMTP_USER || '').trim();

function parseFrom(raw) {
  const m = String(raw).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim() || m[2].trim(), email: m[2].trim() };
  return { name: String(raw).trim(), email: String(raw).trim() };
}
const from = parseFrom(fromRaw);
const senderValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from.email || '');

const port = Number(SMTP_PORT) || 465;
const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (!BREVO_API_KEY && !SENDGRID_API_KEY && smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

function mode() {
  if (BREVO_API_KEY) return 'brevo';
  if (SENDGRID_API_KEY) return 'sendgrid';
  if (smtpConfigured) return 'smtp';
  return 'dev';
}

function describeMode() {
  switch (mode()) {
    case 'brevo': return 'Brevo API (HTTPS)';
    case 'sendgrid': return 'SendGrid API (HTTPS)';
    case 'smtp': return `SMTP ${SMTP_HOST}:${port} (nao funciona no Render gratuito)`;
    default: return 'dev (e-mails apenas no console)';
  }
}

const CURRENT_MODE = mode();
if (CURRENT_MODE === 'dev') {
  console.warn('[mailer] Nenhum provedor configurado (BREVO_API_KEY/SENDGRID_API_KEY/SMTP_*).');
  console.warn('[mailer] Os e-mails serao apenas exibidos no console (modo dev).');
} else {
  console.log(`[mailer] Envio de e-mail ativo: ${describeMode()}`);
  if (!senderValid) {
    console.error('[mailer] ATENCAO: remetente (MAIL_FROM) ausente ou invalido.');
    console.error('[mailer] Defina no Render: MAIL_FROM="Sistema Escolar <seuemail-verificado@gmail.com>"');
  } else {
    console.log(`[mailer] Remetente configurado: "${from.name}" <${from.email}>`);
  }
}

// Erro amigavel (e no log) se tentar enviar sem remetente valido.
function assertSender() {
  if ((CURRENT_MODE === 'brevo' || CURRENT_MODE === 'sendgrid') && !senderValid) {
    throw new Error('Remetente (MAIL_FROM) ausente ou invalido. Defina MAIL_FROM com um e-mail verificado no provedor.');
  }
}

async function fetchWithTimeout(url, options, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaBrevo({ to, subject, text, html }) {
  const res = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: to }],
      subject,
      htmlContent: html || `<pre>${text || ''}</pre>`,
      textContent: text || ''
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

async function sendViaSendgrid({ to, subject, text, html }) {
  const res = await fetchWithTimeout('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from.email, name: from.name },
      subject,
      content: [
        { type: 'text/plain', value: text || '' },
        { type: 'text/html', value: html || `<pre>${text || ''}</pre>` }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SendGrid API ${res.status}: ${body}`);
  }
  return { ok: true };
}

async function sendMail({ to, subject, text, html }) {
  assertSender();
  switch (mode()) {
    case 'brevo':
      return sendViaBrevo({ to, subject, text, html });
    case 'sendgrid':
      return sendViaSendgrid({ to, subject, text, html });
    case 'smtp':
      return transporter.sendMail({ from: fromRaw || SMTP_USER, to, subject, text, html });
    default:
      console.log('\n=============== [mailer:dev] E-mail NAO enviado ===============');
      console.log('Para   :', to);
      console.log('Assunto:', subject);
      console.log('----------------------------------------------------------------');
      console.log(text || '(sem versao em texto)');
      console.log('================================================================\n');
      return { dev: true };
  }
}

module.exports = { sendMail, mode, describeMode };
