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

// ============================================
// VALIDAÇÕES DE CPF/CNPJ
// ============================================

function isValidCPF(cpf) {
    if (!cpf || cpf.length !== 11) return false;
    
    // Permitir CPFs de teste (000.000.000-00)
    if (/^0{11}$/.test(cpf)) return true;
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf[i]) * (10 - i);
    }
    let digit1 = sum % 11;
    digit1 = digit1 < 2 ? 0 : 11 - digit1;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf[i]) * (11 - i);
    }
    let digit2 = sum % 11;
    digit2 = digit2 < 2 ? 0 : 11 - digit2;
    
    return digit1 === parseInt(cpf[9]) && digit2 === parseInt(cpf[10]);
}

function isValidCNPJ(cnpj) {
    if (!cnpj || cnpj.length !== 14) return false;
    
    // Permitir CNPJs de teste (00.000.000/0000-00)
    if (/^0{14}$/.test(cnpj)) return true;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    const weights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cnpj[i]) * weights[i];
    }
    let digit1 = sum % 11;
    digit1 = digit1 < 2 ? 0 : 11 - digit1;
    
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
        sum += parseInt(cnpj[i]) * weights2[i];
    }
    let digit2 = sum % 11;
    digit2 = digit2 < 2 ? 0 : 11 - digit2;
    
    return digit1 === parseInt(cnpj[12]) && digit2 === parseInt(cnpj[13]);
}

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
                console.log('[UI] Tela', id, 'visível:', shouldShow);
            }
        });
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: #ef4444; color: white; padding: 16px 24px; z-index: 9999; border-radius: 8px; font-weight: bold;';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showModal(content) {
        const container = document.getElementById('modal-container');
        container.innerHTML = content;
        container.classList.remove('hidden');
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
            (window.ui || ui)?.showToast(error.message || 'Erro de conexão', 'error');
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
        console.log('[App] DOM ready?', document.readyState);
        
        // Se DOM Ainda não carregado, espera
        if (document.readyState !== 'complete') {
            console.log('[App] Esperando DOM loads...');
            await new Promise(resolve => window.addEventListener('load', resolve));
        }
        
        try {
            await this.initCore();
        } catch (error) {
            console.error('[App] Erro fatal:', error);
        }
    }

    async initCore() {
        console.log('[App] initCore started');
        ui.showLoading('Iniciando sistema...');
        ui.setLoadingStatus('');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const hasToken = localStorage.getItem('CRM_TOKEN');
        console.log('[App] Token exists:', !!hasToken);
        
        ui.hideLoading();
        console.log('[App] Loading hidden');
        
        if (!hasToken) {
            console.log('[App] Show auth screen');
            ui.showScreen('auth-screen');
            this.setupEventListeners();
            this.setupOfflineManager();
            console.log('[App] Init done - no token');
            return;
        }
        
        await auth.init();
        
        this.setupEventListeners();
        this.setupOfflineManager();
        console.log('[App] Init done - with token');
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

        // Theme toggle
        this.initTheme();
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('CRM_THEME', next);
            this.updateThemeIcons(next);
            // Update meta theme-color
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.content = next === 'dark' ? '#191919' : '#ffffff';
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
        const forgotForm = document.getElementById('forgot-password-form');

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

        // Toggle para forgot password
        document.getElementById('show-forgot-password')?.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm?.classList.add('hidden');
            forgotForm?.classList.remove('hidden');
        });

        document.getElementById('back-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            forgotForm?.classList.add('hidden');
            loginForm?.classList.remove('hidden');
        });

        // Toggle - Step 2 (token)
        document.getElementById('back-to-forgot')?.addEventListener('click', (e) => {
            e.preventDefault();
            clearInterval(tokenTimer);
            document.getElementById('reset-password-form')?.classList.add('hidden');
            forgotForm?.classList.remove('hidden');
        });

        // Função para mostrar token com countdown
        function showTokenInput(token, seconds) {
            const tokenInput = document.getElementById('reset-token');
            const timerEl = document.getElementById('token-timer');
            
            // Mostrar o token no input
            tokenInput.value = token;
            
            // Contagem regressiva
            let remaining = seconds;
            timerEl.textContent = `Expira em ${remaining}s`;
            
            if (tokenTimer) clearInterval(tokenTimer);
            
            tokenTimer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(tokenTimer);
                    timerEl.textContent = 'EXPIRADO!';
                    ui.showToast('Token expirado! Gere outro.', 'error');
                    document.getElementById('reset-password-form')?.classList.add('hidden');
                    forgotForm?.classList.remove('hidden');
                    resetUserId = null;
                } else {
                    timerEl.textContent = `Expira em ${remaining}s`;
                }
            }, 1000);
        }

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

        // Step 1: Gerar token
        let resetUserId = null;
        let tokenTimer = null;
        
        forgotForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const btn = forgotForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Gerando...';
            
            try {
                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                
                if (data.success) {
                    resetUserId = data.userId;
                    ui.showToast(`Token: ${data.resetToken} (${data.expiresIn}s)`, 'success');
                    showTokenInput(data.resetToken, data.expiresIn);
                    forgotForm?.classList.add('hidden');
                    document.getElementById('reset-password-form')?.classList.remove('hidden');
                } else {
                    ui.showToast(data.message || 'Erro ao gerar token', 'error');
                }
            } catch (err) {
                ui.showToast('Erro de conexão', 'error');
            }
            
            btn.disabled = false;
            btn.textContent = 'Gerar Token';
        });

        // Step 2: Redefinir senha
        document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('reset-token').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const btn = document.getElementById('reset-password-form').querySelector('button[type="submit"]');
            
            if (newPassword !== confirmPassword) {
                ui.showToast('As senhas não conferem', 'error');
                return;
            }
            
            if (!resetUserId) {
                ui.showToast('Sessão expirada. Tente novamente.', 'error');
                forgotForm?.classList.add('hidden');
                document.getElementById('reset-password-form')?.classList.add('hidden');
                loginForm?.classList.remove('hidden');
                return;
            }
            
            btn.disabled = true;
            btn.textContent = 'Alterando...';
            
            try {
                const res = await fetch('/api/auth/confirm-reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: resetUserId, token, newPassword })
                });
                const data = await res.json();
                
                if (data.success) {
                    ui.showToast('Senha alterada! Faça login.', 'success');
                    resetUserId = null;
                    clearInterval(tokenTimer);
                    document.getElementById('reset-password-form')?.classList.add('hidden');
                    loginForm?.classList.remove('hidden');
                    document.getElementById('login-password').value = '';
                } else {
                    ui.showToast(data.message || 'Erro ao alterar senha', 'error');
                }
            } catch (err) {
                ui.showToast('Erro de conexão', 'error');
            }
            
            btn.disabled = false;
            btn.textContent = 'Alterar Senha';
        });
    }

    initTheme() {
        const saved = localStorage.getItem('CRM_THEME');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcons(theme);
    }

    updateThemeIcons(theme) {
        const sun = document.getElementById('theme-icon-sun');
        const moon = document.getElementById('theme-icon-moon');
        if (sun && moon) {
            sun.style.display = theme === 'dark' ? 'block' : 'none';
            moon.style.display = theme === 'dark' ? 'none' : 'block';
        }
    }

    setupOfflineManager() {
        console.log('[App] setupOfflineManager chamado');
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
                this.setupDashboardView();
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
            case 'crops':
                main.innerHTML = this.renderCrops();
                this.setupCropsView();
                break;
            case 'tasks':
                main.innerHTML = this.renderTasks();
                this.setupTasksView();
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
            case 'crops':
                this.showCropModal();
                break;
            case 'tasks':
                this.showTaskModal();
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

        const orders = store.getOrders();
        const products = store.getProducts();
        
        // Calcular vendas mensais (Janeiro a Dezembro)
        const monthlySales = Array(12).fill(0);
        const monthlyCommission = Array(12).fill(0);
        
        let totalSales = 0;
        let totalCommission = 0;
        
        orders.forEach(order => {
            try {
                const orderDate = new Date(order.data);
                const month = orderDate.getMonth();
                const year = orderDate.getFullYear();
                
                // Calcular valor do pedido
                let orderValue = parseFloat(order.valor_total) || 0;
                if (orderValue === 0 && order.items) {
                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(items)) {
                        orderValue = items.reduce((sum, item) => {
                            const qty = parseFloat(item.quantidade) || 0;
                            const price = parseFloat(item.valorUnitario || item.precoUnitario || 0);
                            return sum + (qty * price);
                        }, 0);
                    }
                }
                
                // Calcular comissão (10% padrão)
                let orderCommission = orderValue * 0.10;
                
                if (orderDate.getFullYear() === new Date().getFullYear()) {
                    monthlySales[month] += orderValue;
                    monthlyCommission[month] += orderCommission;
                    totalSales += orderValue;
                    totalCommission += orderCommission;
                }
            } catch (e) {}
        });
        
        const avgSales = orders.length > 0 ? totalSales / 12 : 0;
        const avgCommission = orders.length > 0 ? totalCommission / 12 : 0;
        
        const maxMonthly = Math.max(...monthlySales, 1);
        
        // Calcular produtos mais vendidos
        const productSales = {};
        orders.forEach(order => {
            try {
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const productId = parseInt(item.productId || item.produto_id || item.id || 0);
                        const product = products.find(p => p.id === productId);
                        const productName = product?.nome || item.nome || item.produto || 'Produto';
                        const qty = parseFloat(item.quantidade) || 0;
                        
                        if (productId) {
                            if (!productSales[productId]) {
                                productSales[productId] = { name: productName, quantidade: 0 };
                            }
                            productSales[productId].quantidade += qty;
                        }
                    });
                }
            } catch (e) {}
        });
        
        const topProducts = Object.entries(productSales)
            .sort((a, b) => b[1].quantidade - a[1].quantidade)
            .slice(0, 10);
        
        const maxQty = topProducts.length > 0 ? topProducts[0][1].quantidade : 1;
        
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const cores = ['#2383e2', '#4daa57', '#cb912f', '#e03e3e', '#9b51e0', '#3d7fa8', '#5aabf8', '#ff8e6e', '#6b7280', '#059669', '#dc2626', '#7c3aed'];

        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Dashboard</h1>
                </div>
                
                <!-- KPIs -->
                <div class="stats-grid" style="margin-bottom: 24px;">
                    <div class="stat-card orange">
                        <div class="stat-label">Valor Total Vendas</div>
                        <div class="stat-value">R$ ${totalSales.toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div class="stat-card blue">
                        <div class="stat-label">Média Vendas/Mês</div>
                        <div class="stat-value">R$ ${avgSales.toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div class="stat-card green">
                        <div class="stat-label">Comissão Total</div>
                        <div class="stat-value">R$ ${totalCommission.toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Comissão Média</div>
                        <div class="stat-value">R$ ${avgCommission.toFixed(2).replace('.', ',')}</div>
                    </div>
                </div>

                <!-- Gráfico Mensal -->
                <div class="card" style="margin-bottom: 24px; padding: 20px;">
                    <div class="card-header" style="margin-bottom: 20px;">
                        <h3 class="card-title">Volume de Vendas Mensais</h3>
                        <span style="font-size: 12px; color: var(--text-muted);">${new Date().getFullYear()}</span>
                    </div>
                    <div style="height: 200px; display: flex; align-items: flex-end; gap: 8px; padding: 0 8px;">
                        ${monthlySales.map((valor, i) => {
                            const height = maxMonthly > 0 ? (valor / maxMonthly * 100) : 0;
                            return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                    <div style="font-size: 11px; font-weight: 500; color: var(--text-primary);">R$ ${(valor/1000).toFixed(1)}k</div>
                                    <div style="width: 100%; background: var(--bg-tertiary); border-radius: 4px 4px 0 0; height: 140px; position: relative;">
                                        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(0deg, ${cores[i]} 0%, ${cores[i]}80 100%); border-radius: 4px 4px 0 0; height: ${height}%; transition: height 0.5s ease;"></div>
                                    </div>
                                    <div style="font-size: 10px; color: var(--text-muted);">${meses[i]}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px;">
                    <!-- Produtos Vendidos -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Produtos Vendidos</h3>
                        </div>
                        ${topProducts.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${topProducts.map(([id, data], index) => {
                                    const percentage = maxQty > 0 ? (data.quantidade / maxQty * 100) : 0;
                                    const color = cores[index % cores.length];
                                    return `
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
                                            <div style="flex: 1;">
                                                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                                                    <span style="font-weight: 500; color: var(--text-primary);">${data.name}</span>
                                                    <span style="font-weight: 600; color: var(--text-primary);">${data.quantidade}</span>
                                                </div>
                                                <div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${percentage}%; background: ${color}; border-radius: 2px;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<p class="empty-text">Nenhuma venda</p>'}
                    </div>
                    
                    <!-- Pedidos Recentes -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Pedidos Recentes</h3>
                        </div>
                        ${orders.slice(0, 5).length > 0 ? `
                            <div class="list">
                            ${orders.slice(0, 5).map(order => {
                                let calculatedTotal = parseFloat(order.valor_total || 0);
                                try {
                                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                    if (Array.isArray(items) && items.length > 0) {
                                        calculatedTotal = items.reduce((sum, item) => sum + ((item.quantidade || 0) * (item.valorUnitario || item.precoUnitario || 0)), 0);
                                    }
                                } catch (e) {}
                                
                                return `
                                <div class="list-item" data-id="${order.id}">
                                    <div class="list-item-content">
                                        <div class="list-item-title">${order.numero_pedido || 'Pedido #' + order.id} <span style="color: var(--success); font-weight: 700; margin-left: 8px;">R$ ${calculatedTotal.toFixed(2).replace('.', ',')}</span></div>
                                        <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                                    </div>
                                    <div class="list-item-meta">
                                        <span class="badge badge-${order.status_pagamento}">${order.status_pagamento}</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        ` : '<p class="empty-text">Nenhum pedido</p>'}
                    </div>
                </div>
            </div>
        `;
    }
                        </div>
                        ${topProducts.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${topProducts.map(([id, data], index) => {
                                    const percentage = maxQty > 0 ? (data.quantidade / maxQty * 100) : 0;
                                    const colors = ['#2383e2', '#4daa57', '#cb912f', '#e03e3e', '#9b51e0', '#3d7fa8', '#5aabf8', '#ff8e6e'];
                                    const color = colors[index % colors.length];
                                    return `
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
                                            <div style="flex: 1;">
                                                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                                                    <span style="font-weight: 500; color: var(--text-primary);">${data.name}</span>
                                                    <span style="font-weight: 600; color: var(--text-primary);">${data.quantidade.toLocaleString('pt-BR')} ${data.unidade}</span>
                                                </div>
                                                <div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${percentage}%; background: ${color}; border-radius: 2px;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<p class="empty-text">Nenhuma venda registrada</p>'}
                    </div>
                    
                    <!-- Gráfico de Barras -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Ranking - Mais Vendidos</h3>
                        </div>
                        ${topProducts.length > 0 ? `
                            <div style="height: 300px; display: flex; align-items: flex-end; gap: 12px; padding: 20px 0;">
                                ${topProducts.map(([id, data], index) => {
                                    const percentage = maxQty > 0 ? (data.quantidade / maxQty * 100) : 0;
                                    const colors = ['#2383e2', '#4daa57', '#cb912f', '#e03e3e', '#9b51e0', '#3d7fa8', '#5aabf8', '#ff8e6e'];
                                    const color = colors[index % colors.length];
                                    return `
                                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                            <div style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${data.quantidade}</div>
                                            <div style="width: 100%; background: var(--bg-tertiary); border-radius: 4px 4px 0 0; position: relative; height: ${percentage * 2.5}px; min-height: 20px;">
                                                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: ${color}; border-radius: 4px 4px 0 0; height: 100%;"></div>
                                            </div>
                                            <div style="font-size: 10px; color: var(--text-muted); text-align: center; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.name}</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<p class="empty-text">Nenhuma venda registrada</p>'}
                    </div>
                </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Pedidos Recentes</h3>
                        </div>
                        ${recentOrders.length > 0 ? `
                            <div class="list" id="recent-orders-list">
                            ${recentOrders.map(order => {
                                let calculatedTotal = parseFloat(order.valor_total || 0);
                                try {
                                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                    if (Array.isArray(items) && items.length > 0) {
                                        calculatedTotal = items.reduce((sum, item) => sum + ((item.quantidade || 0) * (item.valorUnitario || item.precoUnitario || 0)), 0);
                                    }
                                } catch (e) {}
                                
                                return `
                                <div class="list-item" data-id="${order.id}">
                                    <div class="list-item-content">
                                        <div class="list-item-title">${order.numero_pedido || 'Pedido #' + order.id} <span style="color: var(--success); font-weight: 700; margin-left: 8px;">R$ ${calculatedTotal.toFixed(2).replace('.', ',')}</span></div>
                                        <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                                    </div>
                                    <div class="list-item-meta">
                                        <span class="badge badge-${order.status_pagamento}">${order.status_pagamento}</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
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
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <h1 class="view-title">Clientes</h1>
                        <select id="customer-filter-select" class="form-control" style="width: auto; margin: 0; padding: 6px 32px 6px 12px; height: auto; border-radius: 20px; font-size: 13px; cursor: pointer;">
                            <option value="all">Todos</option>
                            <option value="Lead">Lead</option>
                            <option value="Indicação">Indicação</option>
                            <option value="Listagem">Listagem</option>
                            <option value="Contato Telefônico">Contato Telefônico</option>
                            <option value="Cliente de outro vendedor">Cliente de outro vendedor</option>
                            <option value="Disparo">Disparo</option>
                        </select>
                    </div>
                </div>
                
                <div class="search-container">
                    <span class="search-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                    </span>
                    <input type="text" class="search-input" id="customer-search" placeholder="Buscar clientes...">
                </div>

                <div class="list" id="customers-list">
                    ${customers.length > 0 ? customers.map(c => this.renderCustomerItem(c)).join('') : this.renderEmptyState('Nenhum cliente cadastrado', 'Adicione seu primeiro cliente')}
                </div>
            </div>
        `;
    }

    renderCustomerItem(customer) {
        const initials = customer.nome?.split(' ').map(n => n[0]).join('').toUpperCase() || 'C';
        const statusClass = customer.status?.toLowerCase().replace(/\s+/g, '-');
        return `
            <div class="list-item" data-id="${customer.id}">
                <div class="list-item-avatar" style="border-radius: 12px; font-weight: 700;">${initials.slice(0, 2)}</div>
                <div class="list-item-content">
                    <div class="list-item-title">${customer.nome}</div>
                    <div class="list-item-subtitle">${customer.whatsapp || customer.email || 'Sem contato'}</div>
                </div>
                <div class="list-item-meta">
                    <span class="badge badge-${statusClass}">${customer.status}</span>
                </div>
            </div>
        `;
    }

    renderOrders() {
        const orders = store.getOrders();
        
        return `
            <div class="view active">
                <div class="view-header">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <h1 class="view-title">Pedidos</h1>
                        <select id="order-filter-select" class="form-control" style="width: auto; margin: 0; padding: 6px 32px 6px 12px; height: auto; border-radius: 20px; font-size: 13px; cursor: pointer;">
                            <option value="all">Todos</option>
                            <option value="pendente">Pendente</option>
                            <option value="pago">Pago</option>
                            <option value="atrasado">Atrasado</option>
                        </select>
                    </div>
                </div>

                <div class="list" id="orders-list">
                    ${orders.length > 0 ? orders.map(o => this.renderOrderItem(o)).join('') : this.renderEmptyState('Nenhum pedido criado', 'Crie seu primeiro pedido')}
                </div>
            </div>
        `;
    }

    renderOrderItem(order) {
        let calculatedTotal = parseFloat(order.valor_total || 0);
        try {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            if (Array.isArray(items) && items.length > 0) {
                calculatedTotal = items.reduce((sum, item) => sum + ((item.quantidade || 0) * (item.valorUnitario || item.precoUnitario || 0)), 0);
            }
        } catch (e) {}

        const dataPedido = order.data ? new Date(order.data).toLocaleDateString('pt-BR') : '';
        const tipoPagamento = order.tipo_pagamento === 'avista' ? 'À Vista' : 'Parcelado';
        const parcelas = order.parcelas || 1;
        
        return `
            <div class="list-item" data-id="${order.id}">
                <div class="list-item-content">
                    <div class="list-item-title">${order.numero_pedido || 'Pedido #' + order.id} <span style="color: var(--success); font-weight: 700; margin-left: 8px;">R$ ${calculatedTotal.toFixed(2).replace('.', ',')}</span></div>
                    <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                    <div class="list-item-badges">
                        <span class="badge badge-info">${dataPedido}</span>
                        <span class="badge badge-info">${tipoPagamento}</span>
                        <span class="badge badge-info">${parcelas}x</span>
                    </div>
                </div>
                <div class="list-item-meta">
                    <span class="badge badge-${order.status_pagamento}">${order.status_pagamento}</span>
                </div>
                <button class="btn-delete" onclick="app.deleteOrder(${order.id}, event)" title="Excluir">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    }

    renderProducts() {
        const products = store.getProducts();
        const orders = store.getOrders();
        
        // Calcular vendas por produto
        const productSales = {};
        orders.forEach(order => {
            try {
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        // Normalizar productId para número
                        const productId = parseInt(item.productId || item.produto_id || item.id || 0);
                        
                        // Buscar produto cadastrado
                        const product = products.find(p => p.id === productId);
                        const productName = product?.nome || item.nome || item.produto || item.productName || 'Produto sem nome';
                        
                        const qty = parseFloat(item.quantidade) || 0;
                        const price = parseFloat(item.valorUnitario || item.precoUnitario || 0);
                        const unity = product?.unidade || item.unidade || item.und || 'un';
                        
                        if (productId) {
                            if (!productSales[productId]) {
                                productSales[productId] = {
                                    name: productName,
                                    quantidade: 0,
                                    valor: 0,
                                    unidade: unity
                                };
                            }
                            productSales[productId].quantidade += qty;
                            productSales[productId].valor += qty * price;
                        }
                    });
                }
            } catch (e) {}
        });
        
        // Ordenar por valor
        const topProducts = Object.entries(productSales)
            .sort((a, b) => b[1].valor - a[1].valor)
            .slice(0, 10);
        
        const maxValor = topProducts.length > 0 ? topProducts[0][1].valor : 1;
        const cores = ['#2383e2', '#4daa57', '#cb912f', '#e03e3e', '#9b51e0', '#3d7fa8', '#5aabf8', '#ff8e6e', '#6b7280', '#059669'];

        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Produtos</h1>
                </div>

                <div class="card" style="margin-bottom: var(--spacing-xl); background: var(--bg-elevated); border-radius: var(--border-radius-lg); overflow: hidden;">
                    <div class="card-header" style="padding: 20px 24px; border-bottom: 1px solid var(--border-color);">
                        <h3 class="card-title" style="font-size: 1rem; font-weight: 600; color: var(--text-primary);">Produtos Mais Vendidos</h3>
                        <span style="font-size: 12px; color: var(--text-muted);">Por valor em R$</span>
                    </div>
                    <div style="padding: 24px; min-height: 320px;">
                        ${topProducts.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 16px;">
                                ${topProducts.map(([id, data], index) => {
                                    const percentage = maxValor > 0 ? (data.valor / maxValor * 100) : 0;
                                    const cor = cores[index % cores.length];
                                    return `
                                        <div style="display: flex; align-items: center; gap: 16px;">
                                            <div style="width: 28px; height: 28px; border-radius: 8px; background: ${cor}20; color: ${cor}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0;">
                                                ${index + 1}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                                                    <span style="font-size: 14px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${data.name}</span>
                                                    <span style="font-size: 14px; font-weight: 700; color: var(--success);">R$ ${data.valor.toFixed(2).replace('.', ',')}</span>
                                                </div>
                                                <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${percentage}%; background: linear-gradient(90deg, ${cor} 0%, ${cor}cc 100%); border-radius: 4px; transition: width 0.5s ease;"></div>
                                                </div>
                                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${data.quantidade.toLocaleString('pt-BR')} ${data.unidade} vendido${data.quantidade !== 1 ? 's' : ''}</div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<p class="empty-text" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma venda registrada ainda</p>'}
                    </div>
                </div>

                <div class="view-header" style="margin-top: var(--spacing-xl); margin-bottom: var(--spacing-md);">
                    <h2 class="view-title" style="font-size: var(--font-size-lg);">Lista de Produtos</h2>
                </div>

                <div class="list" id="products-list">
                    ${products.length > 0 ? products.map(p => this.renderProductItem(p)).join('') : this.renderEmptyState('Nenhum produto cadastrado', 'Adicione seus produtos')}
                </div>
            </div>
        `;
    }

    renderCrops() {
        const crops = store.getCrops();
        
        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Tipos de Cultura</h1>
                </div>

                <div class="list" id="crops-list">
                    ${crops.length > 0 ? crops.map(c => this.renderCropItem(c)).join('') : this.renderEmptyState('Nenhuma cultura cadastrada', 'Adicione tipos de cultura para seus clientes')}
                </div>
            </div>
        `;
    }

    renderCropItem(crop) {
        return `
            <div class="list-item" data-id="${crop.id}">
                <div class="list-item-content">
                    <div class="list-item-title">${crop.nome}</div>
                    <div class="list-item-subtitle">${crop.observacoes || 'Sem observações'}</div>
                </div>
                <div class="list-item-meta">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--success)">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
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
        const today = new Date();
        const calendarDate = this.calendarMonth || today;
        const currentMonth = calendarDate.getMonth();
        const currentYear = calendarDate.getFullYear();
        
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        const tasksByDate = {};
        tasks.forEach(t => {
            if (t.data) {
                const dateKey = t.data.split('T')[0];
                if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
                tasksByDate[dateKey].push(t);
            }
        });
        
        let daysHtml = '';
        for (let i = 0; i < firstDay; i++) {
            daysHtml += '<div class="calendar-day empty"></div>';
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasksByDate[dateStr] || [];
            const isToday = day === today.getDate();
            const hasTask = dayTasks.length > 0;
            
            daysHtml += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${hasTask ? 'has-task' : ''}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${hasTask ? `<span class="task-dot">${dayTasks.length}</span>` : ''}
                </div>
            `;
        }
        
        return `
            <div class="view active">
                <div class="view-header">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <h1 class="view-title">Tarefas</h1>
                    </div>
                </div>
                <div class="tasks-layout" style="display: flex; gap: var(--spacing-xl); align-items: flex-start; flex-wrap: wrap;">
                    <div class="tasks-sidebar" style="flex: 1; min-width: 300px; max-width: 400px;">
                        <h3 style="margin: 0 0 16px; font-size: 16px;">Próximas Tarefas</h3>
                        <div class="list">
                            ${tasks.length > 0 ? tasks.sort((a, b) => new Date(a.data) - new Date(b.data)).slice(0, 8).map(t => `
                                <div class="list-item" data-id="${t.id}">
                                    <div class="list-item-content">
                                        <div class="list-item-title">${t.titulo}</div>
                                        <div class="list-item-subtitle">${new Date(t.data).toLocaleDateString('pt-BR')}</div>
                                    </div>
                                    <span class="badge badge-${t.status}">${t.status}</span>
                                </div>
                            `).join('') : this.renderEmptyState('Nenhuma tarefa', 'Crie tarefas para acompanhar')}
                        </div>
                    </div>
                    
                    <div class="tasks-main" style="flex: 2; min-width: 400px;">
                        <div class="calendar">
                            <div class="calendar-header">
                                <button class="btn btn-icon" onclick="app.changeMonth(-1)">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M15 18l-6-6 6-6"/>
                                    </svg>
                                </button>
                                <h2 class="calendar-title">${monthNames[currentMonth]} ${currentYear}</h2>
                                <button class="btn btn-icon" onclick="app.changeMonth(1)">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 18l6-6-6-6"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="calendar-weekdays">
                                ${dayNames.map(d => `<div>${d}</div>`).join('')}
                            </div>
                            <div class="calendar-days">
                                ${daysHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showTaskModal(task = null) {
        const isEdit = !!task;
        const customers = store.getCustomers();
        
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                    <button class="btn-icon" onclick="ui.closeModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="task-form" class="modal-body">
                    <input type="hidden" name="id" value="${task?.id || ''}">
                    
                    <div class="form-group">
                        <label for="titulo">Título *</label>
                        <input type="text" id="titulo" name="titulo" value="${task?.titulo || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="customer_id">Cliente (opcional)</label>
                        <select id="customer_id" name="customer_id">
                            <option value="">Selecione...</option>
                            ${customers.map(c => `<option value="${c.id}" ${task?.customer_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="data">Data</label>
                            <input type="date" id="data" name="data" value="${task?.data?.split('T')[0] || ''}">
                        </div>
                        <div class="form-group">
                            <label for="prioridade">Prioridade</label>
                            <select id="prioridade" name="prioridade">
                                <option value="baixa" ${task?.prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
                                <option value="media" ${task?.prioridade === 'media' || !task ? 'selected' : ''}>Média</option>
                                <option value="alta" ${task?.prioridade === 'alta' ? 'selected' : ''}>Alta</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="status">Status</label>
                        <select id="status" name="status">
                            <option value="pendente" ${task?.status === 'pendente' || !task ? 'selected' : ''}>Pendente</option>
                            <option value="concluida" ${task?.status === 'concluida' ? 'selected' : ''}>Concluída</option>
                            <option value="cancelada" ${task?.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
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
        
        document.getElementById('task-form')?.addEventListener('submit', (e) => {
            this.handleTaskSubmit(e, isEdit);
        });
    }

    async handleTaskSubmit(e, isEdit = false) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        const endpoint = isEdit ? `tasks/${data.id}` : 'tasks';
        const method = isEdit ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(`${API_BASE}/${endpoint}`, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message || 'Erro ao salvar tarefa');
            
            ui.showToast(isEdit ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
            ui.closeModal();
            this.renderView('tasks');
            
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    changeMonth(delta) {
        this.calendarMonth = this.calendarMonth || new Date();
        this.calendarMonth.setMonth(this.calendarMonth.getMonth() + delta);
        this.renderView('tasks');
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
                            <input type="tel" id="whatsapp" name="whatsapp" value="${customer?.whatsapp || ''}" placeholder="+55...." class="digits-only">
                        </div>
                        <div class="form-group">
                            <label for="documento">CPF/CNPJ</label>
                            <input type="text" id="documento" name="documento" value="${customer?.documento || ''}" class="digits-only">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" value="${customer?.email || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="logradouro">Endereço</label>
                        <input type="text" id="logradouro" name="logradouro" value="${customer?.logradouro || ''}" placeholder="Rua, avenida...">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="numero">Número</label>
                            <input type="text" id="numero" name="numero" value="${customer?.numero || ''}" placeholder="Nº">
                        </div>
                        <div class="form-group">
                            <label for="complemento">Complemento</label>
                            <input type="text" id="complemento" name="complemento" value="${customer?.complemento || ''}" placeholder="Apto, sala...">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="cep">CEP</label>
                            <input type="text" id="cep" name="cep" value="${customer?.cep || ''}" placeholder="00000000" class="digits-only">
                        </div>
                        <div class="form-group">
                            <label for="bairro">Bairro</label>
                            <input type="text" id="bairro" name="bairro" value="${customer?.bairro || ''}">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="cidade">Cidade</label>
                            <input type="text" id="cidade" name="cidade" value="${customer?.cidade || ''}">
                        </div>
                        <div class="form-group">
                            <label for="uf">UF</label>
                            <select id="uf" name="uf">
                                <option value="">Selecione...</option>
                                <option value="AC" ${customer?.uf === 'AC' ? 'selected' : ''}>Acre</option>
                                <option value="AL" ${customer?.uf === 'AL' ? 'selected' : ''}>Alagoas</option>
                                <option value="AP" ${customer?.uf === 'AP' ? 'selected' : ''}>Amapá</option>
                                <option value="AM" ${customer?.uf === 'AM' ? 'selected' : ''}>Amazonas</option>
                                <option value="BA" ${customer?.uf === 'BA' ? 'selected' : ''}>Bahia</option>
                                <option value="CE" ${customer?.uf === 'CE' ? 'selected' : ''}>Ceará</option>
                                <option value="DF" ${customer?.uf === 'DF' ? 'selected' : ''}>Distrito Federal</option>
                                <option value="ES" ${customer?.uf === 'ES' ? 'selected' : ''}>Espírito Santo</option>
                                <option value="GO" ${customer?.uf === 'GO' ? 'selected' : ''}>Goiás</option>
                                <option value="MA" ${customer?.uf === 'MA' ? 'selected' : ''}>Maranhão</option>
                                <option value="MT" ${customer?.uf === 'MT' ? 'selected' : ''}>Mato Grosso</option>
                                <option value="MS" ${customer?.uf === 'MS' ? 'selected' : ''}>Mato Grosso do Sul</option>
                                <option value="MG" ${customer?.uf === 'MG' ? 'selected' : ''}>Minas Gerais</option>
                                <option value="PA" ${customer?.uf === 'PA' ? 'selected' : ''}>Pará</option>
                                <option value="PB" ${customer?.uf === 'PB' ? 'selected' : ''}>Paraíba</option>
                                <option value="PR" ${customer?.uf === 'PR' ? 'selected' : ''}>Paraná</option>
                                <option value="PE" ${customer?.uf === 'PE' ? 'selected' : ''}>Pernambuco</option>
                                <option value="PI" ${customer?.uf === 'PI' ? 'selected' : ''}>Piauí</option>
                                <option value="RJ" ${customer?.uf === 'RJ' ? 'selected' : ''}>Rio de Janeiro</option>
                                <option value="RN" ${customer?.uf === 'RN' ? 'selected' : ''}>Rio Grande do Norte</option>
                                <option value="RS" ${customer?.uf === 'RS' ? 'selected' : ''}>Rio Grande do Sul</option>
                                <option value="RO" ${customer?.uf === 'RO' ? 'selected' : ''}>Rondônia</option>
                                <option value="RR" ${customer?.uf === 'RR' ? 'selected' : ''}>Roraima</option>
                                <option value="SC" ${customer?.uf === 'SC' ? 'selected' : ''}>Santa Catarina</option>
                                <option value="SP" ${customer?.uf === 'SP' ? 'selected' : ''}>São Paulo</option>
                                <option value="SE" ${customer?.uf === 'SE' ? 'selected' : ''}>Sergipe</option>
                                <option value="TO" ${customer?.uf === 'TO' ? 'selected' : ''}>Tocantins</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="status">Origem</label>
                        <select id="status" name="status">
                            <option value="Lead" ${customer?.status === 'Lead' || !customer ? 'selected' : ''}>Lead</option>
                            <option value="Indicação" ${customer?.status === 'Indicação' ? 'selected' : ''}>Indicação</option>
                            <option value="Listagem" ${customer?.status === 'Listagem' ? 'selected' : ''}>Listagem</option>
                            <option value="Contato Telefônico" ${customer?.status === 'Contato Telefônico' ? 'selected' : ''}>Contato Telefônico</option>
                            <option value="Cliente de outro vendedor" ${customer?.status === 'Cliente de outro vendedor' ? 'selected' : ''}>Cliente de outro vendedor</option>
                            <option value="Disparo" ${customer?.status === 'Disparo' ? 'selected' : ''}>Disparo</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="crop_id">Cultura</label>
                        <select id="crop_id" name="crop_id">
                            <option value="">Selecione...</option>
                            ${crops.map(c => `<option value="${c.id}" ${customer?.crop_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="data_aniversario">Data de Aniversário</label>
                            <input type="date" id="data_aniversario" name="data_aniversario" value="${customer?.data_aniversario || ''}">
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; padding-top: 24px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="lembrete_aniversario" name="lembrete_aniversario" ${customer?.lembrete_aniversario ? 'checked' : ''}>
                                <span>Lembrete automático</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        // Validação de CPF/CNPJ
        const documentoInput = document.getElementById('documento');
        documentoInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 14);
            const doc = e.target.value;
            if (doc.length === 11) {
                e.target.value = doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (doc.length === 14) {
                e.target.value = doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            }
        });
        
        // Validação de CEP (apenas números, 8 dígitos)
        const cepInput = document.getElementById('cep');
        cepInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
        });
        
        //Validação de WhatsApp (apenas números)
        const whatsappInput = document.getElementById('whatsapp');
        whatsappInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
        
        document.getElementById('customer-form')?.addEventListener('submit', (e) => {
            this.handleCustomerSubmit(e, isEdit);
        });
    }

    showOrderModal(order = null) {
        const isEdit = !!order;
        const customers = store.getCustomers();
        const products = store.getProducts();
        
        if (customers.length === 0 && !isEdit) {
            ui.showToast('Cadastre um cliente primeiro', 'warning');
            return;
        }
        
        const modalTitle = isEdit ? 'Editar Pedido ' + (order?.numero_pedido || '#' + order?.id) : 'Novo Pedido';
        const dataPedido = order?.data ? new Date(order.data).toLocaleDateString('pt-BR') : '';
        const tipoPagamentoMap = { avista: 'À Vista', parcelado: 'Parcelado', credito: 'Cartão de Crédito', recebimento: 'Recebimento', boleto: 'Boleto' };
        const tipoPagamento = tipoPagamentoMap[order?.tipo_pagamento] || order?.tipo_pagamento || 'Cartão de Crédito';
        const parcelas = order?.parcelas || 1;
        
        // Data de hoje padrão para novos pedidos
        const hojeLocal = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <div>
                        <h2 class="modal-title">${modalTitle}</h2>
                        ${isEdit ? `<div style="display:flex;gap:8px;margin-top:8px;"><span class="badge badge-info">${dataPedido}</span><span class="badge badge-info">${tipoPagamento}</span><span class="badge badge-info">${parcelas}x</span></div>` : ''}
                    </div>
                    <button class="btn-icon" onclick="ui.closeModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="order-form" class="modal-body">
                    <input type="hidden" id="order_id" name="order_id" value="${order?.id || ''}">
                    <div class="form-group">
                        <label for="customer_id">Cliente *</label>
                        <select id="customer_id" name="customer_id" required>
                            <option value="">Selecione...</option>
                            ${customers.map(c => `<option value="${c.id}" ${order?.customer_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="data">Data do Pedido</label>
                        <input type="date" id="data" name="data" value="${order?.data ? order.data.split('T')[0] : hojeLocal}" onchange="if(typeof generateInstallments === 'function') generateInstallments()">
                    </div>
                    
                    <div class="form-group">
                        <label>Itens do Pedido</label>
                        <div class="order-items-header" style="display:flex;gap:6px;font-weight:600;font-size:11px;margin-bottom:4px;">
                            <span style="flex:1;min-width:120px">Produto</span>
                            <span style="width:65px">Qtd</span>
                            <span style="width:90px">Unit. R$</span>
                            <span style="width:100px">Montante</span>
                            <span style="width:75px">Comissão %</span>
                            <span style="width:80px">Comissão R$</span>
                            <span style="width:25px"></span>
                        </div>
                        <div id="order-items">
                            ${(order?.items ? (Array.isArray(order.items) ? order.items : JSON.parse(order.items)) : []).length > 0 ? (order?.items ? (Array.isArray(order.items) ? order.items : JSON.parse(order.items)) : []).map(item => `
                                <div class="order-item-row" style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center;">
                                    <select class="item-product" style="flex:1;min-width:120px;" onchange="updateOrderItemTotal(this)">
                                        <option value="">Produto...</option>
                                        ${products.map(p => `<option value="${p.id}" data-price="${p.custo || 0}" data-comissao="${p.comissao || 0}" ${(item.productId || item.product_id) == p.id ? 'selected' : ''}>${p.nome}</option>`).join('')}
                                    </select>
                                    <input type="number" class="item-qty" placeholder="Qtd" style="width:65px;" min="0" step="1" value="${item.quantidade}" oninput="updateOrderItemTotal(this)">
                                    <input type="number" class="item-price" placeholder="0,00" style="width:90px;" step="0.01" value="${item.valorUnitario || item.precoUnitario || 0}" oninput="updateOrderItemTotal(this)">
                                    <span class="item-subtotal" style="width:100px;font-weight:600;font-size:12px;">R$ ${((item.quantidade || 1) * (item.valorUnitario || item.precoUnitario || 0)).toFixed(2).replace('.', ',')}</span>
                                    <input type="number" class="item-comissao" placeholder="0,00" style="width:75px;" step="0.01" value="${item.comissao || products.find(p => p.id == (item.productId || item.product_id))?.comissao || 0}" oninput="updateOrderItemTotal(this)">
                                    <span class="item-comissao-rs" style="width:80px;font-weight:600;font-size:12px;color:var(--success);">R$ ${(((item.quantidade || 1) * (item.valorUnitario || item.precoUnitario || 0)) * ((item.comissao || products.find(p => p.id == (item.productId || item.product_id))?.comissao || 0) / 100)).toFixed(2).replace('.', ',')}</span>
                                    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); updateOrderTotal();">×</button>
                                </div>
                            `).join('') : `
                            <div class="order-item-row" style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center;">
                                <select class="item-product" style="flex:1;min-width:120px;" onchange="updateOrderItemTotal(this)">
                                    <option value="">Produto...</option>
                                    ${products.map(p => `<option value="${p.id}" data-price="${p.custo || 0}" data-comissao="${p.comissao || 0}">${p.nome}</option>`).join('')}
                                </select>
                                <input type="number" class="item-qty" placeholder="Qtd" style="width:65px;" min="0" step="1" value="1" oninput="updateOrderItemTotal(this)">
                                <input type="number" class="item-price" placeholder="0,00" style="width:90px;" step="0.01" value="0" oninput="updateOrderItemTotal(this)">
                                <span class="item-subtotal" style="width:100px;font-weight:600;font-size:12px;">R$ 0,00</span>
                                <input type="number" class="item-comissao" placeholder="0,00" style="width:75px;" step="0.01" value="0" oninput="updateOrderItemTotal(this)">
                                <span class="item-comissao-rs" style="width:80px;font-weight:600;font-size:12px;color:var(--success);">R$ 0,00</span>
                                <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); updateOrderTotal();">×</button>
                            </div>
                            `}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="addOrderItemRow()">+ Adicionar Item</button>
                        
                        <div id="order-totals" style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                <span>Subtotal:</span>
                                <span id="order-subtotal">R$ 0,00</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-weight:600;font-size:18px;">
                                <span>Total do Pedido:</span>
                                <span id="order-total">R$ 0,00</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);color:var(--success);">
                                <span>Comissão a Receber:</span>
                                <span id="order-comissao-total" style="font-weight:600;">R$ 0,00</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tipo_pagamento">Forma de Pagamento</label>
                            <select id="tipo_pagamento" name="tipo_pagamento" onchange="handlePaymentMethodChange()">
                                <option value="avista" ${order?.tipo_pagamento === 'avista' ? 'selected' : ''}>À Vista</option>
                                <option value="parcelado" ${order?.tipo_pagamento === 'parcelado' ? 'selected' : ''}>Parcelado</option>
                                <option value="credito" ${order?.tipo_pagamento === 'credito' ? 'selected' : ''}>Cartão de Crédito</option>
                                <option value="recebimento" ${order?.tipo_pagamento === 'recebimento' ? 'selected' : ''}>Pagamento no Recebimento</option>
                                <option value="boleto" ${order?.tipo_pagamento === 'boleto' ? 'selected' : ''}>Boleto</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="parcelas">Parcelas</label>
                            <select id="parcelas" name="parcelas" onchange="generateInstallments()">
                                ${[...Array(18)].map((_, i) => `<option value="${i+1}" ${order?.parcelas == i+1 ? 'selected' : ''}>${i+1}x</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div id="installments-container" style="margin-bottom: 16px;"></div>
                    
                    <div class="form-group">
                        <label for="observacoes">Observações</label>
                        <textarea id="observacoes" name="observacoes" rows="3">${order?.observacoes || ''}</textarea>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar Pedido'}</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        if (isEdit) {
            setTimeout(() => updateOrderTotal(), 100);
        }
        
        document.getElementById('order-form')?.addEventListener('submit', (e) => {
            this.handleOrderSubmit(e, isEdit);
        });
    }

    showCropModal(crop = null) {
        const isEdit = !!crop;
        
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Editar Cultura' : 'Nova Cultura'}</h2>
                    <button class="btn-icon" onclick="ui.closeModal()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="crop-form" class="modal-body">
                    <input type="hidden" name="id" value="${crop?.id || ''}">
                    
                    <div class="form-group">
                        <label for="nome">Nome *</label>
                        <input type="text" id="nome" name="nome" value="${crop?.nome || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="observacoes">Observações</label>
                        <textarea id="observacoes" name="observacoes" rows="3">${crop?.observacoes || ''}</textarea>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        document.getElementById('crop-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const rawData = Object.fromEntries(formData.entries());
            
            // Converter IDs para números
            const data = {};
            for (const [key, value] of Object.entries(rawData)) {
                if (value !== '' && value !== null && value !== undefined) {
                    if (key === 'id') {
                        data[key] = parseInt(value);
                    } else {
                        data[key] = value;
                    }
                }
            }
            
            try {
                ui.showLoading(true);
                const method = isEdit ? 'PUT' : 'POST';
                const url = isEdit ? `/api/crops/${data.id}` : '/api/crops';
                
                const response = await fetch(url, {
                    method,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('CRM_TOKEN')}`
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (result.success) {
                    ui.showToast(result.message);
                    await store.fetchAll();
                    this.renderView('crops');
                    ui.closeModal();
                } else {
                    ui.showToast(result.message, 'error');
                }
            } catch (error) {
                console.error('[App] Erro ao salvar cultura:', error);
                ui.showToast('Erro ao salvar cultura', 'error');
            } finally {
                ui.showLoading(false);
            }
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
        const rawData = Object.fromEntries(formData.entries());
        
        // Processar dados - converter IDs para números e limpar vazios
        const data = {};
        for (const [key, value] of Object.entries(rawData)) {
            if (value !== '' && value !== null && value !== undefined) {
                if (key === 'id' || key === 'crop_id') {
                    data[key] = parseInt(value);
                } else {
                    data[key] = value;
                }
            }
        }
        
        // Validar status
        const validStatuses = ['Lead', 'Indicação', 'Listagem', 'Contato Telefônico', 'Cliente de outro vendedor', 'Disparo'];
        if (data.status && !validStatuses.includes(data.status)) {
            data.status = 'Lead';
        }
        
        // Validar CPF/CNPJ
        const doc = (data.documento || '').replace(/\D/g, '');
        if (doc.length > 0 && doc.length !== 11 && doc.length !== 14) {
            ui.showToast('CPF deve ter 11 dígitos ou CNPJ 14 dígitos', 'error');
            return;
        }
        if (!isValidCPF(doc) && doc.length === 11) {
            ui.showToast('CPF inválido', 'error');
            return;
        }
        if (!isValidCNPJ(doc) && doc.length === 14) {
            ui.showToast('CNPJ inválido', 'error');
            return;
        }
        
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
            
            const cliente = result.data || result;
            
            if (data.data_aniversario && data.lembrete_aniversario) {
                const [ano, mes, dia] = data.data_aniversario.split('-');
                const dataLembrete = new Date().getFullYear() + '-' + mes + '-' + dia;
                
                const taskData = {
                    titulo: 'Aniversário de ' + cliente.nome,
                    data: dataLembrete,
                    prioridade: 'media',
                    status: 'pendente',
                    customer_id: cliente.id
                };
                
                await fetch(`${API_BASE}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${auth.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(taskData)
                });
            }
            
            ui.showToast(isEdit ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
            ui.closeModal();
            this.renderView('customers');
            
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async handleOrderSubmit(e, isEdit = false) {
        e.preventDefault();
        
        const orderId = document.getElementById('order_id')?.value;
        const customerId = document.getElementById('customer_id')?.value;
        const data = document.getElementById('data')?.value;
        const tipoPagamento = document.getElementById('tipo_pagamento')?.value;
        const parcelas = parseInt(document.getElementById('parcelas')?.value) || 1;
        const observacoes = document.getElementById('observacoes')?.value;
        
        const itemRows = document.querySelectorAll('.order-item-row');
        const items = [];
        
        itemRows.forEach((row) => {
            const productSelect = row.querySelector('.item-product');
            const qtyInput = row.querySelector('.item-qty');
            const priceInput = row.querySelector('.item-price');
            const comissaoInput = row.querySelector('.item-comissao');
            
            const productId = productSelect?.value;
            const productName = productSelect?.selectedOptions[0]?.text;
            const quantidade = parseFloat(qtyInput?.value) || 0;
            const valorUnitario = parseFloat(priceInput?.value) || 0;
            const comissao = parseFloat(comissaoInput?.value) || 0;
            
            if (productId) {
                items.push({
                    productId: parseInt(productId),
                    nome: productName,
                    quantidade,
                    valorUnitario,
                    precoUnitario: valorUnitario,
                    comissao
                });
            }
        });
        
        if (!customerId) {
            ui.showToast('Selecione um cliente', 'error');
            return;
        }
        
        if (items.length === 0) {
            ui.showToast('Adicione pelo menos um item', 'error');
            return;
        }
        
        const valorTotal = items.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0);
        
        const orderData = {
            customerId: parseInt(customerId),
            data,
            tipoPagamento,
            parcelas,
            observacoes,
            valorTotal,
            items
        };
        
        const endpoint = isEdit ? `orders/${orderId}` : 'orders';
        const method = isEdit ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(`${API_BASE}/${endpoint}`, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message || 'Erro ao salvar pedido');
            
            // Recarrega dados do store
            if (isEdit) {
                await store.fetchAll();
            }
            
            ui.showToast(isEdit ? 'Pedido atualizado!' : 'Pedido criado com sucesso!', 'success');
            ui.closeModal();
            this.renderView('orders');
            
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async deleteOrder(id, event) {
        event.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/orders/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });
            
            if (!response.ok) throw new Error('Erro ao excluir pedido');
            
            ui.showToast('Pedido excluído!', 'success');
            this.renderView('orders');
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
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

        // Filtros (Combobox)
        const filterSelect = document.getElementById('customer-filter-select');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const filter = e.target.value;
                const filtered = filter === 'all' 
                    ? store.getCustomers() 
                    : store.getCustomers().filter(c => c.status === filter);
                
                const list = document.getElementById('customers-list');
                if (list) {
                    list.innerHTML = filtered.length > 0 
                        ? filtered.map(c => this.renderCustomerItem(c)).join('')
                        : this.renderEmptyState('Nenhum cliente', 'Nenhum cliente com esse status');
                }
            });
        }

        // Delegação de evento para clique no cliente
        const list = document.getElementById('customers-list');
        list?.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item) {
                const id = item.dataset.id;
                const customer = store.getCustomers().find(c => c.id == id);
                if (customer) this.showCustomerModal(customer);
            }
        });
    }

    setupDashboardView() {
        const list = document.getElementById('recent-orders-list');
        list?.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item) {
                const id = item.dataset.id;
                const order = store.getOrders().find(o => o.id == id);
                if (order) this.showOrderModal(order);
            }
        });
    }

    setupCropsView() {
        const list = document.getElementById('crops-list');
        list?.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item) {
                const id = item.dataset.id;
                const crop = store.getCrops().find(c => c.id == id);
                if (crop) this.showCropModal(crop);
            }
        });
    }

    setupOrdersView() {
        // Delegação de evento para clique no pedido
        const list = document.getElementById('orders-list');
        list?.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item) {
                const id = item.dataset.id;
                const order = store.getOrders().find(o => o.id == id);
                if (order) this.showOrderModal(order);
            }
        });

        // Filtros (Combobox)
        const orderFilterSelect = document.getElementById('order-filter-select');
        if (orderFilterSelect) {
            orderFilterSelect.addEventListener('change', (e) => {
                const filter = e.target.value;
                const filtered = filter === 'all' 
                    ? store.getOrders() 
                    : store.getOrders().filter(o => o.status_pagamento === filter);
                
                const listEl = document.getElementById('orders-list');
                if (listEl) {
                    listEl.innerHTML = filtered.length > 0 
                        ? filtered.map(o => this.renderOrderItem(o)).join('')
                        : this.renderEmptyState('Nenhum pedido', 'Nenhum pedido com esse status');
                }
            });
        }
    }

    setupTasksView() {
        // Delegação de evento para clique na tarefa
        const list = document.querySelector('#tasks-view .list, .view.active .list');
        if (list) {
            list.addEventListener('click', (e) => {
                const item = e.target.closest('.list-item');
                if (item) {
                    const id = item.dataset.id;
                    const task = store.getTasks().find(t => t.id == id);
                    if (task) this.showTaskModal(task);
                }
            });
        }
    }

    setupProductsView() {
        const list = document.getElementById('products-list');
        list?.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item');
            if (item) {
                const id = item.dataset.id;
                const product = store.getProducts().find(p => p.id == id);
                if (product) this.showProductModal(product);
            }
        });

        // Inicializar gráfico de vendas
        this.renderProductSalesChart();
    }

    renderProductSalesChart() {
        const orders = store.getOrders();
        const products = store.getProducts();
        
        // Calcular vendas totais por produto
        const salesData = {};
        orders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const pid = item.product_id;
                    const qty = parseInt(item.quantidade || 0);
                    salesData[pid] = (salesData[pid] || 0) + qty;
                });
            }
        });

        // Mapear para formato do gráfico e ordenar
        const chartData = products
            .map(p => ({
                name: p.nome,
                sales: salesData[p.id] || 0
            }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5); // Mostrar top 5

        const chartContainer = document.getElementById('product-sales-chart');
        if (!chartContainer) return;

        if (chartData.length === 0 || chartData.every(d => d.sales === 0)) {
            chartContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px; color: var(--text-tertiary); text-align: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
                        <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                    <p>Dados de vendas insuficientes para gerar o ranking.</p>
                </div>
            `;
            return;
        }

        const options = {
            series: [{
                name: 'Quantidade Vendida',
                data: chartData.map(d => d.sales)
            }],
            chart: {
                type: 'bar',
                height: 280,
                toolbar: { show: false },
                fontFamily: 'Outfit, sans-serif'
            },
            plotOptions: {
                bar: {
                    borderRadius: 10,
                    horizontal: true,
                    barHeight: '55%',
                    distributed: true,
                    dataLabels: { position: 'bottom' }
                }
            },
            colors: ['#5d59e1', '#ff8e6e', '#5aabf8', '#4ad991', '#9b51e0'],
            dataLabels: {
                enabled: true,
                textAnchor: 'start',
                style: { colors: ['#fff'], fontWeight: 600 },
                formatter: function (val, opt) {
                    return opt.w.globals.labels[opt.dataPointIndex] + ": " + val + " un";
                },
                offsetX: 0,
                dropShadow: { enabled: false }
            },
            stroke: { show: true, width: 2, colors: ['transparent'] },
            xaxis: {
                categories: chartData.map(d => d.name),
                labels: { show: false },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: { labels: { show: false } },
            grid: { show: false },
            fill: { opacity: 1 },
            tooltip: {
                y: { formatter: function (val) { return val + " unidades"; } }
            },
            legend: { show: false }
        };

        const chart = new ApexCharts(chartContainer, options);
        chart.render();
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
window.addOrderItemRow = function() {
    const products = store.getProducts();
    const container = document.getElementById('order-items');
    const div = document.createElement('div');
    div.className = 'order-item-row';
    div.style = 'display: flex; gap: 6px; margin-bottom: 6px; align-items: center;';
    div.innerHTML = `
        <select class="item-product" style="flex:1;min-width:120px;" onchange="updateOrderItemTotal(this)">
            <option value="">Produto...</option>
            ${products.map(p => `<option value="${p.id}" data-price="${p.custo || 0}" data-comissao="${p.comissao || 0}">${p.nome}</option>`).join('')}
        </select>
        <input type="number" class="item-qty" placeholder="Qtd" style="width:65px;" min="0" step="1" value="1" oninput="updateOrderItemTotal(this)">
        <input type="number" class="item-price" placeholder="0,00" style="width:90px;" step="0.01" value="0" oninput="updateOrderItemTotal(this)">
        <span class="item-subtotal" style="width:100px;font-weight:600;font-size:12px;">R$ 0,00</span>
        <input type="number" class="item-comissao" placeholder="0,00" style="width:75px;" step="0.01" value="0" oninput="updateOrderItemTotal(this)">
        <span class="item-comissao-rs" style="width:80px;font-weight:600;font-size:12px;color:var(--success);">R$ 0,00</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); updateOrderTotal();">×</button>
    `;
    container.appendChild(div);
};

window.updateOrderItemTotal = function(input) {
    const row = input.closest('.order-item-row');
    const productSelect = row.querySelector('.item-product');
    const selectedOption = productSelect?.selectedOptions[0];
    
    if (input.classList.contains('item-product') && input.value) {
        // Se mudou o produto, preenche Preço (padrão) e Comissão (padrão)
        const defaultPrice = parseFloat(selectedOption?.dataset.price) || 0;
        const defaultComissao = parseFloat(selectedOption?.dataset.comissao) || 0;
        
        row.querySelector('.item-price').value = defaultPrice.toFixed(2);
        row.querySelector('.item-comissao').value = defaultComissao.toFixed(2);
    } 

    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const comissao = parseFloat(row.querySelector('.item-comissao')?.value) || 0;
    
    const subtotal = qty * price;
    row.querySelector('.item-subtotal').textContent = 'R$ ' + subtotal.toFixed(2).replace('.', ',');
    
    const comissaoRs = subtotal * (comissao / 100);
    const comissaoRsSpan = row.querySelector('.item-comissao-rs');
    if (comissaoRsSpan) {
        comissaoRsSpan.textContent = 'R$ ' + comissaoRs.toFixed(2).replace('.', ',');
    }
    
    updateOrderTotal();
};

window.updateOrderTotal = function() {
    let subtotal = 0;
    let totalComissao = 0;
    
    document.querySelectorAll('.order-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
        const comissaoPct = parseFloat(row.querySelector('.item-comissao')?.value) || 0;
        
        const rowTotal = qty * price;
        subtotal += rowTotal;
        totalComissao += rowTotal * (comissaoPct / 100);
    });
    
    const subtotalEl = document.getElementById('order-subtotal');
    if (subtotalEl) subtotalEl.textContent = 'R$ ' + subtotal.toFixed(2).replace('.', ',');
    
    const totalEl = document.getElementById('order-total');
    if (totalEl) totalEl.textContent = 'R$ ' + subtotal.toFixed(2).replace('.', ',');
    
    const comissaoEl = document.getElementById('order-comissao-total');
    if (comissaoEl) comissaoEl.textContent = 'R$ ' + totalComissao.toFixed(2).replace('.', ',');
    
    if (typeof window.generateInstallments === 'function') {
        window.generateInstallments();
    }
};

window.handlePaymentMethodChange = function() {
    const method = document.getElementById('tipo_pagamento').value;
    const parcelasSelect = document.getElementById('parcelas');
    
    if (method === 'recebimento' || method === 'avista') {
        parcelasSelect.value = "1";
        parcelasSelect.disabled = true;
    } else {
        parcelasSelect.disabled = false;
    }
    
    generateInstallments();
};

window.generateInstallments = function() {
    const container = document.getElementById('installments-container');
    if (!container) return;
    
    const parcelas = parseInt(document.getElementById('parcelas').value) || 1;
    const dataInicialStr = document.getElementById('data').value;
    const tipoPagamentoEl = document.getElementById('tipo_pagamento');
    const metodoNome = tipoPagamentoEl.options[tipoPagamentoEl.selectedIndex].text;
    
    const subtotalStr = document.getElementById('order-total').textContent.replace('R$ ', '').replace(',', '.');
    const totalPedido = parseFloat(subtotalStr) || 0;
    
    const comissaoStr = document.getElementById('order-comissao-total').textContent.replace('R$ ', '').replace(',', '.');
    const totalComissao = parseFloat(comissaoStr) || 0;
    
    if (parcelas <= 1) {
        container.innerHTML = '';
        return;
    }
    
    if (!dataInicialStr) {
        container.innerHTML = '<div style="color:var(--danger);font-size:12px;">Selecione a data do pedido primeiro.</div>';
        return;
    }
    
    const valorParcela = totalPedido / parcelas;
    const comissaoParcela = totalComissao / parcelas;
    
    let dataAtual = new Date(dataInicialStr);
    dataAtual = new Date(dataAtual.getTime() + dataAtual.getTimezoneOffset() * 60000);
    
    let html = `<div style="margin-top: 8px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                    <h4 style="margin-bottom: 8px; font-size: 14px;">Resumo das Parcelas</h4>
                    <div style="display:flex;gap:6px;font-weight:600;font-size:11px;margin-bottom:4px;">
                        <span style="width:30px">P.</span>
                        <span style="flex:1">Método</span>
                        <span style="width:110px">Data</span>
                        <span style="width:80px">Valor</span>
                        <span style="width:80px">Comissão</span>
                    </div>`;
                    
    for (let i = 1; i <= parcelas; i++) {
        dataAtual.setDate(dataAtual.getDate() + 30);
        const dataFormatada = dataAtual.toISOString().split('T')[0];
        
        html += `<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;font-size:12px;">
                    <span style="width:30px;font-weight:600;">${i}x</span>
                    <span style="flex:1">${metodoNome}</span>
                    <input type="date" style="width:110px;padding:4px;" value="${dataFormatada}">
                    <span style="width:80px">R$ ${valorParcela.toFixed(2).replace('.', ',')}</span>
                    <span style="width:80px;color:var(--success);">R$ ${comissaoParcela.toFixed(2).replace('.', ',')}</span>
                 </div>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
};

// Inicia app
document.addEventListener('DOMContentLoaded', () => app.init());