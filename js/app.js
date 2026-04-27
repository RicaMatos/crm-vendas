import { auth } from './auth.js';
import { ui } from './ui-core.js';
import { store } from './store.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('CRM Vendas Senior - Inicializando...');
    
    // Verifica se o usuário está autenticado
    if (auth.isAuthenticated()) {
        console.log('Usuário autenticado. Carregando dados do servidor...');
        try {
            await store.fetchAll();
            console.log('Dados carregados. Renderizando Dashboard...');
            ui.renderDashboard();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            ui.renderLogin('Sua sessão expirou. Por favor, faça login novamente.');
            auth.logout();
        }
    } else {
        console.log('Usuário não autenticado. Carregando Login...');
        ui.renderLogin();
    }
});

// Expõe objetos para uso global (necessário temporariamente por causa do onClick HTML inline)
window.auth = auth;
window.store = store;
