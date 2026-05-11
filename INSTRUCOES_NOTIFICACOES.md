# Configuração das Notificações Automáticas

## Visão Geral

O sistema de notificações automáticas verifica periodicamente:
- ✅ Parcelas vencendo em 3 dias
- ✅ Parcelas vencidas hoje
- ✅ Tarefas pendentes para hoje
- ✅ Clientes fazendo aniversário hoje
- ✅ Clientes sem contato há 30+ dias

## Passo 1: Executar Migration

Execute o arquivo `supabase/migrations/create_notifications_table.sql` no SQL Editor do Supabase:

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Cole o conteúdo do arquivo
4. Execute

## Passo 2: Deploy das Edge Functions

### Opção A: Via Supabase CLI (Recomendado)

```bash
# Instalar CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Inicializar projeto na raiz (se não tiver)
cd supabase
supabase init

# Deploy das funções
supabase functions deploy check-parcelas
supabase functions deploy check-tarefas
supabase functions deploy check-aniversarios
supabase functions deploy check-followup
```

### Opção B: Via Dashboard do Supabase

1. Acesse Supabase Dashboard → Edge Functions
2. Crie cada função manualmente
3. Cole o código dos arquivos em `supabase/functions/`

## Passo 3: Configurar Agendamento (Cron)

### Via Supabase (pg_cron)

Execute no SQL Editor:

```sql
-- Agendamento: executar a cada hora
SELECT cron.schedule(
    'check-parcelas-cron',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url:='https://[SEU-PROJETO].supabase.co/functions/v1/check-parcelas',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SUA-SERVICE-KEY]"}'::jsonb
    ) AS result;
    $$
);

SELECT cron.schedule(
    'check-tarefas-cron',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url:='https://[SEU-PROJETO].supabase.co/functions/v1/check-tarefas',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SUA-SERVICE-KEY]"}'::jsonb
    ) AS result;
    $$
);

-- Aniversários: todo dia às 9h
SELECT cron.schedule(
    'check-aniversarios-cron',
    '0 9 * * *',
    $$
    SELECT net.http_post(
        url:='https://[SEU-PROJETO].supabase.co/functions/v1/check-aniversarios',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SUA-SERVICE-KEY]"}'::jsonb
    ) AS result;
    $$
);

-- Follow-up: todo dia às 10h
SELECT cron.schedule(
    'check-followup-cron',
    '0 10 * * *',
    $$
    SELECT net.http_post(
        url:='https://[SEU-PROJETO].supabase.co/functions/v1/check-followup',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SUA-SERVICE-KEY]"}'::jsonb
    ) AS result;
    $$
);
```

**Nota:** Substitua `[SEU-PROJETO]` e `[SUA-SERVICE-KEY]` pelos valores corretos.

### Alternativa: Sem Cron (Manual)

As Edge Functions podem ser chamadas manualmente ou via webhooks externos (like Zapier, Make.com).

## Variáveis de Ambiente Necessárias

No Supabase Dashboard → Edge Functions → Settings, adicione:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-key
```

## Estrutura das Notificações

| Tipo | Trigger | Ação |
|------|---------|------|
| `parcela_vencendo` | Parcela vence em até 3 dias | Notifica vendedor |
| `parcela_vencida` | Parcela vence hoje | Notifica vendedor (urgente) |
| `tarefa_pendente` | Data da tarefa <= hoje | Notifica vendedor |
| `aniversario` | Data aniversário = hoje | Notifica vendedor |
| `followup` | Cliente sem interação 30+ dias | Notifica vendedor |

## Testando as Edge Functions

```bash
# Testar manualmente (via curl)
curl -X POST "https://[SEU-PROJETO].supabase.co/functions/v1/check-parcelas" \
  -H "Authorization: Bearer [SUA-SERVICE-KEY]" \
  -H "Content-Type: application/json"
```

## Resolução de Problemas

### Verificar logs
Supabase Dashboard → Edge Functions → Logs

### Verificar agendamentos ativos
```sql
SELECT * FROM cron.job;
```

### Remover agendamento
```sql
SELECT cron.unschedule('check-parcelas-cron');
```