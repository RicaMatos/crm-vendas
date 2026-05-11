# Edge Functions - Código Completo

## Como usar:
1. Acesse: https://supabase.com/dashboard/project/zgtakbznmuxkibxybdky/functions
2. Clique em "New Function"
3. Nomeie a função
4. Cole o código
5. Em Settings, adicione as variáveis de ambiente

---

## Variáveis de Ambiente (Settings → Environment Variables)
```
SUPABASE_URL=https://zgtakbznmuxkibxybdky.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA
```

---

## 1. check-parcelas

```typescript
import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParcelasVencendo() {
  const hoje = new Date();
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, user_id, customer_id, valor_total, parcelas_detalhes, customers(nome, whatsapp)')
    .eq('status_pagamento', 'pendente');

  if (!orders) return;

  for (const order of orders) {
    const parcelas = (order.parcelas_detalhes as any[]) || [];
    const cliente = order.customers as any;

    for (const parcela of parcelas) {
      if (parcela.status === 'pago' || !parcela.vencimento) continue;

      const dataVencimento = new Date(parcela.vencimento);
      const diasDiff = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      if (diasDiff >= 0 && diasDiff <= 3) {
        const tipo = diasDiff === 0 ? 'parcela_vencida' : 'parcela_vencendo';
        const urgencia = diasDiff === 0 ? '⚠️' : '📅';
        
        const { data: existente } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', order.user_id)
          .eq('referencia_id', order.id)
          .eq('tipo', tipo)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existente?.length) {
          await supabase.from('notifications').insert({
            user_id: order.user_id,
            titulo: `${urgencia} Parcela ${tipo === 'parcela_vencida' ? 'vencida' : 'vence em ' + diasDiff + ' dias'}`,
            mensagem: `Cliente ${cliente?.nome || 'N/A'}: Parcela R$ ${parcela.valor}`,
            tipo: tipo,
            referencia_id: order.id,
            referencia_tipo: 'order'
          });
        }
      }
    }
  }
}

Deno.serve(async () => {
  await checkParcelasVencendo();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 2. check-tarefas

```typescript
import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTarefasPendentes() {
  const hoje = new Date().toISOString().split('T')[0];

  const { data: tarefas } = await supabase
    .from('tasks')
    .select('id, titulo, data, prioridade, status, user_id, customer_id, customers(nome)')
    .eq('status', 'pendente')
    .lte('data', hoje);

  if (!tarefas) return;

  for (const tarefa of tarefas as any[]) {
    const cliente = tarefa.customers as any;
    
    const { data: existente } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', tarefa.user_id)
      .eq('referencia_id', tarefa.id)
      .eq('tipo', 'tarefa_pendente')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (!existente?.length) {
      const prioridadeIcon = tarefa.prioridade === 'alta' ? '🔴' : tarefa.prioridade === 'media' ? '🟡' : '🟢';
      
      await supabase.from('notifications').insert({
        user_id: tarefa.user_id,
        titulo: `${prioridadeIcon} Tarefa pendente: ${tarefa.titulo}`,
        mensagem: cliente?.nome ? `Cliente: ${cliente.nome}` : 'Sem cliente associado',
        tipo: 'tarefa_pendente',
        referencia_id: tarefa.id,
        referencia_tipo: 'task'
      });
    }
  }
}

Deno.serve(async () => {
  await checkTarefasPendentes();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 3. check-aniversarios

```typescript
import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAniversarios() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const dataHoje = `%-${mes}-${dia}`;

  const { data: clientes } = await supabase
    .from('customers')
    .select('id, nome, whatsapp, user_id, data_aniversario, lembrete_aniversario')
    .eq('lembrete_aniversario', true)
    .like('data_aniversario', dataHoje);

  if (!clientes) return;

  for (const cliente of clientes as any[]) {
    const { data: existente } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', cliente.user_id)
      .eq('referencia_id', cliente.id)
      .eq('tipo', 'aniversario')
      .gte('created_at', new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString())
      .limit(1);

    if (!existente?.length) {
      await supabase.from('notifications').insert({
        user_id: cliente.user_id,
        titulo: '🎂 Cliente faz aniversário hoje!',
        mensagem: `${cliente.nome} está fazendo aniversário hoje. Que tal enviar uma mensagem?`,
        tipo: 'aniversario',
        referencia_id: cliente.id,
        referencia_tipo: 'customer'
      });
    }
  }
}

Deno.serve(async () => {
  await checkAniversarios();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 4. check-followup

```typescript
import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DIAS_SEM_CONTATO = 30;

async function checkFollowup() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DIAS_SEM_CONTATO);

  const { data: clientes } = await supabase
    .from('customers')
    .select('id, nome, status, user_id')
    .in('status', ['Lead', 'Prospect', 'Cliente']);

  if (!clientes) return;

  for (const cliente of clientes as any[]) {
    const { data: ultimaInteracao } = await supabase
      .from('interactions')
      .select('created_at')
      .eq('customer_id', cliente.id)
      .eq('user_id', cliente.user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    let precisaContato = true;

    if (ultimaInteracao?.length) {
      const dataUltima = new Date(ultimaInteracao[0].created_at);
      if (dataUltima >= cutoffDate) {
        precisaContato = false;
      }
    }

    if (precisaContato) {
      const { data: existente } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', cliente.user_id)
        .eq('referencia_id', cliente.id)
        .eq('tipo', 'followup')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existente?.length) {
        await supabase.from('notifications').insert({
          user_id: cliente.user_id,
          titulo: '📞 Cliente sem contato há +30 dias',
          mensagem: `${cliente.nome} (${cliente.status}) não é contactado há mais de ${DIAS_SEM_CONTATO} dias.`,
          tipo: 'followup',
          referencia_id: cliente.id,
          referencia_tipo: 'customer'
        });
      }
    }
  }
}

Deno.serve(async () => {
  await checkFollowup();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## Para testar manualmente:

Após criar cada função, teste no navegador:
```
https://zgtakbznmuxkibxybdky.supabase.co/functions/v1/check-parcelas
https://zgtakbznmuxkibxybdky.supabase.co/functions/v1/check-tarefas
https://zgtakbznmuxkibxybdky.supabase.co/functions/v1/check-aniversarios
https://zgtakbznmuxkibxybdky.supabase.co/functions/v1/check-followup
```