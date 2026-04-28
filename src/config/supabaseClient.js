/**
 * Cliente Supabase - Configuração de Conexão
 * @module config/supabaseClient
 * 
 * Este módulo fornece cliente Supabase para operações do servidor.
 * ATENÇÃO: Usa a service_role key com acesso total ao banco.
 * NUNCA expor esta chave ao frontend!
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zgtakbznmuxkibxybdky.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NjA4MiwiZXhwIjoyMDkyNDMyMDgyfQ.rWIaVXkp8pssrrgIll_u80ezO3RFeGPz2fc514mDZCA';

/**
 * Verifica se as variáveis de ambiente estão configuradas
 */
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[supabaseClient] ERRO: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    console.error('[supabaseClient] Configure o arquivo .env baseado no .env.example');
    process.exit(1);
}

console.log('[supabaseClient] Conectando ao Supabase:', supabaseUrl);

/**
 * Cliente Supabase para operações internas do servidor
 * Tem acesso total ao banco (service_role)
 */
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    db: {
        schema: 'public'
    }
});

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ';

/**
 * Cliente Supabase para operações autenticadas (usuários)
 * Usa a anon key - respeita RLS
 */
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: {
            getItem: (key) => {
                try {
                    return localStorage.getItem(key);
                } catch (e) {
                    return null;
                }
            },
            setItem: (key, value) => {
                try {
                    localStorage.setItem(key, value);
                } catch (e) {}
            },
            removeItem: (key) => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {}
            }
        }
    },
    db: {
        schema: 'public'
    }
});

module.exports = {
    supabase,
    supabaseAnon
};