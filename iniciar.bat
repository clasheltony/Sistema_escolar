@echo off
title Sistema Gestao Escolar

echo ============================================
echo   Sistema Gestao Escolar - Online/Offline
echo ============================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo.
    echo Para usar o sistema e necessario instalar o Node.js:
    echo 1. Acesse: https://nodejs.org
    echo 2. Baixe a versao LTS (18+)
    echo 3. Instale com as opcoes padrao
    echo 4. Execute este script novamente
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

:: Verificar dependencias
if not exist "node_modules" (
    echo Instalando dependencias... (primeira vez pode levar alguns minutos)
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar dependencias
        echo Verifique sua conexao com a internet
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas
) else (
    echo [OK] Dependencias ja instaladas
)

echo.
echo Iniciando servidor...
echo.
echo Acesse: http://localhost:3000
echo.
echo Contas padrao:
echo   Professor: admin@escola.com / admin123
echo   Secretaria: secretaria@escola.com / admin123
echo.
echo Pressione CTRL+C para parar o servidor
echo ============================================
echo.

call npm start

pause
