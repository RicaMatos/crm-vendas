require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('ERRO: Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env');
    process.exit(1);
}

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