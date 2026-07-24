@echo off
title Sistema Gestao Escolar

echo ============================================
echo   Sistema Gestao Escolar - Online/Offline
echo ============================================
echo.

:: Verificar Node.js
node --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================
    echo   [ERRO] Node.js nao encontrado!
    echo ============================================
    echo.
    echo Para usar este sistema voce precisa instalar
    echo o Node.js no seu computador.
    echo.
    echo Siga os passos abaixo:
    echo.
    echo   1. Acesse: https://nodejs.org
    echo   2. Clique no botao VERDE "LTS"
    echo   3. Abra o arquivo baixado e clique em Next, Next, Finish
    echo   4. APOS INSTALAR, feche esta janela e
    echo      execute o iniciar.bat NOVAMENTE
    echo.
    echo ============================================
    echo.
    echo OBS: O Node.js e gratuito e ocupa ~50MB.
    echo Nao precisa de VSCode, editor ou qualquer
    echo outro programa - apenas o Node.js.
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
echo ============================================
echo   INICIANDO SERVIDOR...
echo ============================================
echo.

:: Iniciar servidor em uma janela separada
start "Servidor EscolaOnline" /MIN cmd /c "node app.js"

:: Aguardar servidor iniciar
ping -n 6 127.0.0.1 >nul

echo.
echo ============================================
echo   PRONTO!
echo.
echo   Abrindo o sistema no navegador...
echo.
echo   Se nao abrir automaticamente:
echo   http://localhost:3000
echo.
echo   Contas padrao:
echo     Professor: admin@escola.com / admin123
echo     Secretaria: secretaria@escola.com / admin123
echo.
echo   NAO FECHE esta janela enquanto estiver
echo   usando o sistema.
echo ============================================
echo.

:: Abrir navegador
start http://localhost:3000

:: Manter esta janela aberta
echo Pressione qualquer tecla para parar o servidor...
pause >nul

:: Parar o servidor ao fechar
taskkill /f /im node.exe >nul 2>&1
echo Servidor encerrado.
echo.
