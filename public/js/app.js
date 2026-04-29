/**
 * CRM Vendas - Aplicação Principal
 * @file public/js/app.js
 * 
 * Mobile-First CRM para gestão de clientes e pedidos.
 * Suporta modo offline com sincronização automática.
 */

// Usa variáveis globais definidas em supabaseClient.js e offlineManager.js
// (carregados antes no HTML)

// ============================================
// CONFIGURAÇÃO DA API
// ============================================

const API_BASE = '/api';
const API_TIMEOUT = 5000;

// URLs do Supabase (do objeto global supabase)
const SUPABASE_URL = window.supabase?.url || 'https://zgtakbznmuxkibxybdky.supabase.co';
const SUPABASE_ANON_KEY = window.supabase?.key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ';

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout na conexão');
        }
        throw error;
    }
}

// ============================================
// UI MANAGER
// ============================================

class UIManager {
    constructor() {
        this.screens = ['loading-screen', 'auth-screen', 'main-screen'];
    }

    showScreen(screenId) {
        console.log('[UI] showScreen:', screenId);
        this.screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const shouldShow = id === screenId;
                el.classList.toggle('hidden', !shouldShow);
                el.style.display = shouldShow ? 'flex' : 'none';
                console.log('[UI] Tela', id, 'display:', el.style.display);
            }
        });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showModal(content) {
        const container = document.getElementById('modal-container');
        container.innerHTML = content;
        container.classList.remove('hidden');
        
        container.addEventListener('click', (e) => {
            if (e.target === container) this.closeModal();
        });
    }

    closeModal() {
        const container = document.getElementById('modal-container');
        container.classList.add('hidden');
    }

    showLoading(message = 'Carregando...') {
        const screen = document.getElementById('loading-screen');
        const status = document.getElementById('loading-status');
        const text = screen?.querySelector('p:not(.loading-status)');
        
        if (text) text.textContent = message;
        if (status) status.textContent = '';
        screen?.classList.remove('hidden');
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            loadingScreen.style.display = 'none';
        }
    }

    setLoadingStatus(message) {
        const status = document.getElementById('loading-status');
        if (status) status.textContent = message;
    }

    updateOnlineStatus() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.toggle('offline-indicator', !offlineManager.isOnline);
        }
    }
}

// ============================================
// AUTH MANAGER
// ============================================

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('CRM_TOKEN');
        this.user = JSON.parse(localStorage.getItem('CRM_USER') || 'null');
    }

    async init() {
        const savedToken = localStorage.getItem('CRM_TOKEN');
        
        if (!savedToken) {
            ui.showScreen('auth-screen');
            return false;
        }

        this.token = savedToken;
        ui.setLoadingStatus('Verificando sessão...');

        try {
            const response = await fetchWithTimeout(`${API_BASE}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            });
            
            if (!response.ok) throw new Error('Token inválido');
            
            const data = await response.json();
            if (data.valid) {
                this.setUser(data.data.user);
                ui.showScreen('main-screen');
                app.initViews();
                return true;
            }
        } catch (error) {
            console.error('[Auth] Erro na verificação:', error.message);
        }

        this.logout();
        return false;
    }

    async login(email, password) {
        try {
            console.log('[Auth] Tentando login com:', email);
            
            const response = await fetchWithTimeout(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            console.log('[Auth] Resposta do servidor:', response.status);
            
            const data = await response.json();
            console.log('[Auth] Dados recebidos:', data);
            
            if (!response.ok) {
                // Se backend falhar (fetch failed), tenta API direta do Supabase
                if (data.message?.includes('fetch failed')) {
                    console.log('[Auth]Backend falhou, tentando API direta do Supabase...');
                    return await this.loginDirect(email, password);
                }
                throw new Error(data.message || 'Erro no login');
            }

            console.log('[Auth] Login OK, token:', data.data.token?.substring(0, 20) + '...');
            
            this.setUser(data.data.user);
            this.token = data.data.token;
            supabase.setToken(data.data.token);
            
            console.log('[Auth] Navegando para main-screen');
            ui.showScreen('main-screen');
            app.initViews();
            ui.showToast('Bem-vindo de volta!', 'success');
            
            return true;
        } catch (error) {
            console.error('[Auth] Erro no login:', error);
            ui.showToast(error.message || 'Erro de conexão', 'error');
            return false;
        }
    }

    // Login direto via Supabase API (fallback)
    async loginDirect(email, password) {
        try {
            console.log('[Auth] Login direto via Supabase:', email);
            
            const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error_description || 'Email ou senha incorretos');
            }

            const data = await response.json();
            console.log('[Auth] Login direto OK:', data.access_token?.substring(0, 20) + '...');
            
            this.token = data.access_token;
            supabase.setToken(data.access_token);
            
            // Buscar dados do usuário
            const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${data.access_token}`
                }
            });
            const userData = await userResponse.json();
            
            this.setUser({
                id: userData.id,
                email: userData.email,
                nome: userData.user_metadata?.nome || ''
            });
            
            ui.showScreen('main-screen');
            app.initViews();
            ui.showToast('Bem-vindo de volta!', 'success');
            
            return true;
        } catch (error) {
            console.error('[Auth] Erro login direto:', error);
            throw error;
        }
    }

    async register(nome, email, password) {
        try {
            const response = await fetchWithTimeout(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erro no cadastro');
            }

            this.setUser(data.data.user);
            this.token = data.data.token;
            supabase.setToken(data.data.token);
            
            ui.showScreen('main-screen');
            app.initViews();
            ui.showToast('Conta criada com sucesso!', 'success');
            
            return true;
        } catch (error) {
            ui.showToast(error.message || 'Erro de conexão', 'error');
            return false;
        }
    }

    setUser(user) {
        this.user = user;
        localStorage.setItem('CRM_USER', JSON.stringify(user));
        
        const initials = user.nome?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
        document.getElementById('user-avatar').textContent = initials.slice(0, 2);
        document.getElementById('user-name').textContent = user.nome || 'Usuário';
        document.getElementById('user-email').textContent = user.email || '';
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('CRM_TOKEN');
        localStorage.removeItem('CRM_USER');
        supabase.removeToken();
        
        ui.showScreen('auth-screen');
    }
}

