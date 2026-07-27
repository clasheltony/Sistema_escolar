const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.sqlite');
const hash = bcrypt.hashSync('LET013509ici@', 10);
db.run("UPDATE Teachers SET password = ? WHERE email = ?", [hash, 'tonyferreira13@gmail.com'], function(err) {
  if (err) return console.error(err);
  console.log(this.changes > 0 ? 'Senha alterada com sucesso' : 'Usuário não encontrado');
  db.close();
});
