@echo off
REM *****************
REM init-firebase.bat
REM Script de inicialização do projeto Firebase (Windows)
REM Automatiza a configuração inicial
REM *****************

echo 🚀 Trading Pro - Configuração Firebase
echo ======================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado!
    echo Por favor, instale Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js encontrado
node --version
echo.

REM Verificar se Firebase CLI está instalado
where firebase >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 Instalando Firebase CLI...
    call npm install -g firebase-tools
    echo ✅ Firebase CLI instalado!
) else (
    echo ✅ Firebase CLI já instalado
    firebase --version
)

echo.
echo 🔐 Fazendo login no Firebase...
call firebase login

echo.
echo 📁 Criando estrutura de pastas...
if not exist public mkdir public

echo.
echo ⚙️ Inicializando Firebase...
call firebase init

echo.
echo ✅ Configuração concluída!
echo.
echo 📝 Próximos passos:
echo 1. Edite firebase-config.js com suas credenciais
echo 2. Mova index.html e firebase-config.js para a pasta public/
echo 3. Execute: firebase deploy
echo.
echo 📚 Consulte README-FIREBASE.md para mais detalhes
echo.
pause