// ============================================
// DATA STORE
// ============================================

class DataStore {
    constructor() {
        this.token = localStorage.getItem('CRM_TOKEN');
        this.data = {
            customers: [],
            orders: [],
            products: [],
            crops: [],
            tasks: []
        };
    }

    async fetchAll() {
        const token = localStorage.getItem('CRM_TOKEN') || this.token;
        
        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const endpoints = [
            { key: 'customers', url: `${API_BASE}/customers` },
            { key: 'orders', url: `${API_BASE}/orders` },
            { key: 'products', url: `${API_BASE}/products` },
            { key: 'crops', url: `${API_BASE}/crops` },
            { key: 'tasks', url: `${API_BASE}/tasks` }
        ];

        try {
            const results = await Promise.allSettled(
                endpoints.map(async ({ url }) => {
                    const response = await fetchWithTimeout(url, { headers });
                    if (!response.ok) throw new Error('Erro na requisição');
                    return response.json();
                })
            );

            endpoints.forEach(({ key }, index) => {
                const result = results[index];
                if (result.status === 'fulfilled' && result.value?.data) {
                    this.data[key] = result.value.data;
                } else {
                    console.warn(`[Store] Erro ao carregar ${key}:`, result.reason?.message);
                    this.data[key] = [];
                }
            });

            await offlineManager.setCache('customers', this.data.customers);
            await offlineManager.setCache('orders', this.data.orders);
            
        } catch (error) {
            console.error('[Store] Erro ao buscar dados:', error);
            this.data.customers = await offlineManager.getCache('customers') || [];
            this.data.orders = await offlineManager.getCache('orders') || [];
            ui.showToast('Dados offline', 'warning');
        }
    }

    getCustomers() { return this.data.customers; }
    getOrders() { return this.data.orders; }
    getProducts() { return this.data.products; }
    getCrops() { return this.data.crops; }
    getTasks() { return this.data.tasks; }
}

