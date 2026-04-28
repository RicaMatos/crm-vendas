# Memória do Projeto CRM Vendas

## Informações do Cliente

- **Nome:** Ricardo
- **Preferências de idioma:** Português do Brasil

## Padrões de Codificação

- Aplicar princípios de código limpo
- Incluir comentários detalhados em português ao gerar ou editar arquivos
- Sempre consultar este arquivo de memória antes de propor alterações

## Histórico de Tarefas

| Data | Tarefa |
|------|--------|
| 25/04/2026 | Criação do arquivo de memória MEMORIA.md |
| 25/04/2026 | Atualização da estrutura do histórico de tarefas com tabela de registro |
| 25/04/2026 | Ajuste na altura dos KPI cards do dashboard (70%) e alinhamento dos valores |
| 25/04/2026 | Adição de filtros de período (Ano, Trimestre, Mês, Tudo) nos cards de Vendas Totais, Comissão Recebida e Comissão a Receber |
| 25/04/2026 | Implementação da lógica de filtragem por período nos filtros dos KPI cards |
| 25/04/2026 | Ajuste de alinhamento horizontal dos valores nos KPI cards para ficarem na mesma linha |
| 25/04/2026 | Debug e correção dos valores de produtos no formulário de pedidos (pendente) |
| 27/04/2026 | Configuração de deploy no GitHub e Vercel |
| 27/04/2026 | Push inicial para GitHub (53 arquivos, 2553 linhas) |
| 27/04/2026 | Adição do endpoint /api/debug para diagnóstico |
| 27/04/2026 | Identificação de problema de conexão com Supabase (fetch failed) |
| 27/04/2026 | Correção do erro "require is not defined" - convertendo ES6 modules para globals |
| 27/04/2026 | Adição de login direto via Supabase API quando backend falha |
| 28/04/2026 | Identificação de problema de DNS (ERR_NAME_NOT_RESOLVED) |

## Histórico de Alterações

- 25/04/2026 - Criação do arquivo de memória
- 27/04/2026 - Deploy inicial para GitHub e Vercel
- 27/04/2026 - Adicionado endpoint de debug /api/debug
- 27/04/2026 - Corrigido erro require (ES6 modules → globals)
- 27/04/2026 - Adicionado fallback login direto via Supabase
- 28/04/2026 - Health check simplificado (sem Supabase)

## Situação Atual do Deploy

### GitHub ✅
- Repositório: https://github.com/RicaMatos/crm-vendas
- ÚLTIMO COMMIT: 831252e - Fix: login direto via Supabase API
- STATUS: ✅ Online

### Vercel ✅
- URL: https://crm-ne-xus.vercel.app
- ÚLTIMO COMMIT: 831252e
- STATUS: ✅ Online (deploy automático)

### Problema Identificado ❌
- **Erro:** "net::ERR_NAME_NOT_RESOLVED" - DNS não resolve supabase.co
- **Causa:** Rede local não consegue resolver o domínio do Supabase
- **Solução:** Usar outra rede (dados móveis) ou corrigir DNS local

### Variáveis de Ambiente (Vercel) ✅
| Variável | Status |
|---------|--------|
| SUPABASE_URL | ❌ Não configurado |
| SUPABASE_ANON_KEY | ✅ Configurado |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Configurado |
| JWT_SECRET | ✅ Configurado |

### Funcionalidades
- ✅ Health check (/api/health)
- ✅ Debug (/api/debug)
- ✅ Login via backend
- ✅ Login direto (fallback)
- ⚠️ Login direto falha por problema de DNS local

### Próximos Passos
1. 🔧 Corrigir DNS da rede local
2. Alternativa: usar dados móveis/hotspot

## Deploy - Vercel (Recomendado)

### 1. Criar arquivo `vercel.json` na raiz do projeto:

```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/server.js" },
    { "src": "/(.*)", "dest": "/server.js" }
  ]
}
```

### 2. Variáveis de Ambiente (OBRIGATÓRIAS - adicionar no Vercel):

| Variável | Valor |
|---------|-------|
| SUPABASE_URL | https://zgtkbnzmunxkibxybdky.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA |
| JWT_SECRET | crm_vendas_2026_chave_jwt_producao_segura_aleatoria |

⚠️ IMPORTANTE: Sem SUPABASE_URL configurado, a API retorna "fetch failed"

### 3. Passos para deploy:

**Passo 1 - GitHub:**
1. Criar repositório no GitHub (nome: crm-vendas, público ou privado)
2. Enviar código:
   ```bash
   git init
   git add .
   git commit -m "CRM Vendas"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/crm-vendas.git
   git push -u origin main
   ```

**Passo 2 - Vercel:**
1. Acessar vercel.com
2. Clicar "Add New" → "Project"
3. Importar repositório "crm-vendas"
4. Em "Environment Variables", adicionar:

| Nome | Valor |
|------|-------|
| SUPABASE_URL | https://zgtkbnzmunxkibxybdky.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA |
| JWT_SECRET | crm_vendas_2026_chave_jwt_producao_segura_aleatoria |

5. Clicar "Deploy"
6. Aguardar ~1 minuto
7. Copiar o link fornecido (ex: https://crm-vendas.vercel.app)

**Atualizações futuras:**
- Após修改 no código, basta fazer git push会自动触发 deploy
-Para alterações manuais: Vercel → Project → Settings → Environment Variables## Scripts de Deploy
| Arquivo | Descricao | Plataforma |
|--------|-----------|------------|
| deploy.sh | Script bash executavel para deploy automatico | Linux/macOS/WSL |
| DEPLOY.md | Guia completo com instrucoes visuais | Multi-plataforma |
### Uso do Script
\\\ash
bash deploy.sh
\\\

