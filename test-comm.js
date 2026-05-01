const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zgtakbznmuxkibxybdky.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  // Listar tabelas públicas
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'orders' });
  console.log('Result:', data, error);
}

checkTables();