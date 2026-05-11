/**
 * Script para criar a tabela de notificações no Supabase
 * Uso: node scripts/setup-notifications.js
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log('🚀 Setup de Notificações do CRM Vendas\n');
    console.log('📡 Conectando ao Supabase...');

    try {
        // Testar conexão
        const { data: testData, error: testError } = await supabase
            .from('customers')
            .select('id')
            .limit(1);

        if (testError) {
            console.error('❌ Erro de conexão:', testError.message);
            process.exit(1);
        }
        console.log('✅ Conexão OK\n');

        // Criar tabela notifications
        console.log('📦 Verificando/Criando tabela notifications...');

        const { data: existingTable } = await supabase.rpc('pg_catalog.to_regclass', {
            text: 'public.notifications'
        }).catch(() => ({ data: null }));

        if (!existingTable) {
            // Criar via INSERT direto (vai falhar se já existir)
            const { error: createError } = await supabase
                .from('notifications')
                .insert({
                    id: 0,
                    user_id: '00000000-0000-0000-0000-000000000000',
                    titulo: 'TESTE',
                    mensagem: 'TESTE',
                    tipo: 'sistema'
                })
                .select()
                .catch(async (err) => {
                    if (err.message.includes('already exists') || err.code === '23505') {
                        console.log('   ✅ Tabela notifications já existe');
                        return { error: null };
                    }
                    if (err.message.includes('does not exist')) {
                        // Tabela não existe - precisamos criar
                        console.log('   📝 Tabela não existe - será criada via SQL direto');
                        return { error: { needs_create: true } };
                    }
                    return { error: err };
                });

            if (createError?.needs_create) {
                console.log('   ⚠️  Por favor, execute o SQL manualmente no Supabase Dashboard');
                console.log('      Arquivo: supabase/migrations/create_notifications_table.sql');
            }
        } else {
            console.log('   ✅ Tabela notifications já existe');
        }

        // Verificar Edge Functions
        console.log('\n⏰ Configurando Cron Jobs...');
        console.log('   ⚠️  Cron jobs precisam ser configurados no Supabase Dashboard');
        console.log('      Execute o SQL em INSTRUCOES_NOTIFICACOES.md');

        console.log('\n✅ Setup básico concluído!');
        console.log('\n📋 Próximos passos no Supabase Dashboard:');
        console.log('   1. Acesse: https://supabase.com/dashboard/project/zgtakbznmuxkibxybdky/sql');
        console.log('   2. Cole o conteúdo de supabase/migrations/create_notifications_table.sql');
        console.log('   3. Execute o SQL');
        console.log('   4. Vá em Edge Functions → Deploy as 4 funções');
        console.log('   5. Configure pg_cron para chamar as funções automaticamente');

    } catch (err) {
        console.error('\n❌ Erro:', err.message);
        process.exit(1);
    }
}

main();