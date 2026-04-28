# CRM VENDAS - Deploy Guide

## Scripts Disponíveis

| Arquivo | Descrição | Plataforma |
|--------|-----------|------------|
| `deploy.sh` | Script bash executável | Linux/macOS/WSL |
| `DEPLOY.md` | Este guia | Multi-plataforma |

---

## Deploy via Script

### Linux/macOS/WSL
```bash
bash deploy.sh
```

### Windows (PowerShell)
```bash
cmd /c deploy.sh
```

### Windows (Git Bash)
```bash
./deploy.sh
```

---

## Deploy Manual Vercel

### Pré-requisitos
```bash
npm install -g vercel
vercel login
```

### Procedimento

```bash
# 1. Login
vercel login

# 2. Instalar dependências
npm install

# 3. Deploy produção
npx vercel --prod

# 4. Deploy staging (opcional)
npx vercel
```

---

## Variáveis de Ambiente Obrigatórias

No Vercel Dashboard > Settings > Environment Variables:

| Variável | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://zgtkbnzmunxkibxybdky.supabase.co` |
| `SUPABASE_ANON_KEY` | *(ver .env)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(ver .env)* |
| `JWT_SECRET` | *(ver .env)* |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

---

## Verificar Deploy

```bash
# Health check
curl https://seu-projeto.vercel.app/api/health

# Esperado:
# {"success":true,"message":"CRM Vendas API está online"...}
```

---

## Troubleshooting

| Erro | Solução |
|------|--------|
| `NOT_FOUND` | Projeto não existe no Vercel - criar novo |
| `402 Payment Required` | Plano Vercel excedido - fazer upgrade |
| `Module not found` | Verificar dependências em `package.json` |
| `.env` vazio | Copiar variáveis do `.env.example` |