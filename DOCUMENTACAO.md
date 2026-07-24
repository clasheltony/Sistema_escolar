# Sistema Gestão Escolar — Documentação

## 📋 Visão Geral

Sistema de gestão escolar com suporte **offline-first** e sincronização com a nuvem (Supabase/PostgreSQL). Permite que múltiplos professores usem o sistema em seus próprios computadores, com dados isolados por professor, e uma conta de **Secretaria** que consolida os dados de todos.

---

## 🚀 Como usar

### Requisitos
- [Node.js](https://nodejs.org) versão 18 ou superior

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

Professores podem criar suas próprias contas na tela de registro.

---

## 🏗️ Arquitetura

```
Navegador (http://localhost:3000)
    ↓
Express Server (app.js)
    ↓
SQLite (database.sqlite) ← banco PRIMÁRIO, sempre local
    ↓ (quando online)
Sync Service → PostgreSQL (Supabase) via DATABASE_URL
```

### Banco de dados
- **SQLite**: Banco local primário, funciona 100% offline
- **PostgreSQL (Supabase)**: Banco na nuvem, usado apenas para sincronização
- Toda leitura/escrita é feita no SQLite
- A sincronização é bidirecional (push + pull)

### IDs
- Todos os IDs usam **UUID v4** em vez de inteiros auto-incrementados
- Isso permite que múltiplos computadores criem registros sem conflito de IDs

---

## 📁 Estrutura de arquivos

```
sistema_escolar/
├── app.js                    # Servidor Express (ponto de entrada)
├── iniciar.bat               # Script para Windows (1 clique)
├── package.json
├── database.sqlite           # Banco de dados local
├── .env                      # Configurações (DATABASE_URL, etc.)
├── DOCUMENTACAO.md           # Este arquivo
│
├── models/
│   ├── index.js              # Conexão Sequelize + hooks de sincronização
│   ├── Teacher.js            # Professor (role: professor | secretaria)
│   ├── Class.js              # Turma
│   ├── Student.js            # Aluno
│   ├── Attendance.js         # Chamada/Presença
│   ├── Grade.js              # Nota/Visto
│   ├── Bimester.js           # Bimestre
│   └── SyncQueue.js          # Fila de sincronização
│
├── controllers/
│   ├── AuthController.js     # Login/Registro
│   ├── ClassController.js    # CRUD turmas + dashboard
│   ├── StudentController.js  # CRUD alunos + transferência
│   ├── ActivityController.js # Chamadas + Notas
│   ├── ReportController.js   # Relatórios consolidados
│   ├── SettingsController.js # Configuração de bimestres
│   └── SyncController.js     # Status e execução da sincronização
│
├── routes/
│   ├── index.js              # Centralizador de rotas
│   ├── auth.js               # Rotas de autenticação
│   ├── classes.js            # Rotas de turmas
│   ├── students.js           # Rotas de alunos
│   ├── activities.js         # Rotas de chamadas/notas
│   ├── reports.js            # Rotas de relatórios
│   ├── settings.js           # Rotas de configurações
│   └── sync.js               # Rotas de sincronização
│
├── services/
│   └── syncService.js        # Serviço de sincronização (push/pull)
│
├── scripts/
│   └── migrate_to_uuid.js    # Script de migração INTEGER → UUID
│
└── views/
    ├── header.ejs            # Layout principal (navbar + sync)
    ├── footer.ejs            # Scripts JS (sync + tema)
    ├── layout.ejs            # Layout alternativo
    ├── login.ejs             # Tela de login
    ├── register.ejs          # Tela de registro
    ├── dashboard.ejs         # Dashboard de turmas
    ├── class_details.ejs     # Detalhes da turma
    ├── activities.ejs        # Chamadas e notas
    ├── report.ejs            # Relatório geral
    ├── recuperacao_report.ejs # Relatório de recuperação
    └── settings.ejs          # Configuração de bimestres
```

---

## 🔄 Sincronização

### Como funciona
1. Toda alteração feita no sistema (criar/editar/excluir) é registrada automaticamente na tabela `SyncQueue`
2. Quando o usuário clica no indicador de sincronização (ou a cada 60s), o sistema:
   - **Push**: Envia as alterações pendentes do SQLite para o PostgreSQL
   - **Pull**: Busca alterações novas do PostgreSQL para o SQLite
3. O indicador no navbar mostra o status:
   - 🟢 Online — conectado ao servidor
   - 🔴 Offline — trabalhando apenas localmente

### Para ativar a sincronização
Configure a variável `DATABASE_URL` no arquivo `.env`:
```env
DATABASE_URL=postgresql://usuario:senha@host:6543/postgres
```

### Endpoints da API
- `GET /sync/status` — Retorna JSON com status da conexão
- `POST /sync/run` — Executa sincronização manual

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

### SyncQueue (Fila de Sincronização)
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único |
| tableName | STRING | Nome da tabela alterada |
| recordId | UUID | ID do registro |
| operation | ENUM | 'CREATE', 'UPDATE', 'DELETE' |
| data | TEXT (JSON) | Snapshot completo do registro |
| synced | BOOLEAN | Se já foi sincronizado |
| syncError | TEXT | Mensagem de erro (se houver) |

---

## 🔧 Manutenção

### Migração de dados (INTEGER → UUID)
Se precisar migrar dados de uma versão antiga:
```bash
node scripts/migrate_to_uuid.js
```
Isso cria um backup automático antes de migrar.

### Backup manual
O banco SQLite fica em `database.sqlite`. Para backup, copie este arquivo.

### Logs
O sistema usa `console.log` para registrar eventos importantes no terminal.

---

## 📦 Distribuição para outros computadores

### Método 1: Com dependências (recomendado para quem não tem internet)
1. No seu computador, execute `npm install` para baixar as dependências
2. Compacte a **pasta inteira** (incluindo `node_modules/`) em um .zip
3. Envie o .zip para os outros professores
4. Cada um extrai e clica em `iniciar.bat`

### Método 2: Sem dependências (precisa de internet na primeira vez)
1. Compacte a pasta **sem o `node_modules/`** em um .zip
2. Cada professor extrai e clica em `iniciar.bat`
3. O script baixa as dependências automaticamente na primeira execução

### Contas
- Cada professor cria sua própria conta na tela de registro
- A secretaria tem a conta fixa `secretaria@escola.com`
- Os dados de cada professor ficam isolados automaticamente pelo `teacherId`

---

## ⚙️ Configuração

### Variáveis de ambiente (.env)
```env
DATABASE_URL=postgresql://...              # Para sincronizar com Supabase
SESSION_SECRET=chave_secreta              # Para sessões (opcional)
PORT=3000                                  # Porta do servidor (opcional)
```

### Tema escuro
Clique no ícone de sol/lua no navbar para alternar entre tema claro e escuro. A preferência fica salva no navegador.

---

## 🧪 Testes

O sistema não possui testes automatizados. Para testar manualmente:
1. Inicie o servidor: `npm start`
2. Acesse `http://localhost:3000`
3. Faça login como admin ou crie uma conta
4. Crie turmas, adicione alunos, faça chamadas e registre notas
5. Faça login como secretaria para ver os dados consolidados
