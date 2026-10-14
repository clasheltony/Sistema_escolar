# Sistema Escolar — Análise e Plano de Segurança

_Data: 06/10/2026 · Repo: github.com/clasheltony/Sistema_escolar (público)_

> **Atualização 14/10/2026:** o modo **offline-first** e todo o serviço de
> sincronização foram **removidos** — `services/syncService.js`,
> `controllers/SyncController.js`, `routes/sync.js`, o model `models/SyncQueue.js`,
> os hooks de fila em `models/index.js` e o indicador Online/Offline das views.
> O sistema agora usa **exclusivamente** o Supabase via `DATABASE_URL`
> (o app não inicia sem ela). Com isso, o risco do §5 (divergência
> singular/plural no sync) **deixa de existir**, pois o `pullChanges` não é
> mais executado.
>
> **Conexão validada:** é obrigatório usar o **pooler (porta 6543)** —
> `aws-<n>-<região>.pooler.supabase.com`, usuário `postgres.<ref>`. A conexão
> **direta** (`db.<ref>.supabase.co:5432`) só tem registro IPv6 e **falha** no
> Render/redes IPv4. Verificado: o banco respondeu com 6 professores, 18 classes,
> 359 alunos, 7.964 chamadas e 2.996 notas; **0 turmas sem `teacherId`** (logo o
> escopo de dono da Fase 4 não esconde dados).

---

## 1. Contexto

Stack: Express + EJS + Sequelize (SQLite local / Postgres Supabase opcional),
sessão com express-session, bcrypt. ~3.780 LOC de app + 2.144 LOC órfãos em
`scripts/` (13) e `scratch/` (23). Sem testes, lint, CI e sem middleware de erro.

---

## 2. Achados críticos (auditoria)

| # | Local | Problema |
|---|---|---|
| C1 | `.env.example:2` | Credencial real do Supabase em repositório público |
| C2 | `database.sqlite.backup.*` | 7 MB de backups versionados (`.gitignore` só tinha `*.sqlite`); contém hashes bcrypt e dados de alunos |
| C3 | `syncService.js:118-123` | Em falha do `sync({alter})` executava `sync({force:true})` |
| C4 | `AuthController.js:48,66` + `routes/index.js:19` | Auto-registro público aceitava `role=secretaria` (escalada de privilégio) |
| C5 | `routes/index.js:12-17` | Não existia `requireRole` em lugar nenhum |
| C6 | `ClassController.js:58-64`, `StudentController`, `ActivityController`, `ReportController:74-97` | IDOR: queries sem filtro `teacherId` |

### Outros achados (não tratados nesta rodada)

- **XSS armazenado**: `<%- JSON.stringify(...) %>` em `<script>`
  (`report.ejs:169`, `activities.ejs:542`); interpolações em atributos
  `onclick` (`dashboard.ejs:32`, `activities.ejs:443`)
- **Sem CSRF**, cookie de sessão sem `secure`/`sameSite`/`maxAge`,
  secret fallback `'escola_secreta'` (`app.js:17`), sem `regenerate()` no login
- **N+1** em `ReportController.js:135-147` (~160 queries p/ 40 alunos)
- **Loops `await` sequenciais** em `ActivityController.js:84-103,173-202`
- **Sem transação** em `ActivityController.js:77-103,165-202`
- **Esquema declarado 3 vezes** (models, `getPgModels()`, DDL raw no boot)
- **Migrações** via `ALTER TABLE` em `try/catch` (`app.js:26-42`)
- **Sem constraints unique** (`Bimester`, `Attendance`, `Turma.name`)
- **Hooks de bulk não registrados**: `destroy`/`update` em massa não
  enfileiram DELETE/UPDATE (`models/index.js:73-85` só cobre `afterDestroy`)
- **Views**: `activities.ejs` 539 linhas; `layout.ejs` órfão;
  `/css/style.css` referenciado mas inexistente (`header.ejs:9` -> 404)
- **Higiene**: `scratch/` e `scripts/` órfãos; senhas em texto claro em
  `scripts/*.js` e `scratch/reset_*.js`

---

## 3. Decisões do usuário

1. Auto-registro público -> **desativado**
2. Séries/Turmas -> **mantidas abertas para todos**
3. Histórico do git -> **não reescrever** (só corrigir o futuro)
4. Escopo -> **somente segurança crítica** (Fases 1-4)
5. Smoke test -> **deixar para depois**

---

## 4. Fases executadas

### Fase 1 — Segredos (concluída)

- `.env.example` reescrito com placeholders (credencial removida)
- `.gitignore`: + `*.sqlite.backup.*`, `database.sqlite*`
- `git rm --cached` nos 2 backups (arquivos locais preservados)
- **Pendente (ação do usuário):** rotacionar a senha do Supabase

### Fase 2 — `sync({force:true})` removido (concluída)

`services/syncService.js:118-121` -> loga o erro e `return false`;
`pushChanges` aborta com `schemaError: true` em vez de dropar tabelas.

### Fase 3 — Registro público desativado (concluída)

- `routes/auth.js`: removidos `GET /register` e `POST /register`
- `controllers/AuthController.js`: removidos `getRegister` e `postRegister`
- `views/register.ejs`: apagado
- `views/login.ejs`: removido link "Cadastre-se"; placeholders neutros
  (antes anunciavam `admin@escola.com` / `admin123`)
- `DOCUMENTACAO.md`: linhas 31, 81, 110 e 266 atualizadas
- **Novo** `scripts/create_user.js`:

```bash
node scripts/create_user.js "<nome>" "<email>" "<senha>" [professor|secretaria]
```

### Fase 4 — Escopo de dono / IDOR (concluída)

**Novo** `middleware/auth.js`:

