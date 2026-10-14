// Envio de e-mails do sistema (confirmacao de cadastro e redefinicao de senha).
//
// Usa SMTP generico via nodemailer (ex.: Gmail com senha de app).
// Se as variaveis SMTP_* nao estiverem configuradas, entra em "modo dev":
// em vez de enviar, imprime o e-mail no console (util para testar localmente
// sem configurar provedor).
const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM } = process.env;

const port = Number(SMTP_PORT) || 465;
const configured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (configured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
} else {
  console.warn('[mailer] SMTP nao configurado (defina SMTP_HOST/SMTP_USER/SMTP_PASS).');
  console.warn('[mailer] Os e-mails serao apenas exibidos no console (modo dev).');
}

async function sendMail({ to, subject, text, html }) {
  if (!configured) {
    console.log('\n=============== [mailer:dev] E-mail NAO enviado ===============');
    console.log('Para   :', to);
    console.log('Assunto:', subject);
    console.log('----------------------------------------------------------------');
    console.log(text || '(sem versao em texto)');
    console.log('================================================================\n');
    return { dev: true };
  }
  return transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendMail, isConfigured: () => configured };
