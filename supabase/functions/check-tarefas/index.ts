import { createClient } from 'supabase';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTarefasPendentes() {
  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data: tarefas, error } = await supabase
    .from('tasks')
    .select('id, titulo, data, prioridade, status, user_id, customer_id, customers(nome)')
    .eq('status', 'pendente')
    .lte('data', hoje);

  if (error || !tarefas) {
    console.error('Erro ao buscar tarefas:', error);
    return;
  }

  for (const tarefa of tarefas as any[]) {
    const cliente = tarefa.customers as any;
    
    // Verificar se já existe notificação similar nas últimas 24h
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

  console.log(`Verificação de tarefas: ${tarefas.length} tarefas pendentes encontradas`);
}

Deno.serve(async () => {
  await checkTarefasPendentes();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});