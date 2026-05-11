require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log('🚀 Setup de Notificações\n');
    console.log('📡 Testando conexão...');

    const { error: testError } = await supabase.from('customers').select('id').limit(1);
    if (testError) {
        console.error('❌ Erro de conexão:', testError.message);
        process.exit(1);
    }
    console.log('✅ Supabase conectado\n');

    console.log('📦 Verificando tabela notifications...');
    const { data: notifData } = await supabase.from('notifications').select('id').limit(1);
    if (notifData !== null || notifData?.length === 0) {
        console.log('   ✅ Tabela notifications existe');
    } else {
        console.log('   ❌ Tabela notifications não existe');
        console.log('\n📝 Execute o SQL manualmente:');
        console.log('   supabase/migrations/create_notifications_table.sql');
    }

    console.log('\n✅ Verificação concluída!');
    console.log('\n📋 Para completar o setup manualmente:');
    console.log('   1. SQL: supabase/migrations/create_notifications_table.sql');
    console.log('   2. Edge Functions: supabase/functions/*.ts');
    console.log('   3. Cron: INSTRUCOES_NOTIFICACOES.md');
}

main().catch(e => console.error('❌ Erro:', e.message));