require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('=== Debug Auth ===');
console.log('URL:', supabaseUrl);

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function testRegister() {
    console.log('\n1. Testando registro...');
    try {
        const { data, error } = await supabaseAnon.auth.signUp({
            email: 'novo@teste.com',
            password: 'teste123456',
            options: {
                data: { nome: 'Novo Usuário' }
            }
        });

        if (error) {
            console.log('Erro no registro:', error.message);
            console.log('Status:', error.status);
        } else {
            console.log('Registro OK:', data);
        }
    } catch (e) {
        console.log('Exceção:', e.message);
    }

    console.log('\n2. Testando login...');
    try {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
            email: 'novo@teste.com',
            password: 'teste123456'
        });

        if (error) {
            console.log('Erro no login:', error.message);
        } else {
            console.log('Login OK:', data.user);
        }
    } catch (e) {
        console.log('Exceção:', e.message);
    }
}

testRegister();