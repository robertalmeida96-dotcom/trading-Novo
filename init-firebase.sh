#!/bin/bash

#*****************
# init-firebase.sh
# Script de inicialização do projeto Firebase
# Automatiza a configuração inicial
#*****************

echo "🚀 Trading Pro - Configuração Firebase"
echo "======================================"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "Por favor, instale Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo ""

# Verificar se Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "📦 Instalando Firebase CLI..."
    npm install -g firebase-tools
    echo "✅ Firebase CLI instalado!"
else
    echo "✅ Firebase CLI já instalado: $(firebase --version)"
fi

echo ""
echo "🔐 Fazendo login no Firebase..."
firebase login

echo ""
echo "📁 Criando estrutura de pastas..."
mkdir -p public

echo ""
echo "⚙️ Inicializando Firebase..."
firebase init

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📝 Próximos passos:"
echo "1. Edite firebase-config.js com suas credenciais"
echo "2. Mova index.html e firebase-config.js para a pasta public/"
echo "3. Execute: firebase deploy"
echo ""
echo "📚 Consulte README-FIREBASE.md para mais detalhes"
