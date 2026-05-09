# CRM VENDAS - Deploy Guide

## Deploy Manual

### Pré-requisitos
```bash
npm install
```

### Procedimento

```bash
# 1. Instalar dependências
npm install

# 2. Commit e push no GitHub
git add .
git commit -m "mensagem do commit"
git push origin main
```

---

## Variáveis de Ambiente

Verificar arquivo `.env.example` para as variáveis necessárias.

---

## Troubleshooting

| Erro | Solução |
|------|--------|
| `Module not found` | Verificar dependências em `package.json` |
| `.env` vazio | Copiar variáveis do `.env.example` |
