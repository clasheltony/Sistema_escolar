-- ============================================================
-- Script de Correção de Segurança - Supabase
-- Sistema Escolar (wthpwisvqswkmblmhcko)
-- Data: 2026-05-06
-- ============================================================
-- PROBLEMA: As tabelas no schema "public" estão sem Row-Level
-- Security (RLS), permitindo acesso irrestrito via API pública
-- do Supabase (PostgREST).
--
-- SOLUÇÃO: Habilitar RLS em todas as tabelas e revogar acesso
-- dos roles públicos (anon/authenticated). A aplicação Node.js
-- conecta via connection string direta (role postgres), que
-- IGNORA o RLS, então ela continuará funcionando normalmente.
-- ============================================================

-- =====================
-- 1. HABILITAR RLS
-- =====================
-- Habilita Row-Level Security em todas as tabelas do sistema

ALTER TABLE "Teachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bimesters" ENABLE ROW LEVEL SECURITY;

-- =====================
-- 2. REVOGAR PERMISSÕES DOS ROLES PÚBLICOS
-- =====================
-- Remove todas as permissões dos roles "anon" (não autenticado)
-- e "authenticated" (autenticado via Supabase Auth) para que
-- ninguém acesse os dados pela API REST pública.

-- Role: anon (acesso público sem autenticação)
REVOKE ALL ON "Teachers" FROM anon;
REVOKE ALL ON "Classes" FROM anon;
REVOKE ALL ON "Students" FROM anon;
REVOKE ALL ON "Attendances" FROM anon;
REVOKE ALL ON "Grades" FROM anon;
REVOKE ALL ON "Bimesters" FROM anon;

-- Role: authenticated (acesso via Supabase Auth)
REVOKE ALL ON "Teachers" FROM authenticated;
REVOKE ALL ON "Classes" FROM authenticated;
REVOKE ALL ON "Students" FROM authenticated;
REVOKE ALL ON "Attendances" FROM authenticated;
REVOKE ALL ON "Grades" FROM authenticated;
REVOKE ALL ON "Bimesters" FROM authenticated;

-- =====================
-- 3. VERIFICAÇÃO
-- =====================
-- Execute esta query separadamente após rodar o script acima
-- para confirmar que o RLS foi ativado em todas as tabelas:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('Teachers','Classes','Students','Attendances','Grades','Bimesters');
--
-- Todas devem mostrar rowsecurity = true
-- ============================================================
