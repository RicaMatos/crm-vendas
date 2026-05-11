import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAniversarios() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const dataHoje = `%-${mes}-${dia}`;

  const { data: clientes, error } = await supabase
    .from('customers')
    .select('id, nome, whatsapp, user_id, data_aniversario, lembrete_aniversario')
    .eq('lembrete_aniversario', true)
    .like('data_aniversario', dataHoje);

  if (error || !clientes) {
    console.error('Erro ao buscar aniversariantes:', error);
    return;
  }

  for (const cliente of clientes as any[]) {
    // Verificar se já existe notificação hoje
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

  console.log(`Verificação de aniversários: ${clientes.length} aniversariantes encontrados`);
}

Deno.serve(async () => {
  await checkAniversarios();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});