- `isSecretaria(req)`
- `requireAuth(req, res, next)`
- `requireRole(...roles)` — pronto, sem uso por enquanto
- `classScope(req)` -> `{}` para secretaria, `{ teacherId }` para professor
- `requireClassAccess(param)` — carrega a `Class` com escopo,
  devolve `404` se não acessível, injeta `req.classInfo`

Aplicado em:

| Arquivo | Mudança |
|---|---|
| `routes/index.js` | importa `requireAuth` do middleware |
| `routes/classes.js` | `requireClassAccess('id')` em `GET /classes/:id` e nos 3 `POST /classes/:id/*` |
| `routes/students.js` | `requireClassAccess('classId')` (4 handlers) |
| `routes/activities.js` | `requireClassAccess('classId')` (8 handlers) |
| `controllers/ClassController.js` | dashboard escopado por `teacherId`; `teachers` só para secretaria; `otherClasses` escopado |
| `controllers/StudentController.js` | classe de destino da transferência escopada |
| `controllers/ReportController.js` | `getReport` escopado + `classId` validado (404 se não pertencer à lista); `getRecuperacaoReport` agora usa o `teacherFilter` que antes era criado e nunca usado |

### Fase 5 — Smoke test (PENDENTE)

Servidor subiu (PID 18788), mas as asserções não rodaram:

1. `POST /register` -> 404; link sumido do login
2. Professor A: dashboard/relatório sem turmas de B; `/classes/<id-de-B>` -> 404
3. Secretaria vê tudo
4. Sync não dropa tabelas
5. Fluxos intactos: criar turma, chamada, notas, relatório, transferência

### Arquivos alterados (não commitados)

```
 M .env.example
 M .gitignore
 M DOCUMENTACAO.md
 M controllers/AuthController.js
 M controllers/ClassController.js
 M controllers/ReportController.js
 M controllers/StudentController.js
 M routes/activities.js
 M routes/auth.js
 M routes/classes.js
 M routes/index.js
 M routes/students.js
 M services/syncService.js
 M views/login.ejs
D  database.sqlite.backup.2026-08-05T00-09-27   (só do índice)
D  database.sqlite.backup.20260724_083513        (só do índice)
D  views/register.ejs
?? middleware/                                   (novo)
?? scripts/create_user.js                        (novo)
```

---

## 5. Onde estão os dados (verificado por consulta direta)

| Local | Conteúdo |
|---|---|
| `database.sqlite` (criado 06/10) | **Vazio** — só 3 contas seed |
| `database.sqlite.backup.2026-08-05` (7 MB) | Desatualizado: 27/07, 20 turmas, 234 alunos |
| **Supabase (tabelas plurais)** | **Fonte da verdade**: 18 classes, 359 alunos, 7.828 chamadas, 2.996 notas, 7 bimestres. Última alteração **22/09/2026 14:08** |
| GitHub histórico | Backups + credencial continuam (decisão: não reescrever) |

- Conta `tonyferreira13@gmail.com`: **17 turmas, 356 alunos**
- Senhas do backup local: **removidas deste documento** (repositório público — nunca expor)
- Conexão testada com a credencial antiga (somente `SELECT`) — funcionou
- `DATABASE_URL` não existe nesta máquina -> o app ignora a nuvem

### Descoberta nova: tabelas DUPLICADAS no Supabase

`syncService.js:27-105` usa `freezeTableName: true` -> gera tabelas no
**singular**; os models reais usam **plural**. Existem as duas, divergidas:

| Singular (criada pelo sync) | n | Plural (usada pelo app) | n |
|---|---|---|---|
| Teacher | 6 | Teachers | 6 |
| Class | 21 | Classes | 18 |
| Turma | 7 | Turmas | 27 |
| Serie | 5 | Series | 6 |
| Student | 384 | Students | 359 |
| Attendance | 7760 | Attendances | 7828 |
| Grade | 2614 | Grades | 2996 |
| Bimester | 10 | Bimesters | 7 |
| SyncQueue | 75 | SyncQueues | 2980 (847 pendentes) |

**Risco pré-existente (NÃO causado pelas mudanças desta rodada):**

`pullChanges` (`syncService.js:194-246`) lê as tabelas **singulares**
(divergentes) e grava nos models locais -> quando `DATABASE_URL` estiver
ligado, isso **escreve nas tabelas plurais**, sobrescrevendo dados reais com
cópias obsoletas. **`POST /sync/run` não deve ser clicado até isso ser
corrigido.**

Obs.: o `force:true` removido afetava apenas as tabelas singulares.

---

## 6. Próximos passos

1. **Rotacionar a senha do Supabase** (Settings -> Database -> Reset password)
   — obrigatório, a credencial está no histórico público
2. Criar `.env` com a nova `DATABASE_URL` + `SESSION_SECRET` aleatório
3. Validar com `node scripts/check_supabase_data.js` e reiniciar o app
   (sem `.env` o app ignora a nuvem; **nenhum restore de backup é necessário**)
4. Rodar a Fase 5 (smoke test)
5. Corrigir a divergência singular/plural antes de usar o sync de novo
6. Itens futuros (não feitos nesta rodada):
   - tokens CSRF; escape correto de XSS; cookie `secure`/`sameSite`; regenerar sessão no login
   - transações e `bulkCreate` nos loops de chamada/notas
   - registrar hooks `afterBulkDestroy` / `afterBulkUpdate`
   - migrações versionadas (sequelize-cli); esquema em fonte única
   - corrigir N+1 do relatório; índices e constraints unique
   - ESLint + Prettier + testes de fumaça + CI
   - higiene: remover `scratch/` e `scripts/` órfãos, `layout.ejs`, 404 de `/css/style.css`
