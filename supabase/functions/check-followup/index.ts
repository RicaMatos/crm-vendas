import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DIAS_SEM_CONTATO = 30;

async function checkFollowup() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DIAS_SEM_CONTATO);

  // Buscar clientes ativos (Lead, Prospect, Cliente)
  const { data: clientes, error } = await supabase
    .from('customers')
    .select('id, nome, status, user_id')
    .in('status', ['Lead', 'Prospect', 'Cliente']);

  if (error || !clientes) {
    console.error('Erro ao buscar clientes:', error);
    return;
  }

  for (const cliente of clientes as any[]) {
    // Buscar última interação do cliente
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
      // Verificar se já existe notificação similar nos últimos 7 dias
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

  console.log(`Verificação de follow-up concluída`);
}

Deno.serve(async () => {
  await checkFollowup();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});