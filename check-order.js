const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zgtakbznmuxkibxybdky.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrder() {
  // Buscar pedido pelo número
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, numero_pedido, data, valor_total, customer_id, customers(nome)')
    .ilike('numero_pedido', '%PED2605018058%');

  if (error) {
    console.log('Erro:', error);
    return;
  }

  console.log('Pedidos encontrados:', JSON.stringify(orders, null, 2));
}

checkOrder();