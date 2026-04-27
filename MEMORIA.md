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

## Histórico de Alterações

- 25/04/2026 - Criação do arquivo de memória

## Deploy - Vercel (Recomendado)

### 1. Criar arquivo `vercel.json` na raiz do projeto:

```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/server.js" }
  ]
}
```

### 2. Variáveis de Ambiente (adicionar no Vercel):

| Variável | Valor |
|---------|-------|
| SUPABASE_URL | https://zgtkbnzmunxkibxybdky.supabase.co |
| SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA |
| JWT_SECRET | crm_vendas_2026_chave_jwt_producao_segura_aleatoria |

### 3. Passos para deploy:

1. Criar repositório no GitHub (nome: crm-vendas)
2. Enviar código: `git init && git add . && git commit -m "CRM Vendas" && git branch -M main && git remote add origin https://github.com/SEU_USUARIO/crm-vendas.git && git push -u origin main`
3. No Vercel: Add New → Project → Importar crm-vendas
4. Adicionar Environment Variables acima
5. Clicar Deploy
6. Acessar o link informado (ex: https://crm-vendas.vercel.app)