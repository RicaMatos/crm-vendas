require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey?.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        // Testar getSession
        console.log('Testando conexão com Supabase...');
        
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Erro na conexão:', error.message);
            console.error('Error:', error);
        } else {
            console.log('Conexão OK! Session:', data);
        }
        
        // Testar login simples (vai falhar mas mostra a tentativa)
        console.log('\nTestando signInWithPassword...');
        const loginResult = await supabase.auth.signInWithPassword({
            email: 'test@test.com',
            password: 'wrongpassword'
        });
        
        console.log('Resultado:', loginResult);
        
    } catch (e) {
        console.error('Erro geral:', e.message);
    }
}

testConnection();