// Disponibiliza mensagens "flash" (exibidas uma unica vez) para as views,
// acessiveis em `flash` dentro dos templates EJS.
//
// Uso no controller:  req.session.flash = { type: 'success'|'danger', text: '...' }
// Uso na view:        <% if (flash) { %><div class="alert alert-<%= flash.type %>"><%= flash.text %></div><% } %>
module.exports = (req, res, next) => {
  res.locals.flash = (req.session && req.session.flash) || null;
  if (req.session) req.session.flash = null;
  next();
};