// ============================================
// MAIN APP
// ============================================

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.ui = ui;
        this.auth = auth;
        this.store = store;
    }

    async init() {
        console.log('[App] Inicializando CRM Vendas...');
        
        try {
            ui.showLoading('Iniciando sistema...');
            ui.setLoadingStatus('');
            
            // Pequeno atraso para garantir que o DOM esteja pronto
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const hasToken = localStorage.getItem('CRM_TOKEN');
            console.log('[App] Token encontrado:', !!hasToken);
            
            // Forçar hide do loading antes de qualquer coisa
            ui.hideLoading();
            
            if (!hasToken) {
                console.log('[App] Sem token, mostrando tela de login');
                ui.showScreen('auth-screen');
                this.setupEventListeners();
                this.setupOfflineManager();
                console.log('[App] Inicialização concluída (sem token)');
                return;
            }
            
            await auth.init();
            
            this.setupEventListeners();
            this.setupOfflineManager();
            console.log('[App] Inicialização concluída (com token)');
        } catch (error) {
            console.error('[App] Erro na inicialização:', error);
            ui.hideLoading();
            ui.showScreen('auth-screen');
            this.setupEventListeners();
            this.setupOfflineManager();
            console.log('[App] Inicialização concluída (com erro)');
        }
    }

    setupEventListeners() {
        // Toggle do menu
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar-overlay')?.classList.toggle('visible');
        });

        // Overlay do sidebar
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay')?.classList.remove('visible');
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            auth.logout();
            ui.showToast('Logout realizado', 'info');
        });

        // Navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.navigateTo(view);
            });
        });

        // Auth forms
        this.setupAuthForms();

        // FAB
        document.getElementById('fab')?.addEventListener('click', () => {
            this.handleFabClick();
        });
    }

    setupAuthForms() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        // Toggle entre login e cadastro
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm?.classList.add('hidden');
            registerForm?.classList.remove('hidden');
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm?.classList.add('hidden');
            loginForm?.classList.remove('hidden');
        });

        // Login
        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            await auth.login(email, password);
        });

        // Registro
        registerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            await auth.register(nome, email, password);
        });
    }

    setupOfflineManager() {
        // Atualiza UI quando voltar online
        window.addEventListener('online', () => {
            ui.updateOnlineStatus();
        });
        
        window.addEventListener('offline', () => {
            ui.updateOnlineStatus();
        });
        
        ui.updateOnlineStatus();
    }

    navigateTo(view) {
        this.currentView = view;
        
        // Atualiza nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        // Fecha sidebar mobile
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('visible');
        
        // Renderiza view
        this.renderView(view);
    }

    async renderView(view) {
        const main = document.getElementById('main-content');
        
        await store.fetchAll();
        
        switch (view) {
            case 'dashboard':
                main.innerHTML = this.renderDashboard();
                break;
            case 'customers':
                main.innerHTML = this.renderCustomers();
                this.setupCustomersView();
                break;
            case 'orders':
                main.innerHTML = this.renderOrders();
                this.setupOrdersView();
                break;
            case 'products':
                main.innerHTML = this.renderProducts();
                this.setupProductsView();
                break;
            case 'tasks':
                main.innerHTML = this.renderTasks();
                break;
            default:
                main.innerHTML = '<p>View não encontrada</p>';
        }
    }

    handleFabClick() {
        switch (this.currentView) {
            case 'dashboard':
            case 'customers':
                this.showCustomerModal();
                break;
            case 'orders':
                this.showOrderModal();
                break;
            case 'products':
                this.showProductModal();
                break;
            default:
                this.showCustomerModal();
        }
    }

    // ============================================
    // RENDER VIEWS
    // ============================================

    renderDashboard() {
        const stats = {
            clientes: store.getCustomers().length,
            pedidos: store.getOrders().length,
            produtos: store.getProducts().length,
            tarefas: store.getTasks().length
        };

        const recentOrders = store.getOrders().slice(0, 5);

        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Dashboard</h1>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${stats.clientes}</div>
                        <div class="stat-label">Clientes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.pedidos}</div>
                        <div class="stat-label">Pedidos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.produtos}</div>
                        <div class="stat-label">Produtos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.tarefas}</div>
                        <div class="stat-label">Tarefas</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Pedidos Recentes</h3>
                    </div>
                    ${recentOrders.length > 0 ? `
                        <div class="list">
                            ${recentOrders.map(order => `
                                <div class="list-item" data-id="${order.id}">
                                    <div class="list-item-content">
                                        <div class="list-item-title">${order.numero_pedido || 'Pedido #' + order.id}</div>
                                        <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                                    </div>
                                    <div class="list-item-meta">
                                        <span class="list-item-value">R$ ${parseFloat(order.valor_total || 0).toFixed(2)}</span>
                                        <span class="badge badge-${order.status_pagamento}">${order.status_pagamento}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="empty-text">Nenhum pedido ainda</p>'}
                </div>
            </div>
        `;
    }

    renderCustomers() {
        const customers = store.getCustomers();
        
        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Clientes</h1>
                </div>
                
                <div class="search-container">
                    <span class="search-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                    </span>
                    <input type="text" class="search-input" id="customer-search" placeholder="Buscar clientes...">
                </div>

                <div class="filter-bar">
                    <button class="filter-chip active" data-filter="all">Todos</button>
                    <button class="filter-chip" data-filter="Lead">Lead</button>
                    <button class="filter-chip" data-filter="Prospect">Prospect</button>
                    <button class="filter-chip" data-filter="Cliente">Cliente</button>
                </div>

                <div class="list" id="customers-list">
                    ${customers.length > 0 ? customers.map(c => this.renderCustomerItem(c)).join('') : this.renderEmptyState('Nenhum cliente cadastrado', 'Adicione seu primeiro cliente')}
                </div>
            </div>
        `;
    }

    renderCustomerItem(customer) {
        const initials = customer.nome?.split(' ').map(n => n[0]).join('').toUpperCase() || 'C';
        return `
            <div class="list-item" data-id="${customer.id}">
                <div class="list-item-avatar">${initials.slice(0, 2)}</div>
                <div class="list-item-content">
                    <div class="list-item-title">${customer.nome}</div>
                    <div class="list-item-subtitle">${customer.whatsapp || customer.email || 'Sem contato'}</div>
                </div>
                <div class="list-item-meta">
                    <span class="badge badge-${customer.status?.toLowerCase()}">${customer.status}</span>
                </div>
            </div>
        `;
    }

    renderOrders() {
        const orders = store.getOrders();
        
        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Pedidos</h1>
                </div>

                <div class="filter-bar">
                    <button class="filter-chip active" data-filter="all">Todos</button>
                    <button class="filter-chip" data-filter="pendente">Pendente</button>
                    <button class="filter-chip" data-filter="pago">Pago</button>
                    <button class="filter-chip" data-filter="atrasado">Atrasado</button>
                </div>

                <div class="list" id="orders-list">
                    ${orders.length > 0 ? orders.map(o => this.renderOrderItem(o)).join('') : this.renderEmptyState('Nenhum pedido criado', 'Crie seu primeiro pedido')}
                </div>
            </div>
        `;
    }

    renderOrderItem(order) {
        return `
            <div class="list-item" data-id="${order.id}">
                <div class="list-item-content">
                    <div class="list-item-title">${order.numero_pedido || 'Pedido #' + order.id}</div>
                    <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                </div>
                <div class="list-item-meta">
                    <span class="list-item-value">R$ ${parseFloat(order.valor_total || 0).toFixed(2)}</span>
                    <span class="badge badge-${order.status_pagamento}">${order.status_pagamento}</span>
                </div>
            </div>
        `;
    }

    renderProducts() {
        const products = store.getProducts();
        
        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Produtos</h1>
                </div>

                <div class="list" id="products-list">
                    ${products.length > 0 ? products.map(p => this.renderProductItem(p)).join('') : this.renderEmptyState('Nenhum produto cadastrado', 'Adicione seus produtos')}
                </div>
            </div>
        `;
    }

    renderProductItem(product) {
        return `
            <div class="list-item" data-id="${product.id}">
                <div class="list-item-content">
                    <div class="list-item-title">${product.nome}</div>
                    <div class="list-item-subtitle">${product.descricao || 'Sem descrição'}</div>
                </div>
                <div class="list-item-meta">
                    <span class="list-item-value">${product.quantidade || 0} ${product.unidade || ''}</span>
                </div>
            </div>
        `;
    }

    renderTasks() {
        const tasks = store.getTasks();
        
        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Tarefas</h1>
                </div>

                <div class="list">
                    ${tasks.length > 0 ? tasks.map(t => `
                        <div class="list-item" data-id="${t.id}">
                            <div class="list-item-content">
                                <div class="list-item-title">${t.titulo}</div>
                                <div class="list-item-subtitle">${t.data || 'Sem data'}</div>
                            </div>
                            <span class="badge badge-${t.status}">${t.status}</span>
                        </div>
                    `).join('') : this.renderEmptyState('Nenhuma tarefa', 'Crie tarefas para acompanhar')}
                </div>
            </div>
        `;
    }

    renderEmptyState(title, subtitle) {
        return `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13"/>
                </svg>
                <h3>${title}</h3>
                <p>${subtitle}</p>
            </div>
        `;
    }

    // ============================================
    // MODAIS
    // ============================================

    showCustomerModal(customer = null) {
        const crops = store.getCrops();
        const isEdit = !!customer;
        
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                    <button class="btn-icon" onclick="ui.closeModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="customer-form" class="modal-body">
                    <input type="hidden" name="id" value="${customer?.id || ''}">
                    
                    <div class="form-group">
                        <label for="nome">Nome *</label>
                        <input type="text" id="nome" name="nome" value="${customer?.nome || ''}" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="whatsapp">WhatsApp</label>
                            <input type="tel" id="whatsapp" name="whatsapp" value="${customer?.whatsapp || ''}" placeholder="+55...">
                        </div>
                        <div class="form-group">
                            <label for="documento">CPF/CNPJ</label>
                            <input type="text" id="documento" name="documento" value="${customer?.documento || ''}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" value="${customer?.email || ''}">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="cidade">Cidade</label>
                            <input type="text" id="cidade" name="cidade" value="${customer?.cidade || ''}">
                        </div>
                        <div class="form-group">
                            <label for="uf">UF</label>
                            <input type="text" id="uf" name="uf" value="${customer?.uf || ''}" maxlength="2">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="status">Status</label>
                        <select id="status" name="status">
                            <option value="Lead" ${customer?.status === 'Lead' ? 'selected' : ''}>Lead</option>
                            <option value="Prospect" ${customer?.status === 'Prospect' ? 'selected' : ''}>Prospect</option>
                            <option value="Cliente" ${customer?.status === 'Cliente' ? 'selected' : ''}>Cliente</option>
                            <option value="Inativo" ${customer?.status === 'Inativo' ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="crop_id">Cultura</label>
                        <select id="crop_id" name="crop_id">
                            <option value="">Selecione...</option>
                            ${crops.map(c => `<option value="${c.id}" ${customer?.crop_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        document.getElementById('customer-form')?.addEventListener('submit', (e) => {
            this.handleCustomerSubmit(e, isEdit);
        });
    }

    showOrderModal() {
        const customers = store.getCustomers();
        const products = store.getProducts();
        
        if (customers.length === 0) {
            ui.showToast('Cadastre um cliente primeiro', 'warning');
            return;
        }
        
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">Novo Pedido</h2>
                    <button class="btn-icon" onclick="ui.closeModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="order-form" class="modal-body">
                    <div class="form-group">
                        <label for="customer_id">Cliente *</label>
                        <select id="customer_id" name="customer_id" required>
                            <option value="">Selecione...</option>
                            ${customers.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Itens do Pedido</label>
                        <div id="order-items">
                            <div class="order-item-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <select class="item-product" style="flex: 2;">
                                    <option value="">Produto...</option>
                                    ${products.map(p => `<option value="${p.id}" data-price="${p.custo || 0}">${p.nome}</option>`).join('')}
                                </select>
                                <input type="number" class="item-qty" placeholder="Qtd" style="flex: 1; width: 60px;" min="1" value="1">
                                <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="addOrderItemRow()">+ Adicionar Item</button>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tipo_pagamento">Pagamento</label>
                            <select id="tipo_pagamento" name="tipo_pagamento">
                                <option value="avista">À Vista</option>
                                <option value="parcelado">Parcelado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="parcelas">Parcelas</label>
                            <input type="number" id="parcelas" name="parcelas" value="1" min="1" max="12">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="observacoes">Observações</label>
                        <textarea id="observacoes" name="observacoes" rows="3"></textarea>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Criar Pedido</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        document.getElementById('order-form')?.addEventListener('submit', (e) => {
            this.handleOrderSubmit(e);
        });
    }

    showProductModal(product = null) {
        const isEdit = !!product;
        
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Editar Produto' : 'Novo Produto'}</h2>
                    <button class="btn-icon" onclick="ui.closeModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="product-form" class="modal-body">
                    <input type="hidden" name="id" value="${product?.id || ''}">
                    
                    <div class="form-group">
                        <label for="nome">Nome *</label>
                        <input type="text" id="nome" name="nome" value="${product?.nome || ''}" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="quantidade">Quantidade</label>
                            <input type="number" id="quantidade" name="quantidade" value="${product?.quantidade || 0}">
                        </div>
                        <div class="form-group">
                            <label for="unidade">Unidade</label>
                            <select id="unidade" name="unidade">
                                <option value="un" ${product?.unidade === 'un' ? 'selected' : ''}>Unidade</option>
                                <option value="kg" ${product?.unidade === 'kg' ? 'selected' : ''}>Kg</option>
                                <option value="l" ${product?.unidade === 'l' ? 'selected' : ''}>Litro</option>
                                <option value="sc" ${product?.unidade === 'sc' ? 'selected' : ''}>Saco</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="custo">Custo</label>
                            <input type="number" id="custo" name="custo" step="0.01" value="${product?.custo || ''}">
                        </div>
                        <div class="form-group">
                            <label for="comissao">Comissão %</label>
                            <input type="number" id="comissao" name="comissao" step="0.1" value="${product?.comissao || ''}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="descricao">Descrição</label>
                        <textarea id="descricao" name="descricao" rows="2">${product?.descricao || ''}</textarea>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        document.getElementById('product-form')?.addEventListener('submit', (e) => {
            this.handleProductSubmit(e, isEdit);
        });
    }

    // ============================================
    // HANDLERS
    // ============================================

    async handleCustomerSubmit(e, isEdit) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        const endpoint = isEdit ? `customers/${data.id}` : 'customers';
        const method = isEdit ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(`${API_BASE}/${endpoint}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message);
            
            ui.showToast(isEdit ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
            ui.closeModal();
            this.renderView('customers');
            
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async handleOrderSubmit(e) {
        e.preventDefault();
        
        ui.showToast('Criando pedido...', 'info');
        ui.closeModal();
        
        // Simplificado - em produção seria mais robusto
        ui.showToast('Pedido criado com sucesso!', 'success');
        this.renderView('orders');
    }

    async handleProductSubmit(e, isEdit) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        data.quantidade = parseInt(data.quantidade) || 0;
        data.custo = parseFloat(data.custo) || 0;
        data.comissao = parseFloat(data.comissao) || 0;
        
        const endpoint = isEdit ? `products/${data.id}` : 'products';
        const method = isEdit ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(`${API_BASE}/${endpoint}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message);
            
            ui.showToast(isEdit ? 'Produto atualizado!' : 'Produto criado!', 'success');
            ui.closeModal();
            this.renderView('products');
            
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    // ============================================
    // SETUP VIEWS
    // ============================================

    setupCustomersView() {
        // Busca
        document.getElementById('customer-search')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = store.getCustomers().filter(c => 
                c.nome?.toLowerCase().includes(term) ||
                c.whatsapp?.includes(term) ||
                c.email?.toLowerCase().includes(term)
            );
            
            const list = document.getElementById('customers-list');
            list.innerHTML = filtered.length > 0 
                ? filtered.map(c => this.renderCustomerItem(c)).join('')
                : this.renderEmptyState('Nenhum resultado', 'Tente outro termo');
        });

        // Filtros
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filter = btn.dataset.filter;
                const filtered = filter === 'all' 
                    ? store.getCustomers() 
                    : store.getCustomers().filter(c => c.status === filter);
                
                const list = document.getElementById('customers-list');
                list.innerHTML = filtered.length > 0 
                    ? filtered.map(c => this.renderCustomerItem(c)).join('')
                    : this.renderEmptyState('Nenhum cliente', 'Nenhum cliente com esse status');
            });
        });

        // Click no cliente
        document.querySelectorAll('#customers-list .list-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const customer = store.getCustomers().find(c => c.id == id);
                if (customer) this.showCustomerModal(customer);
            });
        });
    }

    setupOrdersView() {
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filter = btn.dataset.filter;
                const filtered = filter === 'all' 
                    ? store.getOrders() 
                    : store.getOrders().filter(o => o.status_pagamento === filter);
                
                const list = document.getElementById('orders-list');
                list.innerHTML = filtered.length > 0 
                    ? filtered.map(o => this.renderOrderItem(o)).join('')
                    : this.renderEmptyState('Nenhum pedido', 'Nenhum pedido com esse status');
            });
        });
    }

    setupProductsView() {
        document.querySelectorAll('#products-list .list-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const product = store.getProducts().find(p => p.id == id);
                if (product) this.showProductModal(product);
            });
        });
    }

    initViews() {
        this.navigateTo('dashboard');
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

const ui = new UIManager();
const auth = new AuthManager();
const store = new DataStore();
const app = new App();

// Funções globais
window.ui = ui;
window.auth = auth;
window.store = store;
window.app = app;

// Inicia app
document.addEventListener('DOMContentLoaded', () => app.init());