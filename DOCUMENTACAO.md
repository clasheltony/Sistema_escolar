# Sistema Gestão Escolar — Documentação

## 📋 Visão Geral

Sistema de gestão escolar **online**, com todos os dados centralizados no banco na nuvem (Supabase/PostgreSQL). Permite que múltiplos professores usem o sistema, com dados isolados por professor, e uma conta de **Secretaria** que consolida os dados de todos.

> ⚠️ **Requer conexão com a internet.** O sistema usa **exclusivamente** o banco de dados na nuvem. Não existe mais modo offline nem sincronização.

---

## 🚀 Como usar

### Requisitos
- [Node.js](https://nodejs.org) versão 18 ou superior
- Conexão com a internet (o banco fica na nuvem — Supabase)
- Arquivo `.env` com a `DATABASE_URL` configurada

### Iniciar o sistema
```bash
npm start
```
Acesse: `http://localhost:3000`

### Ou clique duas vezes em `iniciar.bat`

---

## 👥 Contas padrão

| Conta | Email | Senha | Acesso |
|---|---|---|---|
| Professor Admin | admin@escola.com | admin123 | Apenas suas turmas |
| Secretaria | secretaria@escola.com | admin123 | Todas as turmas de todos os professores |

Professores e a secretaria são cadastrados pelo administrador:
`node scripts/create_user.js "<nome>" "<email>" "<senha>" [professor|secretaria]`

---

## 🏗️ Arquitetura

```
Navegador
    ↓
Express Server (app.js)
    ↓
PostgreSQL (Supabase) via DATABASE_URL   ← banco ÚNICO e central
```

### Banco de dados
- **PostgreSQL (Supabase)**: banco único do sistema, acessado via `DATABASE_URL`
- Toda leitura/escrita vai direto para a nuvem
- Não existe mais banco local nem sincronização
- Se a `DATABASE_URL` não estiver configurada, o app **não inicia** (erro claro no terminal)

### IDs
- Todos os IDs usam **UUID v4** em vez de inteiros auto-incrementados
- Isso permite que vários usuários criem registros sem conflito de IDs

---

## 📁 Estrutura de arquivos

```
sistema_escolar/
├── app.js                    # Servidor Express (ponto de entrada)
├── iniciar.bat               # Script para Windows (1 clique)
├── package.json
├── .env                      # Configurações (DATABASE_URL obrigatória)
├── DOCUMENTACAO.md           # Este arquivo
│
├── models/
│   ├── index.js              # Conexão Sequelize (PostgreSQL/Supabase)
│   ├── Teacher.js            # Professor (role: professor | secretaria)
│   ├── Serie.js              # Série
│   ├── Turma.js              # Turma (agrupamento)
│   ├── Class.js              # Turma/disciplina
│   ├── Student.js            # Aluno
│   ├── Attendance.js         # Chamada/Presença
│   ├── Grade.js              # Nota/Visto
│   └── Bimester.js           # Bimestre
│
├── middleware/
│   └── auth.js               # Autenticação + escopo por professor (anti-IDOR)
│
├── controllers/
│   ├── AuthController.js     # Login/Logout
│   ├── ClassController.js    # CRUD turmas + dashboard
│   ├── StudentController.js  # CRUD alunos + transferência
│   ├── ActivityController.js # Chamadas + Notas
│   ├── ReportController.js   # Relatórios consolidados
│   └── SettingsController.js # Configuração de bimestres
│
├── routes/
│   ├── index.js              # Centralizador de rotas
│   ├── auth.js               # Rotas de autenticação
│   ├── classes.js            # Rotas de turmas
│   ├── students.js           # Rotas de alunos
│   ├── activities.js         # Rotas de chamadas/notas
│   ├── reports.js            # Rotas de relatórios
│   └── settings.js           # Rotas de configurações
│
├── scripts/
│   └── create_user.js        # Cria usuários (professor | secretaria)
│
└── views/
    ├── header.ejs            # Layout principal (navbar)
    ├── footer.ejs            # Scripts JS (tema)
    ├── layout.ejs            # Layout alternativo
    ├── login.ejs             # Tela de login
    ├── dashboard.ejs         # Dashboard de turmas
    ├── class_details.ejs     # Detalhes da turma
    ├── activities.ejs        # Chamadas e notas
    ├── report.ejs            # Relatório geral
    ├── recuperacao_report.ejs # Relatório de recuperação
    └── settings.ejs          # Configuração de bimestres
```

---

## 🔄 Conexão com o banco de dados

O sistema acessa **diretamente** o PostgreSQL (Supabase). Não há banco local nem sincronização.

- Configure a variável `DATABASE_URL` no arquivo `.env`:
  ```env
  DATABASE_URL=postgresql://USUARIO:SENHA@HOST:6543/postgres
  ```
- Sem essa variável o app **não inicia** (exibe um erro claro no terminal).
- Toda alteração (criar/editar/excluir) é gravada imediatamente no banco na nuvem.

### ⚠️ Use SEMPRE o Pooler (porta 6543), nunca a conexão direta

No painel do Supabase: **Connect → Transaction pooler** (porta `6543`).

| Método | Host / porta | Usar? |
|---|---|---|
| **Shared pooler (transaction)** | `aws-<n>-<região>.pooler.supabase.com:6543`, usuário `postgres.<ref>` | ✅ **Sim** |
| Conexão direta | `db.<ref>.supabase.co:5432`, usuário `postgres` | ❌ Não (só tem IPv6; falha no Render e em redes IPv4) |

- O usuário do pooler é `postgres.`**`<ref-do-projeto>`** (diferente do `postgres` puro).
- O host do pooler **não dá para adivinhar** (o `<n>` em `aws-<n>` é índice de cluster): copie do diálogo Connect.
- Se a senha tiver caracteres especiais (`@ : / # ? & espaço`), [percent-encode](https://en.wikipedia.org/wiki/Percent-encoding) (ex.: `@` → `%40`). O mais simples é usar só letras e números.
- A **mesma** `DATABASE_URL` precisa estar no servidor de produção (Render → Environment).

> ℹ️ O antigo modo **offline-first** e o serviço de sincronização (`syncService`, `SyncController`, rotas `/sync`, model `SyncQueue` e o indicador no navbar) foram **removidos**.

---

## 👑 Papel da Secretaria

### O que a Secretaria pode fazer
- Ver **todas as turmas** de todos os professores no dashboard
- Criar/editar/excluir turmas para qualquer professor
- Ver relatórios consolidados de qualquer turma/professor
- Gerenciar bimestres de qualquer professor
- Filtrar relatórios por professor
- Acessar relatórios de recuperação de todas as turmas

### Como usar
1. Faça login com `secretaria@escola.com` / `admin123`
2. O dashboard mostra "Todas as Turmas" com o nome do professor em cada card
3. Nos relatórios, há um filtro "Todos os professores"
4. Um badge **SECRETARIA** aparece no navbar indicando o papel

---

## 📊 Modelo de Dados

### Teacher (Professor)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| name | STRING | Nome do professor |
| email | STRING (unique) | Email de login |
| password | STRING | Senha criptografada (bcrypt) |
| role | STRING | 'professor' ou 'secretaria' |

### Class (Turma)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| name | STRING | Nome da turma (ex: 7º Ano A) |
| subject | STRING | Disciplina |
| teacherId | UUID (FK) | Professor responsável |

### Student (Aluno)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| name | STRING | Nome do aluno |
| enrollment | STRING | Matrícula |
| active | BOOLEAN | Se está ativo na turma |
| classId | UUID (FK) | Turma |

### Attendance (Chamada)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| date | DATEONLY | Data da chamada |
| lessonNumber | INTEGER | Número da aula (1-9) |
| status | ENUM | 'Presente' ou 'Ausente' |
| lessonTopic | STRING | Conteúdo da aula |
| studentId | UUID (FK) | Aluno |
| classId | UUID (FK) | Turma |

### Grade (Nota/Visto)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| activityName | STRING | Nome da atividade |
| type | ENUM | 'Visto' ou 'Nota' |
| date | DATEONLY | Data |
| value | DECIMAL(5,2) | Valor da nota (para Nota) |
| status | BOOLEAN | True/False (para Visto) |
| studentId | UUID (FK) | Aluno |
| classId | UUID (FK) | Turma |

### Bimester (Bimestre)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| name | STRING | Nome (1º Bimestre, etc.) |
| startDate | DATEONLY | Data de início |
| endDate | DATEONLY | Data de término |
| teacherId | UUID (FK) | Professor |

---

## 🔧 Manutenção

### Backup
O banco é o Supabase (PostgreSQL). Use as ferramentas do painel do Supabase
(ou `pg_dump` com a `DATABASE_URL`) para gerar backups.

### Logs
O sistema usa `console.log` para registrar eventos importantes no terminal.

---

## 📦 Distribuição para outros computadores

> ⚠️ Cada computador precisa de **conexão com a internet** e de um arquivo `.env` com a `DATABASE_URL` (o banco fica na nuvem). O `npm install` pode ser feito uma única vez.

### Método 1: Com dependências (evita baixar pacotes na primeira execução)
1. No seu computador, execute `npm install` para baixar as dependências
2. Compacte a **pasta inteira** (incluindo `node_modules/`) em um .zip
3. Envie o .zip para os outros professores
4. Cada um extrai, cria o `.env` e clica em `iniciar.bat`

### Método 2: Sem dependências (o script baixa as dependências na primeira execução)
1. Compacte a pasta **sem o `node_modules/`** em um .zip
2. Cada professor extrai, cria o `.env` e clica em `iniciar.bat`
3. O script baixa as dependências automaticamente na primeira execução

### Contas
- O cadastro público está desativado; as contas são criadas pelo administrador com `scripts/create_user.js`
- A secretaria tem a conta fixa `secretaria@escola.com`
- Os dados de cada professor ficam isolados automaticamente pelo `teacherId`

---

## ⚙️ Configuração

### Variáveis de ambiente (.env)
```env
DATABASE_URL=postgresql://...              # OBRIGATÓRIA — banco na nuvem (Supabase)
SESSION_SECRET=chave_secreta              # Recomendada em produção
PORT=3000                                  # Porta do servidor (opcional)
```

### Tema escuro
Clique no ícone de sol/lua no navbar para alternar entre tema claro e escuro. A preferência fica salva no navegador.

---

## 🧪 Testes

O sistema não possui testes automatizados. Para testar manualmente:
1. Inicie o servidor: `npm start`
2. Acesse `http://localhost:3000`
3. Faça login com uma conta criada via `scripts/create_user.js` (ou com a secretaria)
4. Crie turmas, adicione alunos, faça chamadas e registre notas
5. Faça login como secretaria para ver os dados consolidados
