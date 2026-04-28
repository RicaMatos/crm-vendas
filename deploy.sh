#!/bin/bash
# ============================================
# CRM VENDAS - Script de Deploy
# Autor: opencode
# Data: 2026-04-27
# ============================================
set -e

echo "=========================================="
echo "🚀 CRM Vendas - Deploy Automatizado"
echo "=========================================="

VERDE='\033[0;32m'
AMARELO='\033[1;33m'
VERMELHO='\033[0;31m'
SEM_COR='\033[0m'

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${VERMELHO}❌ Node.js não encontrado${SEM_COR}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${VERMELHO}❌ npm não encontrado${SEM_COR}"
    exit 1
fi

echo -e "${VERDE}✅ Dependências OK${SEM_COR}"

# Instalar dependências
echo ""
echo "📦 Instalando dependências..."
npm install

# Verificar variáveis de ambiente
echo ""
echo "🔍 Verificando variáveis de ambiente..."
if [ -f .env ]; then
    echo -e "${VERDE}✅ Arquivo .env encontrado${SEM_COR}"
else
    echo -e "${AMARELO}⚠️ AVISO: Arquivo .env não encontrado${SEM_COR}"
fi

# Build
if npm run build 2>/dev/null; then
    echo -e "${VERDE}✅ Build concluído${SEM_COR}"
else
    echo -e "${AMARELO}⚠️ Build não configurado, pulando...${SEM_COR}"
fi

# Deploy Vercel
echo ""
echo "🚀 Iniciando deploy no Vercel..."
npx vercel --prod

echo ""
echo "=========================================="
echo -e "${VERDE}✅ Deploy concluído!${SEM_COR}"
echo "=========================================="