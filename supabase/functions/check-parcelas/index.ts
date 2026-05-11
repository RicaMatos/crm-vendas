import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Parcela {
  id: number;
  valor: number;
  vencimento: string;
  numero_parcela: number;
  status: string;
  customer_id: number;
  user_id: string;
  nome_cliente: string;
  whatsapp: string;
  order_id: number;
}

async function checkParcelasVencendo() {
  const hoje = new Date();
  const tresDias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, user_id, customer_id, valor_total, parcelas_detalhes, customers(nome, whatsapp)')
    .eq('status_pagamento', 'pendente');

  if (error || !orders) {
    console.error('Erro ao buscar orders:', error);
    return;
  }

  const notificacoes: Array<{userId: string, titulo: string, mensagem: string, tipo: string, refId: number, refTipo: string}> = [];

  for (const order of orders) {
    const parcelas = order.parcelas_detalhes as Array<any> || [];
    const cliente = order.customers as any;

    for (const parcela of parcelas) {
      if (parcela.status === 'pago' || !parcela.vencimento) continue;

      const dataVencimento = new Date(parcela.vencimento);
      const diasDiff = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      // Parcela vence em até 3 dias - notificar
      if (diasDiff >= 0 && diasDiff <= 3) {
        const tipo = diasDiff === 0 ? 'parcela_vencida' : 'parcela_vencendo';
        const urgencia = diasDiff === 0 ? '⚠️' : '📅';
        
        notificacoes.push({
          userId: order.user_id,
          titulo: `${urgencia} Parcela ${tipo === 'parcela_vencida' ? 'vencida' : 'vence em ' + diasDiff + ' dias'}`,
          mensagem: `Cliente ${cliente?.nome || 'N/A'}: Parcela R$ ${parcela.valor} (${parcela.numero_parcela}/${order.parcelas_detailed?.length || 'X'})`,
          tipo: tipo,
          refId: order.id,
          refTipo: 'order'
        });
      }
    }
  }

  // Criar notificações (evitar duplicatas)
  for (const notif of notificacoes) {
    // Verificar se já existe notificação similar nas últimas 24h
    const { data: existente } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', notif.userId)
      .eq('referencia_id', notif.refId)
      .eq('tipo', notif.tipo)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (!existente?.length) {
      await supabase.from('notifications').insert({
        user_id: notif.userId,
        titulo: notif.titulo,
        mensagem: notif.mensagem,
        tipo: notif.tipo,
        referencia_id: notif.refId,
        referencia_tipo: notif.refTipo
      });
    }
  }

  console.log(`Verificação de parcelas: ${notificacoes.length} notificações criadas/existentes`);
}

Deno.serve(async () => {
  await checkParcelasVencendo();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});