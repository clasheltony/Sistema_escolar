const crypto = require('crypto');

// Gera um token aleatorio que e enviado ao usuario por e-mail.
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// No banco guardamos apenas o hash (sha256) do token, nunca o valor puro.
// Assim, mesmo com acesso ao banco, ninguem consegue reutilizar os links.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { generateToken, hashToken };
