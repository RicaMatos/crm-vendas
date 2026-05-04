# Memória do Projeto CRM Vendas

## Informações do Cliente

- **Nome:** Ricardo
- **Preferências de idioma:** Português do Brasil

## Padrões de Codificação

- Aplicar princípios de código limpo
- Incluir comentários detalhados em português ao gerar ou editar arquivos
- Sempre consultar este arquivo de memória antes de propor alterações
- **OBRIGATÓRIO:** Todo o retorno de análise, planejamento e comunicação deve ser em Português do Brasil.

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
| 28/04/2026 | CORREÇÃO: Domínio Supabase errado - alterado de zgtkbnzmun para zgtakbznmux |
| 28/04/2026 | Atualização do Vercel com novo domínio |
| 28/04/2026 | Fix: tratamento de email não confirmado no login |
| 28/04/2026 | Aplicação de RLS e políticas no Supabase |
| 30/04/2026 | Listagem dos usuários cadastrados no sistema (3 usuários) |
| 30/04/2026 | Implementação de "Esqueceu a senha?" na tela de login |
| 30/04/2026 | Criação do endpoint /api/auth/reset-password |
| 30/04/2026 | Implementação de recuperação de senha com token de 35 segundos na tela |
| 30/04/2026 | Inputs de cadastro em caixa alta (text-transform: uppercase) |
| 30/04/2026 | CPF/CNPJ validado e apenas números no campo |
| 30/04/2026 | WhatsApp/Telefone apenas números |
| 30/04/2026 | Calendário de Tarefas com navegação entre meses |
| 30/04/2026 | Dashboard - removidos KPIs de percentual e status |
| 01/05/2026 | Ajuste na exibição de valores em reais (pontos para casas decimais) |
| 01/05/2026 | Correção do bug das parcelas no resumo de parcelamento |
| 01/05/2026 | Adição de gráfico de Pagamento de Comissões no dashboard |
| 01/05/2026 | Ajuste de largura das barras do gráfico de comissões |
| 01/05/2026 | Correção na regra de payday (datas de corte) |
| 01/05/2026 | Correção: projetado = pago + pendente |
| 03/05/2026 | Admin tem acesso global a produtos e culturas |
| 04/05/2026 | Corrige token não salvo no sessionStorage |

## Histórico de Alterações

- 25/04/2026 - Criação do arquivo de memória
- 27/04/2026 - Deploy inicial para GitHub e Vercel
- 27/04/2026 - Adicionado endpoint de debug /api/debug
- 27/04/2026 - Corrigido erro require (ES6 modules → globals)
- 27/04/2026 - Adicionado fallback login direto via Supabase
- 28/04/2026 - Health check simplificado (sem Supabase)
- 28/04/2026 - Corrigido domínio Supabase (zgtakbznmuxkibxybdky)
- 28/04/2026 - Fix: tratamento de email não confirmado
- 28/04/2026 - Aplicação de RLS e políticas no Supabase
- 03/05/2026 - Admin global: funções SQL admin_get_all_products e admin_get_all_crops
- 04/05/2026 - Admin token salvo no sessionStorage
- 04/05/2026 - Correções no formulário de clientes (botões duplicados, data aniversário)
- 04/05/2026 - Adição do sistema de observações de clientes
- 04/05/2026 - Checkbox criar lembrete na agenda ao salvar observação
- 04/05/2026 - Diferenciação de cores: roxo aniversários, laranja observações

## Situação Atual do Deploy

### GitHub ✅
- Repositório: https://github.com/RicaMatos/crm-vendas
- ÚLTIMO COMMIT: 44ec2f0 - Diferencia cores de tarefas: roxo aniversario, laranja observacao
- STATUS: ✅ Online

### Render ✅
- URL: https://crm-vendas.onrender.com
- STATUS: ✅ Online (deploy automático)

### Supabase ✅
- Projeto: zgtakbznmuxkibxybdky
- URL: https://zgtakbznmuxkibxybdky.supabase.co
- Tabelas: 6 (customers, products, crops, orders, interactions, tasks)
- RLS: ✅ Ativo em todas as tabelas
- Políticas: 24 (4 por tabela)

### Problema Identificado ⚠️
- **Erro:** "net::ERR_NAME_NOT_RESOLVED" -域名 errado
- **Causa:** domínio Supabase digitado incorretamente (tinha "zgtkbnzmun" em vez de "zgtakbznmux")
- **Solução:** Domínio corrigido no código

### Variáveis de Ambiente (Vercel)
Necessário configurar no Vercel Dashboard:

| Variável | Valor |
|---------|-------|
| SUPABASE_URL | https://zgtakbznmuxkibxybdky.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA |
| JWT_SECRET | crm_vendas_2026_chave_jwt_producao_segura_aleatoria |

### Funcionalidades
- ✅ Health check (/api/health)
- ✅ Debug (/api/debug)
- ✅ Login via backend
- ✅ Login direto (fallback)
- ✅ Tratamento de email não confirmado
- ✅ RLS no Supabase (segurança)
- ✅ Gráfico de Pagamento de Comissões (barras quinzenais)

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
| SUPABASE_URL | https://zgtakbznmuxkibxybdky.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA |
| JWT_SECRET | crm_vendas_2026_chave_jwt_producao_segura_aleatoria |

⚠️ IMPORTANTE: O domínio correto é **zgtakbznmuxkibxybdky** (não zgtkbnzmun!)

### Regras de Payday (Datas de Corte)
- Dia 1-12 → paga no dia 15 do mesmo mês
- Dia 13-27 → paga no dia 30 do mesmo mês
- Dia 28-31 → paga no dia 15 do próximo mês

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
| SUPABASE_URL | https://zgtakbznmuxkibxybdky.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ |
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

