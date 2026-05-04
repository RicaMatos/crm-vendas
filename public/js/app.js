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

// ============================================
// UTILITÁRIOS DE FORMATAÇÃO
// ============================================

function formatarBRL(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                this.updateAdminMenu(data.data.user.nivel);
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

    updateAdminMenu(nivel) {
        const navAdminItem = document.getElementById('nav-admin-item');
        if (navAdminItem) {
            if (nivel === 'Admin') {
                navAdminItem.classList.remove('hidden');
            } else {
                navAdminItem.classList.add('hidden');
            }
        }
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
            sessionStorage.setItem('CRM_TOKEN', data.data.token);
            
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
            sessionStorage.setItem('CRM_TOKEN', data.access_token);
            
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
                nome: userData.user_metadata?.nome || '',
                nivel: 'Vendedor'
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
        
        const navAdminItem = document.getElementById('nav-admin-item');
        if (navAdminItem) {
            if (user.nivel === 'Admin') {
                navAdminItem.classList.remove('hidden');
            } else {
                navAdminItem.classList.add('hidden');
            }
        }
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

        // Google Login - Inicializar
        const initGoogleLogin = () => {
            const btnContainer = document.getElementById('google-login-btn');
            if (!btnContainer || !window.google) return;
            
            try {
                google.accounts.id.initialize({
                    client_id: "818698885855-9snmgd349lskd56iba9fcndcp3vrbe36.apps.googleusercontent.com",
                    callback: handleGoogleLogin
                });
                google.accounts.id.renderButton(btnContainer, {
                    theme: "outline",
                    size: "large",
                    width: "100%"
                });
                console.log('[Auth] Google Login inicializado');
            } catch (e) {
                console.error('[Auth] Erro ao inicializar Google:', e);
            }
        };

        // Google Login - Callback
        const handleGoogleLogin = async (response) => {
            try {
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join(''));
                const payload = JSON.parse(jsonPayload);
                const googleUser = {
                    id: payload.sub,
                    nome: payload.name,
                    email: payload.email,
                    avatar: payload.picture
                };
                console.log('[Auth] Login Google:', googleUser.email);
                await loginWithGoogle(googleUser);
            } catch (e) {
                console.error('[Auth] Erro Google Login:', e);
                ui.showToast('Erro ao fazer login com Google', 'error');
            }
        };

        // Google Login - API call
        const loginWithGoogle = async (googleUser) => {
            try {
                const response = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: googleUser.email,
                        nome: googleUser.nome,
                        googleId: googleUser.id,
                        avatar: googleUser.avatar
                    })
                });
                const data = await response.json();
                if (data.success && data.data) {
                    auth.setUser(data.data.user);
                    auth.token = data.data.token;
                    supabase.setToken(data.data.token);
                    ui.showScreen('main-screen');
                    app.initViews();
                    ui.showToast('Bem-vindo!', 'success');
                } else {
                    ui.showToast(data.message || 'Erro ao fazer login', 'error');
                }
            } catch (e) {
                console.error('[Auth] Erro:', e);
                ui.showToast('Erro de conexão', 'error');
            }
        };

        // Inicializa Google após DOM pronto
        setTimeout(initGoogleLogin, 500);

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
            case 'commissions':
                main.innerHTML = this.renderCommissions();
                this.setupCommissionsView();
                break;
            case 'tasks':
                main.innerHTML = this.renderTasks();
                this.setupTasksView();
                break;
            case 'admin':
                main.innerHTML = '<div id="admin-view-container"></div>';
                this.setupAdminView();
                break;
            case 'import':
                main.innerHTML = this.renderImport();
                this.setupImportView();
                break;
            case 'import':
                main.innerHTML = this.renderImport();
                this.setupImportView();
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
            case 'commissions':
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
        const customers = store.getCustomers();
        
        const currentYear = new Date().getFullYear();
        
        // Calculo de vendas e comissao
        let totalSales = 0;
        let totalSalesEffective = 0;
        let totalCommission = 0;
        const monthlySales = [0,0,0,0,0,0,0,0,0,0,0,0];
        const monthlySalesEffective = [0,0,0,0,0,0,0,0,0,0,0,0];
        
        const productSales = {};
        const stateSales = {};
        
        try {
            orders.forEach(order => {
                let orderValue = parseFloat(order.valor_total) || 0;
                
                // Calcular valor dos items se necessario
                if (orderValue === 0 && order.items) {
                    try {
                        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                        if (Array.isArray(items)) {
                            orderValue = items.reduce((sum, item) => {
                                return sum + ((parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || parseFloat(item.precoUnitario) || 0));
                            }, 0);
                        }
                    } catch(e) {}
                }
                
                // Calcular mes e ano do pedido
                let month = 0;
                let year = currentYear;
                try {
                    const d = new Date(order.data + 'T12:00:00');
                    month = d.getMonth();
                    year = d.getFullYear();
                } catch(e) {}
                
                // Filtrar por ano atual para vendas
                if (year === currentYear) {
                    // Vendas totais (todos os pedidos do ano)
                    monthlySales[month] += orderValue;
                    totalSales += orderValue;
                    
                    // Vendas efetivadas = apenas pedidos com todas as parcelas pagas
                    // (não considera mais automatico por tipo de pagamento)
                    const detalhes = Array.isArray(order.parcelas_detalhes) ? order.parcelas_detalhes : [];
                    const vendaEfetivada = detalhes.length > 0 
                        ? detalhes.every(p => p.status === 'pago' || p.status === 'Pago')
                        : (order.status_pagamento === 'pago' || order.status_pagamento === 'Pago');
                    
                    if (vendaEfetivada) {
                        monthlySalesEffective[month] += orderValue;
                        totalSalesEffective += orderValue;
                    }
                }
                
                // Calculo de comissao baseada em parcelas pagas
                const detalhes = Array.isArray(order.parcelas_detalhes) ? order.parcelas_detalhes : [];
                const items = order.items || order.itens || [];
                
                let taxaComissaoTotal = 0;
                if (orderValue > 0) {
                    items.forEach(item => {
                        const prod = products.find(p => p.id == (item.productId || item.product_id));
                        const taxa = prod ? (parseFloat(prod.comissao) || 0) : 10;
                        const valorItem = (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || parseFloat(item.precoUnitario) || 0);
                        taxaComissaoTotal += (valorItem * taxa / 100);
                    });
                }
                
                // Processar parcelas para comissao (apenas pagas)
                detalhes.forEach(p => {
                    if (!p || !p.vencimento) return;
                    const valor = parseFloat(p.valor);
                    if (valor === null || isNaN(valor)) {
                        if (orderValue > 0 && detalhes.length > 0) {
                            const valorCalc = orderValue / detalhes.length;
                            const comissao = (valorCalc / orderValue) * taxaComissaoTotal;
                            const status = (p.status || '').toLowerCase();
                            if (status === 'pago' || status === 'Pago') {
                                totalCommission += comissao;
                            }
                        }
                    } else {
                        const comissao = orderValue > 0 ? (valor / orderValue) * taxaComissaoTotal : 0;
                        const status = (p.status || '').toLowerCase();
                        if (status === 'pago' || status === 'Pago') {
                            totalCommission += comissao;
                        }
                    }
                });
                
                // Vendas por Estado
                const cust = customers.find(c => c.id == order.customer_id);
                if (cust && cust.uf) {
                    const uf = cust.uf;
                    if (!stateSales[uf]) {
                        stateSales[uf] = { name: uf, total: 0 };
                    }
                    stateSales[uf].total += orderValue;
                }
                
                // Produtos
                try {
                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(items)) {
                        items.forEach(item => {
                            const pid = parseInt(item.productId || item.produto_id || item.id || 0);
                            if (pid) {
                                const prod = products.find(p => p.id === pid);
                                const name = prod ? prod.nome : (item.nome || item.produto || 'Produto');
                                const qty = parseFloat(item.quantidade) || 0;
                                const un = prod ? prod.unidade : (item.unidade || item.und || 'un');
                                
                                if (!productSales[pid]) {
                                    productSales[pid] = { name: name, quantidade: 0, unidade: un };
                                }
                                productSales[pid].quantidade += qty;
                            }
                        });
                    }
                } catch(e) {}
            });
        } catch(e) {
            console.error('Dashboard calc error:', e);
        }
        
        const mesesComMovimentacao = monthlySales.filter(v => v > 0).length || 1;
        const mesesComMovimentacaoEfetiva = monthlySalesEffective.filter(v => v > 0).length || 1;
        console.log('Dashboard final - totalSales:', totalSales, 'totalSalesEffective:', totalSalesEffective, 'months:', mesesComMovimentacao);
        const avgSales = totalSalesEffective / mesesComMovimentacaoEfetiva;
        const avgCommission = totalCommission / mesesComMovimentacaoEfetiva;
        
        const topProducts = Object.entries(productSales)
            .sort((a, b) => b[1].quantidade - a[1].quantidade)
            .slice(0, 10);
        
        const topStates = Object.entries(stateSales)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8);
        
        const totalStateSales = topStates.reduce((s, [k, v]) => s + v.total, 0);
        
        const maxQty = topProducts.length > 0 ? topProducts[0][1].quantidade : 1;
        const maxMonthly = Math.max(...monthlySales, 1);
        
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const cores = ['#2383e2', '#4daa57', '#cb912f', '#e03e3e', '#9b51e0', '#3d7fa8', '#5aabf8', '#ff8e6e', '#6b7280', '#059669'];

return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Dashboard</h1>
                </div>
                
                <!-- KPIs -->
                <div class="stats-grid" style="margin-bottom: 24px;">
                    <div class="stat-card blue">
                        <div class="stat-label">Vendas Totais</div>
                        <div class="stat-value">${formatarBRL(totalSales)}</div>
                    </div>
                    <div class="stat-card orange">
                        <div class="stat-label">Vendas Efetivadas</div>
                        <div class="stat-value">${formatarBRL(totalSalesEffective)}</div>
                    </div>
                    <div class="stat-card green">
                        <div class="stat-label">Comissão Total</div>
                        <div class="stat-value">${formatarBRL(totalCommission)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Comissão Média</div>
                        <div class="stat-value">${formatarBRL(avgCommission)}</div>
                    </div>
                </div>

                <!-- Graficos: Bar + Pizza -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                    <div class="card" style="padding: 20px;">
                        <div class="card-header" style="margin-bottom: 20px;">
                            <h3 class="card-title">Vendas Mensais</h3>
                        </div>
                        <div style="height: 180px; display: flex; align-items: flex-end; gap: 6px; padding: 0 4px;">
                            ${monthlySales.map((valor, i) => {
                                const height = maxMonthly > 0 ? (valor / maxMonthly * 100) : 0;
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                        <div style="font-size: 10px; font-weight: 600; color: var(--text-primary);">R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div style="width: 100%; background: var(--bg-tertiary); border-radius: 4px 4px 0 0; height: 120px; position: relative;">
                                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: ${cores[i]}; border-radius: 4px 4px 0 0; height: ${height}%;"></div>
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-muted);">${meses[i]}</div>
                                    </div>
                                `;
                            }).join('')}
                    </div>
                    </div>
                    
                    <!-- Grafico Pizza: Vendas por Estado -->
                    <div class="card" style="padding: 20px;">
                        <div class="card-header" style="margin-bottom: 16px;">
                            <h3 class="card-title">Vendas por Estado</h3>
                        </div>
                        ${topStates.length > 0 ? `
                            <div style="display: flex; align-items: center; gap: 16px;">
                                <div style="position: relative; width: 120px; height: 120px; flex-shrink: 0;">
                                    <svg viewBox="0 0 42 42" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                                        ${(() => {
                                            let cumulative = 0;
                                            return topStates.map(([uf, data], i) => {
                                                const pct = totalStateSales > 0 ? data.total / totalStateSales : 0;
                                                const dash = pct * 100;
                                                const gap = i === 0 ? 0 : 2;
                                                const prev = cumulative;
                                                cumulative += dash;
                                                return `<circle cx="21" cy="21" r="15" fill="none" stroke="${cores[i]}" stroke-width="7" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${-(prev)}" style="" />`;
                                            }).join('');
                                        })()}
                                        <circle cx="21" cy="21" r="9" fill="var(--bg-primary)" />
                                    </svg>
                                </div>
                                <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                                    ${topStates.map(([uf, data], i) => {
                                        const pct = totalStateSales > 0 ? (data.total / totalStateSales * 100) : 0;
                                        return `
                                            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                                                <div style="width: 8px; height: 8px; border-radius: 2px; background: ${cores[i]}; flex-shrink: 0;"></div>
                                                <span style="flex: 1;">${uf}</span>
                                                <span style="font-weight: 600; color: var(--success);">${pct.toFixed(0)}%</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : '<p style="color: var(--text-muted); text-align: center;">Nenhuma venda</p>'}
</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Produtos Vendidos</h3>
                        </div>
                        ${topProducts.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${topProducts.map(([id, data], index) => {
                                    const perc = maxQty > 0 ? (data.quantidade / maxQty * 100) : 0;
                                    return `
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <div style="width: 6px; height: 6px; border-radius: 50%; background: ${cores[index]};"></div>
                                            <div style="flex: 1; font-size: 12px;">
                                                <div style="display: flex; justify-content: space-between;">
                                                    <span>${data.name}</span>
                                                    <span style="font-weight: 600;">${data.quantidade} ${data.unidade}</span>
                                                </div>
                                                <div style="height: 3px; background: var(--bg-tertiary); border-radius: 2px; margin-top: 2px;">
                                                    <div style="height: 100%; width: ${perc}%; background: ${cores[index]}; border-radius: 2px;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<p style="color: var(--text-muted); padding: 20px; text-align: center;">Nenhuma venda</p>'}
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Pedidos Recentes</h3>
                        </div>
                        ${orders.slice(0, 5).length > 0 ? `
                            <div class="list" id="recent-orders-list">
                            ${orders.slice(0, 5).map(order => {
                                let val = parseFloat(order.valor_total) || 0;
                                try {
                                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                    if (Array.isArray(items)) {
                                        val = items.reduce((s, item) => s + ((parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || parseFloat(item.precoUnitario) || 0)), 0);
                                    }
                                } catch(e) {}
                                return `
                                <div class="list-item" data-id="${order.id}">
                                    <div class="list-item-content">
                                        <div class="list-item-title">${order.numero_pedido || '#'+order.id} <span style="color: var(--success); font-weight: 700; margin-left: 8px;">${formatarBRL(val)}</span></div>
                                        <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                            </div>
                        ` : '<p style="color: var(--text-muted); padding: 20px; text-align: center;">Nenhum pedido</p>'}
                    </div>
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
                <button class="btn-delete" onclick="app.deleteCustomer(${customer.id}, event)" title="Excluir">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
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
        let paidCount = 0;
        let totalCount = parseInt(order.parcelas || 1);
        let parcelasDetalhes = [];
        
        try {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            if (Array.isArray(items) && items.length > 0) {
                calculatedTotal = items.reduce((sum, item) => sum + ((item.quantidade || 0) * (item.valorUnitario || item.precoUnitario || 0)), 0);
            }
            
            parcelasDetalhes = typeof order.parcelas_detalhes === 'string' ? JSON.parse(order.parcelas_detalhes) : (order.parcelas_detalhes || []);
            paidCount = parcelasDetalhes.filter(p => p.status === 'pago' || p.status === 'Pago').length;
        } catch (e) {}

        const dataPedido = order.data ? new Date(order.data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const tipoPagamentoLabel = {
            'avista': 'À Vista',
            'boleto': 'Boleto',
            'parcelado': 'Parcelado',
            'credito': 'Cartão 1x',
            'recebimento': 'Recebimento'
        }[order.tipo_pagamento] || order.tipo_pagamento || 'À Vista';
        
        // Calcula status real baseado nas parcelas (não mais no tipo de pagamento)
        // qualquer forma de pagamento (avista, boleto, parcelado, credito 1x) 
        // só será considerada paga quando a parcela estiver marcada como "Pago"
        let statusReal = 'pendente';
        if (parcelasDetalhes.length > 0) {
            const todasPagas = parcelasDetalhes.every(p => p.status === 'pago' || p.status === 'Pago');
            statusReal = todasPagas ? 'pago' : 'pendente';
        } else if (order.status_pagamento === 'pago' || order.status_pagamento === 'Pago') {
            statusReal = 'pago';
        }

        const infoParcelas = (order.tipo_pagamento !== 'recebimento') ? `<span class="badge badge-info" style="text-transform: uppercase;">${paidCount} parcela${paidCount !== 1 ? 's' : ''} paga${paidCount !== 1 ? 's' : ''} de ${totalCount}</span>` : '';
        
        return `
            <div class="list-item" data-id="${order.id}">
                <div class="list-item-content">
                    <div class="list-item-title">${order.numero_pedido || 'Pedido #' + order.id} <span style="color: var(--success); font-weight: 700; margin-left: 8px;">${formatarBRL(calculatedTotal)}</span></div>
                    <div class="list-item-subtitle">${order.customers?.nome || 'Cliente'}</div>
                    <div class="list-item-badges">
                        <span class="badge badge-info">${dataPedido}</span>
<span class="badge badge-info">${tipoPagamentoLabel}</span>
                        <span class="badge badge-info">${totalCount}x</span>
                        ${infoParcelas}
                    </div>
                </div>
                <div class="list-item-meta">
                    <span class="badge badge-${statusReal}" style="text-transform: uppercase;">${statusReal}</span>
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
                                                    <span style="font-size: 14px; font-weight: 700; color: var(--success);">${formatarBRL(data.valor)}</span>
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

    renderCommissions(yearFilter = null) {
        const orders = store.getOrders() || [];
        const products = store.getProducts() || [];
        
        let currentYear = yearFilter || new Date().getFullYear().toString();
        
        if (!currentYear) {
            const selectedYearEl = document.getElementById('commFilterYear');
            currentYear = selectedYearEl ? selectedYearEl.value : new Date().getFullYear().toString();
        }
        
        const availableYears = [...new Set(orders.map(o => {
            if (!o.data) return null;
            const d = new Date(o.data);
            return isNaN(d.getTime()) ? null : d.getFullYear().toString();
        }).filter(y => y))];
        
        if (!availableYears.includes(currentYear)) availableYears.push(currentYear);
        availableYears.sort((a,b) => b - a);
        
        const yearNum = parseInt(currentYear);
        const nextPayday = this.getNextPayday();
        
        let totalComissaoRecebida = 0;
        let totalComissaoAReceber = 0;
        let totalParcelasRecebidas = 0;
        let totalParcelasAReceber = 0;
        let comissaoProximo15 = 0;
        let comissaoProximo30 = 0;

        const monthlyReceived = new Array(12).fill(0);
        const monthlyToReceive = new Array(12).fill(0);

        const allInstallments = [];
        const allProjectedInstallments = [];

        const filteredOrders = orders.filter(o => o.data);

        filteredOrders.forEach(o => {
            const detalhes = Array.isArray(o.parcelas_detalhes) ? o.parcelas_detalhes : [];
            const items = o.items || o.itens || [];
            
            let valorTotalPedido = parseFloat(o.valor_total) || 0;
            if (valorTotalPedido === 0 && items.length > 0) {
                valorTotalPedido = items.reduce((sum, item) => {
                    return sum + ((parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || parseFloat(item.precoUnitario) || 0));
                }, 0);
            }

            let taxaComissaoTotal = 0;
            if (valorTotalPedido > 0) {
                items.forEach(item => {
                    const prod = products.find(p => p.id == (item.productId || item.product_id));
                    const taxa = prod ? (parseFloat(prod.comissao) || 0) : 10;
                    const valorItem = (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || parseFloat(item.precoUnitario) || 0);
                    taxaComissaoTotal += (valorItem * taxa / 100);
                });
            }

            detalhes.forEach(p => {
                if (!p || !p.vencimento) return;
                let valor = parseFloat(p.valor);
                let comissao = parseFloat(p.comissao) || 0;
                if (valor === null || isNaN(valor)) {
                    valor = valorTotalPedido / detalhes.length;
                }
                if (comissao === 0 && valorTotalPedido > 0 && valor > 0) {
                    comissao = (valor / valorTotalPedido) * taxaComissaoTotal;
                }
                const vencimento = new Date(p.vencimento + 'T00:00:00');
                const status = (p.status || '').toLowerCase();
                
                const payday = this.getPaydayForDate(vencimento);
                const paydayYearNum = parseInt(payday.paydayYear);
                const paydayDate = new Date(payday.paydayYear, payday.paydayMonth, payday.payday);
                
                const paydayYear = payday.paydayYear.toString();
                const vencYear = vencimento.getFullYear().toString();
                
                if (vencYear === currentYear) {
                    const mesVencimento = vencimento.getMonth();
                    
                    if (status === 'pago' || status === 'Pago') {
                        allInstallments.push({ valor, comissao, vencimento, payday: paydayDate });
                        totalComissaoRecebida += comissao;
                        totalParcelasRecebidas++;
                        monthlyReceived[mesVencimento] += comissao;
                    }
                    
                    allProjectedInstallments.push({ valor, comissao, vencimento, payday: paydayDate });
                    totalComissaoAReceber += comissao;
                    totalParcelasAReceber++;
                    monthlyToReceive[mesVencimento] += comissao;
                    
                    const next15Date = new Date(nextPayday.date);
                    if (nextPayday.day === 15) {
                        next15Date.setDate(15);
                    } else {
                        next15Date.setMonth(next15Date.getMonth() + 1);
                        next15Date.setDate(15);
                    }
                    const next30Date = new Date(nextPayday.date);
                    if (nextPayday.day === 30) {
                        next30Date.setDate(30);
                    } else {
                        next30Date.setMonth(next30Date.getMonth() + 1);
                        next30Date.setDate(30);
                    }
                    
                    if (payday.payday === 15 && payday.paydayMonth === next15Date.getMonth() && payday.paydayYear === next15Date.getFullYear()) {
                        comissaoProximo15 += comissao;
                    }
                    if (payday.payday === 30 && payday.paydayMonth === next30Date.getMonth() && payday.paydayYear === next30Date.getFullYear()) {
                        comissaoProximo30 += comissao;
                    }
                }
            });
        });

        const projectionLabels = [];
        for (let m = 0; m < 12; m++) {
            const d = new Date(yearNum, m, 1);
            let monthName = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
            projectionLabels.push(`${monthName} 15`, `${monthName} 30`);
        }

        const receivedData = new Array(24).fill(0);
        const projectedData = new Array(24).fill(0);
        
        allInstallments.forEach(inst => {
            const payday = inst.payday;
            if (payday.getFullYear() === yearNum && payday.getMonth() >= 0 && payday.getMonth() <= 11) {
                const is15 = payday.getDate() === 15;
                const idx = payday.getMonth() * 2 + (is15 ? 0 : 1);
                receivedData[idx] += inst.comissao;
            }
        });
        
        allProjectedInstallments.forEach(inst => {
            const payday = inst.payday;
            if (payday.getFullYear() === yearNum && payday.getMonth() >= 0 && payday.getMonth() <= 11) {
                const is15 = payday.getDate() === 15;
                const idx = payday.getMonth() * 2 + (is15 ? 0 : 1);
                projectedData[idx] += inst.comissao;
            }
        });

        const monthlyCommission = new Array(12).fill(0);
        const biweeklyCommission = new Array(24).fill(0);
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const cores = ['#2383e2', '#4daa57', '#cb912f', '#e03e3e', '#9b51e0', '#3d7fa8', '#5aabf8', '#ff8e6e', '#6b7280', '#059669', '#9333ea', '#14b8a6'];
        const coresEscuro = ['#1a6bb8', '#3d8a45', '#a87527', '#b83232', '#7d41b8', '#316687', '#4889c7', '#cc7157', '#5a5d66', '#047854', '#7629ba', '#109489'];
        
// Gráfico de Projeção Quinzenal - APENAS parcelas pagas
        const biweeklyCommissionPaid = new Array(24).fill(0);
        allInstallments.forEach(inst => {
            const vencimento = inst.vencimento;
            const payday = this.getPaydayForDate(vencimento);
            const paydayYearNum = parseInt(payday.paydayYear);
            if (paydayYearNum === yearNum && payday.paydayMonth >= 0 && payday.paydayMonth <= 11) {
                const biweeklyIndex = payday.paydayMonth * 2 + (payday.payday === 15 ? 0 : 1);
                biweeklyCommissionPaid[biweeklyIndex] += inst.comissao;
            }
        });

        // Mantém cálculos existentes com todas as parcelas (para KPIs)
        allProjectedInstallments.forEach(inst => {
            const vencimento = inst.vencimento;
            const payday = this.getPaydayForDate(vencimento);
            const paydayYearNum = parseInt(payday.paydayYear);
            if (paydayYearNum === yearNum && payday.paydayMonth >= 0 && payday.paydayMonth <= 11) {
                monthlyCommission[vencimento.getMonth()] += inst.comissao;
                const biweeklyIndex = payday.paydayMonth * 2 + (payday.payday === 15 ? 0 : 1);
                biweeklyCommission[biweeklyIndex] += inst.comissao;
            }
        });

        const maxMonthlyCommission = Math.max(...monthlyCommission, 1);
        const avgMonthlyCommission = monthlyCommission.reduce((a, b) => a + b, 0) / 12;
        const maxBiweeklyCommission = Math.max(...biweeklyCommissionPaid, 1);
        
        const monthlyToReceiveByPayday = new Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
            monthlyToReceiveByPayday[m] = biweeklyCommission[m * 2] + biweeklyCommission[m * 2 + 1];
        }
        totalComissaoAReceber = monthlyToReceiveByPayday.reduce((a, b) => a + b, 0);
        
        this._monthlyReceived = monthlyReceived;
        this._monthlyToReceive = monthlyToReceiveByPayday;

        return `
            <div class="view active">
                <div class="view-header">
                    <h1 class="view-title">Comissões</h1>
                    <select id="commFilterYear" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; font-size: 0.85rem;">
                        ${availableYears.map(y => `<option value="${y}">${y}</option>`).join('')}
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;">
                    <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--success);">
                        <div class="kpi-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="label"><i data-lucide="check-circle" style="color: #10b981;"></i> COMISSÃO RECEBIDA</div>
                            <select id="filter-received-month" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                                <option value="all">Todos</option>
                                <option value="0">Jan</option>
                                <option value="1">Fev</option>
                                <option value="2">Mar</option>
                                <option value="3">Abr</option>
                                <option value="4">Mai</option>
                                <option value="5">Jun</option>
                                <option value="6">Jul</option>
                                <option value="7">Ago</option>
                                <option value="8">Set</option>
                                <option value="9">Out</option>
                                <option value="10">Nov</option>
                                <option value="11">Dez</option>
                            </select>
                        </div>
                        <div class="kpi-card-body">
                            <div class="value" id="card-received-value">R$ ${totalComissaoRecebida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Parcelas pagas</div>
                        </div>
                    </div>
                    <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--info);">
                        <div class="kpi-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="label"><i data-lucide="clock" style="color: #f97316;"></i> COMISSÃO A RECEBER</div>
                            <select id="filter-toreceive-month" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                                <option value="all">Todos</option>
                                <option value="0">Jan</option>
                                <option value="1">Fev</option>
                                <option value="2">Mar</option>
                                <option value="3">Abr</option>
                                <option value="4">Mai</option>
                                <option value="5">Jun</option>
                                <option value="6">Jul</option>
                                <option value="7">Ago</option>
                                <option value="8">Set</option>
                                <option value="9">Out</option>
                                <option value="10">Nov</option>
                                <option value="11">Dez</option>
                            </select>
                        </div>
                        <div class="kpi-card-body">
                            <div class="value" id="card-toreceive-value">R$ ${totalComissaoAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Dia 15 + 30</div>
                        </div>
                    </div>
                    <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--success);">
                        <div class="kpi-card-header">
                            <div class="label"><i data-lucide="trending-up" style="color: #10b981;"></i> MÉDIA MENSAL</div>
                        </div>
                        <div class="kpi-card-body">
                            <div class="value">R$ ${avgMonthlyCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                    <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid #787774;">
                        <div class="kpi-card-header">
                            <div class="label"><i data-lucide="calendar-check" style="color: #8b5cf6;"></i> PRÓXIMO REC. DIA 15</div>
                        </div>
                        <div class="kpi-card-body">
                            <div class="sub-text">R$ ${comissaoProximo15.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Parcelas pagas</div>
                        </div>
                    </div>
                    <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid #787774;">
                        <div class="kpi-card-header">
                            <div class="label"><i data-lucide="calendar-check" style="color: #8b5cf6;"></i> PRÓXIMO REC. DIA 30</div>
                        </div>
                        <div class="kpi-card-body">
                            <div class="sub-text">R$ ${comissaoProximo30.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Parcelas pagas</div>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
                    <div class="card" style="padding: 20px;">
                        <div class="card-header" style="margin-bottom: 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                            <h3 class="card-title" style="margin: 0;">VALOR MENSAL DE COMISSÃO</h3>
                            <span style="font-size: 10px; color: var(--text-muted);">Parcelas pagas + parcelas pendentes</span>
                        </div>
                        <div style="height: 180px; display: flex; align-items: flex-end; gap: 6px; padding: 0 4px;">
                            ${monthlyCommission.map((valor, i) => {
                                const height = maxMonthlyCommission > 0 ? (valor / maxMonthlyCommission * 100) : 0;
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                        <div style="font-size: 10px; font-weight: 600; color: var(--text-primary);">R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div style="width: 100%; background: var(--bg-tertiary); border-radius: 4px 4px 0 0; height: 120px; position: relative;">
                                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: ${cores[i]}; border-radius: 4px 4px 0 0; height: ${height}%;"></div>
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-muted);">${meses[i]}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div class="card" style="padding: 20px;">
                        <div class="card-header" style="margin-bottom: 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                            <h3 class="card-title" style="margin: 0;">PROJEÇÃO QUINZENAL DE COMISSÃO</h3>
                            <span style="font-size: 10px; color: var(--text-muted);">Apenas parcelas pagas</span>
                        </div>
                        <div style="height: 180px; display: flex; align-items: flex-end; gap: 3px; padding: 0 4px;">
                            ${biweeklyCommissionPaid.map((valor, i) => {
                                const monthIndex = Math.floor(i / 2);
                                const is15 = i % 2 === 0;
                                const isLastOfMonth = i % 2 === 1;
                                const height = maxBiweeklyCommission > 0 ? (valor / maxBiweeklyCommission * 100) : 0;
                                const color = is15 ? cores[monthIndex] : coresEscuro[monthIndex];
                                const dayLabel = is15 ? '15' : '30';
                                const marginRight = isLastOfMonth ? '8px' : '0';
                                const labelMonth = meses[monthIndex];
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; margin-right: ${marginRight};">
                                        <div style="font-size: 9px; font-weight: 600; color: var(--text-primary);">${valor > 0 ? 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</div>
                                        <div style="width: 100%; background: var(--bg-tertiary); border-radius: 3px 3px 0 0; height: 120px; position: relative;">
                                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: ${color}; border-radius: 3px 3px 0 0; height: ${height}%;"></div>
                                        </div>
                                        <div style="font-size: 10px; color: var(--text-muted);">${dayLabel}/${labelMonth}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    calculateCommissionForOrder(order, products) {
        const orderItems = order.items || order.itens || [];
        let totalComissao = 0;
        let totalValor = 0;
        
        orderItems.forEach(item => {
            const prod = products.find(p => p.id == item.productId);
            const comissaoProd = prod ? (parseFloat(prod.comissao) || 0) : 0;
            const preco = parseFloat(item.valorUnitario) || 0;
            const qtd = parseInt(item.quantidade) || 0;
            const subtotal = preco * qtd;
            
            totalComissao += (subtotal * comissaoProd / 100);
            totalValor += subtotal;
        });
        
        return { totalComissao, totalValor };
    }

    getNextPayday() {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth();
        const year = today.getFullYear();
        
        let nextDay, nextMonth, nextYear, daysUntil;
        
        if (day <= 12) {
            nextDay = 15;
            nextMonth = month;
            nextYear = year;
            daysUntil = 15 - day;
        } else if (day <= 26) {
            nextDay = 30;
            nextMonth = month;
            nextYear = year;
            daysUntil = 30 - day;
        } else {
            nextDay = 15;
            nextMonth = month + 1;
            nextYear = year;
            if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
            const daysInMonth = new Date(nextYear, nextMonth, 0).getDate();
            daysUntil = daysInMonth - day + 15;
        }
        
        return {
            date: new Date(nextYear, nextMonth, nextDay),
            day: nextDay,
            month: new Date(nextYear, nextMonth, 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', ''),
            daysUntil
        };
    }

    getPaydayForDate(vencimento) {
        const day = vencimento.getDate();
        let payday, paydayMonth, paydayYear;
        
        if (day <= 12) {
            payday = 15;
            paydayMonth = vencimento.getMonth();
            paydayYear = vencimento.getFullYear();
        } else if (day <= 27) {
            payday = 30;
            paydayMonth = vencimento.getMonth();
            paydayYear = vencimento.getFullYear();
        } else {
            payday = 15;
            paydayMonth = vencimento.getMonth() + 1;
            paydayYear = vencimento.getFullYear();
            if (paydayMonth > 11) { paydayMonth = 0; paydayYear += 1; }
        }
        
        return { payday, paydayMonth, paydayYear };
    }

    setupCommissionsView() {
        const yearFilter = document.getElementById('commFilterYear')?.value || new Date().getFullYear().toString();
        const yearNum = parseInt(yearFilter);
        
        setTimeout(() => {
            this.initCommissionsCharts();
            
            document.getElementById('commFilterYear')?.addEventListener('change', (e) => {
                this.updateCommissionsData(e.target.value);
            });
            
            const updateReceivedValue = () => {
                const monthFilter = document.getElementById('filter-received-month')?.value || 'all';
                const cardValue = document.getElementById('card-received-value');
                const monthlyData = this._monthlyReceived || [];
                const totalR = monthlyData.reduce((a, b) => a + b, 0);
                if (monthFilter === 'all') {
                    cardValue.textContent = 'R$ ' + totalR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else {
                    const monthIndex = parseInt(monthFilter);
                    const value = monthlyData[monthIndex] || 0;
                    cardValue.textContent = 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            };
            
            const updateToReceiveValue = () => {
                const monthFilter = document.getElementById('filter-toreceive-month')?.value || 'all';
                const cardValue = document.getElementById('card-toreceive-value');
                const monthlyData = this._monthlyToReceive || [];
                const totalTR = monthlyData.reduce((a, b) => a + b, 0);
                if (monthFilter === 'all') {
                    cardValue.textContent = 'R$ ' + totalTR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else {
                    const monthIndex = parseInt(monthFilter);
                    const value = monthlyData[monthIndex] || 0;
                    cardValue.textContent = 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            };
            
            document.getElementById('filter-received-month')?.addEventListener('change', updateReceivedValue);
            document.getElementById('filter-toreceive-month')?.addEventListener('change', updateToReceiveValue);
}, 100);
}

    initCommissionsCharts() {
        if (typeof Chart === 'undefined') return;
        
        const receivedData = this._commissionReceivedData || [];
        const projectedData = this._commissionProjectedData || [];
        const labels = this._commissionLabels || [];
        
        const ctxC = document.getElementById('chartComissoes');
        if (!ctxC || labels.length === 0) return;
        
        const data15 = receivedData.map((v, i) => i % 2 === 0 ? v : 0);
        const data30 = receivedData.map((v, i) => i % 2 === 1 ? v : 0);
        const proj15 = projectedData.map((v, i) => i % 2 === 0 ? v : 0);
        const proj30 = projectedData.map((v, i) => i % 2 === 1 ? v : 0);

        new Chart(ctxC, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Recebido 15', data: data15, backgroundColor: '#10b981', borderRadius: 3 },
                    { label: 'Recebido 30', data: data30, backgroundColor: '#059669', borderRadius: 3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#94a3b8', boxWidth: 12, padding: 15, font: { size: 10 } } },
                    datalabels: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#787774', font: { size: 10 } }, grid: { display: false } },
                    y: { ticks: { color: '#787774', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    updateCommissionsData(yearFilter) {
        const main = document.querySelector('.main-content');
        const yearSelect = document.getElementById('commFilterYear');
        const selectedYear = yearSelect ? yearSelect.value : new Date().getFullYear().toString();
        if (main) {
            main.innerHTML = this.renderCommissions(selectedYear);
            this.setupCommissionsView();
        }
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
                <button class="btn-delete" onclick="app.deleteCrop(${crop.id}, event)" title="Excluir">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
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
                <button class="btn-delete" onclick="app.deleteProduct(${product.id}, event)" title="Excluir">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
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
            
            // Verificar tipos de tarefa no dia
            const hasAniversario = dayTasks.some(t => t.titulo?.startsWith('Aniversário'));
            const hasObservacao = dayTasks.some(t => t.titulo?.startsWith('Observação'));
            
            let taskClass = 'has-task';
            let dotClass = '';
            if (hasAniversario) {
                taskClass = 'has-aniversario';
                dotClass = 'aniversario';
            } else if (hasObservacao) {
                taskClass = 'has-observacao';
                dotClass = 'observacao';
            }
            
            daysHtml += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${hasTask ? taskClass : ''}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${hasTask ? `<span class="task-dot ${dotClass}">${dayTasks.length}</span>` : ''}
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
                            ${tasks.length > 0 ? tasks.sort((a, b) => new Date(a.data) - new Date(b.data)).slice(0, 8).map(t => {
                                const isAniversario = t.titulo?.startsWith('Aniversário');
                                const isObservacao = t.titulo?.startsWith('Observação');
                                const borderColor = isAniversario ? '#9C27B0' : (isObservacao ? '#FF9800' : 'var(--primary)');
                                return `
                                <div class="list-item" data-id="${t.id}" style="border-left: 3px solid ${borderColor}">
                                    <div class="list-item-content">
                                        <div class="list-item-title">${t.titulo}</div>
                                        <div class="list-item-subtitle">${new Date(t.data).toLocaleDateString('pt-BR')}</div>
                                    </div>
                                    <span class="badge badge-${t.status}">${t.status}</span>
                                </div>
                                `;
                            }).join('') : this.renderEmptyState('Nenhuma tarefa', 'Crie tarefas para acompanhar')}
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
        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        
        let adminUserSelect = '';
        if (isAdmin && !isEdit) {
            adminUserSelect = `
                <div class="form-group">
                    <label for="target-user-id">Cadastrar para usuário:</label>
                    <select id="target-user-id" name="user_id" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary);">
                        <option value="${user.id}">${user.nome} (eu)</option>
                    </select>
                </div>
            `;
        }
        
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
                    ${adminUserSelect}
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
                    
                    <div class="form-row" style="align-items: flex-end;">
                        <div class="form-group" style="flex: 1;">
                            <label for="data_aniversario">Data de Aniversário</label>
                            <input type="date" id="data_aniversario" name="data_aniversario" value="${customer?.data_aniversario || ''}">
                        </div>
                        <div class="form-group" style="flex: 1; display: flex; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; height: 42px; border: 1px solid var(--border-color); border-radius: 8px; padding: 0 12px; background: var(--bg-tertiary); width: 100%;">
                                <input type="checkbox" id="lembrete_aniversario" name="lembrete_aniversario" ${customer?.lembrete_aniversario ? 'checked' : ''}>
                                <span>Lembrete automático</span>
                            </label>
                        </div>
                    </div>
                    
                    ${isEdit ? `
                    <div id="observations-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">Últimos Contatos</h4>
                        <div id="observations-list" style="max-height: 150px; overflow-y: auto; margin-bottom: 12px; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; background: var(--bg-tertiary);">
                            <div style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 10px;">Carregando...</div>
                        </div>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <textarea id="new-observation" placeholder="Nova observação..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); resize: none; height: 80px;"></textarea>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 8px;">
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem;">
                                <input type="checkbox" id="create-task-obs">
                                <span>Criar lembrete na agenda</span>
                            </label>
                            <input type="date" id="task-datetime-obs" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); font-size: 0.85rem;">
                        </div>
                        <button type="button" class="btn btn-primary" onclick="saveObservation(${customer?.id || 0})" style="white-space: nowrap;">Salvar Observação</button>
                    </div>
` : ''}
                    
                    <div class="btn-group">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
                    </div>
                </form>
            </div>
        `;
        
        ui.showModal(modalContent);
        
        // Carregar observações do cliente
        if (customer?.id) {
            setTimeout(() => window.loadObservations(customer.id), 100);
        }
        
        if (isAdmin && !isEdit) {
            setTimeout(() => window.loadUsersForModal('target-user-id'), 100);
        }
        
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
        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        
        window.currentEditingOrder = order;
        
        if (customers.length === 0 && !isEdit) {
            ui.showToast('Cadastre um cliente primeiro', 'warning');
            return;
        }
        
        let adminUserSelect = '';
        if (isAdmin && !isEdit) {
            adminUserSelect = `
                <div class="form-group">
                    <label for="target-user-id">Cadastrar para usuário:</label>
                    <select id="target-user-id" name="user_id" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary);">
                        <option value="${user.id}">${user.nome} (eu)</option>
                    </select>
                </div>
            `;
        }
        
        const modalTitle = isEdit ? 'Editar Pedido ' + (order?.numero_pedido || '#' + order?.id) : 'Novo Pedido';
        const dataPedido = order?.data ? new Date(order.data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const tipoPagamentoMap = { avista: 'À Vista', parcelado: 'Parcelado', credito: 'Cartão de Crédito', recebimento: 'Recebimento', boleto: 'Boleto' };
        const tipoPagamento = tipoPagamentoMap[order?.tipo_pagamento] || order?.tipo_pagamento || 'Cartão de Crédito';
        const parcelas = order?.parcelas || 1;
        
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
                    ${adminUserSelect}
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
                                    <span class="item-subtotal" style="width:100px;font-weight:600;font-size:12px;">${formatarBRL((item.quantidade || 1) * (item.valorUnitario || item.precoUnitario || 0))}</span>
                                    <input type="number" class="item-comissao" placeholder="0,00" style="width:75px;" step="0.01" value="${item.comissao || products.find(p => p.id == (item.productId || item.product_id))?.comissao || 0}" oninput="updateOrderItemTotal(this)">
                                    <span class="item-comissao-rs" style="width:80px;font-weight:600;font-size:12px;color:var(--success);">${formatarBRL(((item.quantidade || 1) * (item.valorUnitario || item.precoUnitario || 0)) * ((item.comissao || products.find(p => p.id == (item.productId || item.product_id))?.comissao || 0) / 100))}</span>
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
        
        if (isAdmin && !isEdit) {
            setTimeout(() => window.loadUsersForModal('target-user-id'), 100);
        }
        
        if (isEdit) {
            setTimeout(() => updateOrderTotal(), 100);
        }
        
        document.getElementById('order-form')?.addEventListener('submit', (e) => {
            this.handleOrderSubmit(e, isEdit);
        });
    }

    showCropModal(crop = null) {
        const isEdit = !!crop;
        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        
        let adminUserSelect = '';
        if (isAdmin && !isEdit) {
            adminUserSelect = `
                <div class="form-group">
                    <label for="target-user-id">Cadastrar para usuário:</label>
                    <select id="target-user-id" name="user_id" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary);">
                        <option value="${user.id}">${user.nome} (eu)</option>
                    </select>
                </div>
            `;
        }
        
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
                    ${adminUserSelect}
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
        
        if (isAdmin && !isEdit) {
            setTimeout(() => window.loadUsersForModal('target-user-id'), 100);
        }
        
        document.getElementById('crop-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const rawData = Object.fromEntries(formData.entries());
            
            const user = auth.user;
            const isAdmin = user?.nivel === 'Admin';
            
            const data = {};
            for (const [key, value] of Object.entries(rawData)) {
                if (value !== '' && value !== null && value !== undefined) {
                    if (key === 'id') {
                        data[key] = parseInt(value);
                    } else if (key === 'user_id' && isAdmin && value !== user.id) {
                        data[key] = value;
                    } else if (key !== 'user_id') {
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
        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        
        let adminUserSelect = '';
        if (isAdmin && !isEdit) {
            adminUserSelect = `
                <div class="form-group">
                    <label for="target-user-id">Cadastrar para usuário:</label>
                    <select id="target-user-id" name="user_id" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary);">
                        <option value="${user.id}">${user.nome} (eu)</option>
                    </select>
                </div>
            `;
        }
        
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
                    ${adminUserSelect}
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
        
        if (isAdmin && !isEdit) {
            setTimeout(() => window.loadUsersForModal('target-user-id'), 100);
        }
        
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
        
        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        
        const data = {};
        for (const [key, value] of Object.entries(rawData)) {
            if (value !== '' && value !== null && value !== undefined) {
                if (key === 'id' || key === 'crop_id' || key === 'user_id') {
                    data[key] = key === 'user_id' ? value : parseInt(value);
                } else {
                    data[key] = value;
                }
            }
        }
        
        if (isAdmin && data.user_id === user.id) {
            delete data.user_id;
        }
        
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
        
        // Coleta detalhes das parcelas do container
        const installmentsRows = document.querySelectorAll('#installments-container .installment-row');
        const parcelas_detalhes = [];
        
        installmentsRows.forEach((row, index) => {
            const dateInput = row.querySelector('input[type="date"]');
            const statusBtn = row.querySelector('.status-toggle');
            const valorStr = row.querySelector('.installment-valor').textContent.replace('R$ ', '').replace(',', '.');
            const comissaoStr = row.querySelector('.installment-comissao').textContent.replace('R$ ', '').replace(',', '.');
            
            parcelas_detalhes.push({
                numero: index + 1,
                vencimento: dateInput?.value,
                valor: parseFloat(valorStr),
                comissao: parseFloat(comissaoStr),
                status: statusBtn?.dataset.status || 'pendente'
            });
        });

        // Calcula status global do pedido baseado nas parcelas
        // Agora qualquer forma de pagamento (avista, boleto, parcelado, credito 1x) 
        // não é considerada automaticamente como venda efetivada
        // Venda efetivada = quando a parcela for marcada como "Pago"
        const todasPagas = parcelas_detalhes.length > 0 && parcelas_detalhes.every(p => p.status === 'pago' || p.status === 'Pago');
        let status_pagamento = todasPagas ? 'pago' : 'pendente';

        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        const targetUserId = document.getElementById('target-user-id')?.value;
        
        const orderData = {
            customerId: parseInt(customerId),
            data,
            tipoPagamento,
            parcelas,
            observacoes,
            valorTotal,
            items,
            parcelas_detalhes,
            status_pagamento
        };
        
        if (isAdmin && targetUserId && targetUserId !== user.id) {
            orderData.user_id = targetUserId;
        }
        
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

    async deleteCustomer(id, event) {
        event.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir este cliente? Isso também poderá afetar pedidos vinculados.')) return;
        
        try {
            const response = await fetch(`${API_BASE}/customers/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });
            
            if (!response.ok) throw new Error('Erro ao excluir cliente');
            
            ui.showToast('Cliente excluído!', 'success');
            this.renderView('customers');
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async deleteProduct(id, event) {
        event.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });
            
            if (!response.ok) throw new Error('Erro ao excluir produto');
            
            ui.showToast('Produto excluído!', 'success');
            this.renderView('products');
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async deleteCrop(id, event) {
        event.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir este tipo de cultura?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/crops/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });
            
            if (!response.ok) throw new Error('Erro ao excluir cultura');
            
            ui.showToast('Cultura excluída!', 'success');
            this.renderView('crops');
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async handleProductSubmit(e, isEdit) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const rawData = Object.fromEntries(formData.entries());
        
        const user = auth.user;
        const isAdmin = user?.nivel === 'Admin';
        
        const data = {
            quantidade: parseInt(rawData.quantidade) || 0,
            custo: parseFloat(rawData.custo) || 0,
            comissao: parseFloat(rawData.comissao) || 0
        };
        
        if (rawData.nome) data.nome = rawData.nome;
        if (rawData.unidade) data.unidade = rawData.unidade;
        if (rawData.descricao) data.descricao = rawData.descricao;
        
        if (isAdmin && rawData.user_id && rawData.user_id !== user.id) {
            data.user_id = rawData.user_id;
        }
        
        const endpoint = isEdit ? `products/${rawData.id}` : 'products';
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

    async setupAdminView() {
        if (typeof adminView !== 'undefined') {
            const container = document.getElementById('admin-view-container');
            if (container) {
                await adminView.render(container);
            }
        }
    }

    // ============================================
    // IMPORTAR CLIENTES
    // ============================================

    renderImport() {
        return `
        <div class="page-container">
            <div class="page-header">
                <h1><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Importar Clientes</h1>
                <p class="page-subtitle">Faça upload de um arquivo com dados de clientes. A IA extrai automaticamente as informações.</p>
            </div>

            <div class="import-container">
                <!-- Upload Area -->
                <div class="upload-area" id="upload-area">
                    <div class="upload-content">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted);">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p class="upload-title">Arraste o arquivo aqui ou clique para selecionar</p>
                        <p class="upload-hint">Formatos aceitos: CSV, XLSX, PDF, TXT (máx. 10MB)</p>
                    </div>
                    <input type="file" id="file-input" accept=".csv,.xlsx,.xls,.pdf,.txt" hidden>
                </div>

                <!-- Loading -->
                <div class="import-loading hidden" id="import-loading">
                    <div class="loading-spinner"></div>
                    <p id="import-status">Enviando arquivo para análise...</p>
                </div>

                <!-- Results -->
                <div class="import-results hidden" id="import-results">
                    <div class="results-header">
                        <div class="results-summary">
                            <span class="results-count" id="results-count">0</span>
                            <span class="results-label">cliente(s) encontrados</span>
                            <span class="results-file" id="results-file"></span>
                        </div>
                        <div class="results-actions">
                            <button class="btn btn-secondary" id="import-reset-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                Novo Arquivo
                            </button>
                            <button class="btn btn-primary" id="import-confirm-btn" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                Importar Clientes
                            </button>
                        </div>
                    </div>
                    <div class="table-wrapper" id="import-table-wrapper" style="overflow-x: auto;">
                        <table class="table" id="import-preview-table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;">
                                        <input type="checkbox" id="select-all-import" checked>
                                    </th>
                                    <th>Nome</th>
                                    <th>Documento</th>
                                    <th>WhatsApp</th>
                                    <th>Email</th>
                                    <th>Cidade/UF</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="import-preview-body"></tbody>
                        </table>
                    </div>
                    <div class="results-footer">
                        <p id="import-error-count" class="import-error-count hidden"></p>
                    </div>
                </div>

                <!-- Erro -->
                <div class="import-error hidden" id="import-error">
                    <p id="import-error-message"></p>
                    <button class="btn btn-secondary" id="import-error-btn">Tentar Novamente</button>
                </div>
            </div>
        </div>`;
    }

    setupImportView() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const importLoading = document.getElementById('import-loading');
        const importResults = document.getElementById('import-results');
        const importError = document.getElementById('import-error');
        const importErrorMsg = document.getElementById('import-error-message');
        const importStatus = document.getElementById('import-status');
        const previewBody = document.getElementById('import-preview-body');
        const resultsCount = document.getElementById('results-count');
        const resultsFile = document.getElementById('results-file');
        const confirmBtn = document.getElementById('import-confirm-btn');
        const resetBtn = document.getElementById('import-reset-btn');
        const selectAll = document.getElementById('select-all-import');
        const errorBtn = document.getElementById('import-error-btn');

        let clientesData = [];

        // === EVENTOS DE UPLOAD ===

        function resetView() {
            importResults.classList.add('hidden');
            importError.classList.add('hidden');
            importLoading.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            fileInput.value = '';
            clientesData = [];
        }

        // Clique na área de upload
        uploadArea.addEventListener('click', () => fileInput.click());

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                processFile(e.target.files[0]);
            }
        });

        // === PROCESSAMENTO ===

        async function processFile(file) {
            // Valida extensão
            const validExts = ['.csv', '.xlsx', '.xls', '.pdf', '.txt'];
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            if (!validExts.includes(ext)) {
                showError(`Formato não suportado: ${ext}. Use CSV, XLSX, PDF ou TXT.`);
                return;
            }

            // Valida tamanho
            if (file.size > 10 * 1024 * 1024) {
                showError('Arquivo muito grande. Limite máximo: 10MB.');
                return;
            }

            uploadArea.classList.add('hidden');
            importLoading.classList.remove('hidden');
            importError.classList.add('hidden');
            importStatus.textContent = 'Enviando arquivo para análise...';

            try {
                const formData = new FormData();
                formData.append('file', file);

                importStatus.textContent = 'IA está extraindo os dados...';

                const token = auth.token || localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');

                const response = await fetch(`${API_BASE}/import/customers/preview`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const result = await response.json();

                if (!result.success) {
                    showError(result.message || 'Erro ao processar arquivo');
                    return;
                }

                const data = result.data;
                clientesData = data.clientes || [];

                if (clientesData.length === 0) {
                    showError('Nenhum cliente identificado no arquivo. Verifique o formato dos dados.');
                    return;
                }

                // Renderiza preview
                importLoading.classList.add('hidden');
                renderPreview(clientesData, file.name);
                importResults.classList.remove('hidden');

            } catch (error) {
                console.error('[import] Erro:', error);
                showError(error.message || 'Erro de conexão ao processar arquivo');
            }
        }

        function renderPreview(clientes, filename) {
            resultsCount.textContent = clientes.length;
            resultsFile.textContent = `Arquivo: ${filename}`;
            confirmBtn.disabled = false;

            previewBody.innerHTML = clientes.map((c, i) => {
                const cidadeUf = [c.cidade, c.uf].filter(Boolean).join('/') || '-';
                const status = validarStatusExibicao(c.status);
                const statusClass = status ? `status-badge status-${status.toLowerCase()}` : '';
                return `
                <tr>
                    <td><input type="checkbox" class="import-row-checkbox" data-index="${i}" checked></td>
                    <td><strong>${escapeHtml(c.nome || '-')}</strong></td>
                    <td>${escapeHtml(formatarDocumento(c.documento))}</td>
                    <td>${escapeHtml(formatarWhatsApp(c.whatsapp))}</td>
                    <td>${escapeHtml(c.email || '-')}</td>
                    <td>${escapeHtml(cidadeUf)}</td>
                    <td><span class="${statusClass}">${status || '-'}</span></td>
                </tr>`;
            }).join('');

            // Atualiza contagem ao marcar/desmarcar
            document.querySelectorAll('.import-row-checkbox').forEach(cb => {
                cb.addEventListener('change', updateConfirmButton);
            });

            selectAll.addEventListener('change', () => {
                document.querySelectorAll('.import-row-checkbox').forEach(cb => {
                    cb.checked = selectAll.checked;
                });
                updateConfirmButton();
            });

            updateConfirmButton();
        }

        function updateConfirmButton() {
            const checked = document.querySelectorAll('.import-row-checkbox:checked').length;
            confirmBtn.textContent = checked > 0
                ? `Importar ${checked} cliente${checked > 1 ? 's' : ''}`
                : 'Nenhum cliente selecionado';
            confirmBtn.disabled = checked === 0;
        }

        function showError(message) {
            importLoading.classList.add('hidden');
            importResults.classList.add('hidden');
            uploadArea.classList.add('hidden');
            importError.classList.remove('hidden');
            importErrorMsg.textContent = message;
        }

        // === BOTÕES ===

        resetBtn.addEventListener('click', resetView);

        errorBtn.addEventListener('click', resetView);

        confirmBtn.addEventListener('click', async () => {
            const selectedIndices = [];
            document.querySelectorAll('.import-row-checkbox:checked').forEach(cb => {
                selectedIndices.push(parseInt(cb.dataset.index));
            });

            if (selectedIndices.length === 0) return;

            const token = auth.token || localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
            const clientesParaImportar = selectedIndices.map(i => clientesData[i]);

            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0 auto;"></div>';

            try {
                const response = await fetch(`${API_BASE}/import/customers/confirm`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ clientes: clientesParaImportar })
                });

                const result = await response.json();

                if (result.success) {
                    ui.showToast(result.message || 'Clientes importados com sucesso!', 'success');

                    // Recarrega dados
                    if (typeof store !== 'undefined') {
                        await store.fetchAll();
                    }

                    resetView();
                } else {
                    ui.showToast(result.message || 'Erro ao importar clientes', 'error');
                    confirmBtn.disabled = false;
                    updateConfirmButton();
                }
            } catch (error) {
                ui.showToast('Erro de conexão ao importar', 'error');
                confirmBtn.disabled = false;
                updateConfirmButton();
            }
        });

        // === UTILITÁRIOS ===

        function escapeHtml(text) {
            if (!text) return '-';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatarDocumento(doc) {
            if (!doc) return '-';
            const nums = String(doc).replace(/\D/g, '');
            if (nums.length === 11) {
                return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            }
            if (nums.length === 14) {
                return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            }
            return String(doc);
        }

        function formatarWhatsApp(whats) {
            if (!whats) return '-';
            const nums = String(whats).replace(/\D/g, '');
            if (nums.length === 13) {
                return `+${nums[0]} (${nums.substring(1,3)}) ${nums.substring(3,7)}-${nums.substring(7)}`;
            }
            if (nums.length === 12) {
                return `+${nums.substring(0,2)} (${nums.substring(2,4)}) ${nums.substring(4,8)}-${nums.substring(8)}`;
            }
            if (nums.length === 11) {
                return `(${nums.substring(0,2)}) ${nums.substring(2,7)}-${nums.substring(7)}`;
            }
            return String(whats);
        }

        function validarStatusExibicao(status) {
            if (!status) return null;
            const statusValidos = ['Lead', 'Prospect', 'Cliente', 'Inativo'];
            const s = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            return statusValidos.includes(s) ? s : 'Lead';
        }
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
    row.querySelector('.item-subtotal').textContent = formatarBRL(subtotal);
    
    const comissaoRs = subtotal * (comissao / 100);
    const comissaoRsSpan = row.querySelector('.item-comissao-rs');
    if (comissaoRsSpan) {
        comissaoRsSpan.textContent = formatarBRL(comissaoRs);
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
    if (subtotalEl) subtotalEl.textContent = formatarBRL(subtotal);
    
    const totalEl = document.getElementById('order-total');
    if (totalEl) totalEl.textContent = formatarBRL(subtotal);
    
    const comissaoEl = document.getElementById('order-comissao-total');
    if (comissaoEl) comissaoEl.textContent = formatarBRL(totalComissao);
    
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

window.toggleInstallmentStatus = function(btn) {
    const currentStatus = btn.dataset.status;
    const newStatus = currentStatus === 'pendente' ? 'pago' : 'pendente';
    
    btn.dataset.status = newStatus;
    btn.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    
    if (newStatus === 'pago') {
        btn.style.background = 'var(--success)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--success)';
    } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--warning)';
        btn.style.borderColor = 'var(--warning)';
    }
};

window.generateInstallments = function() {
    const container = document.getElementById('installments-container');
    if (!container) return;
    
    const parcelasCount = parseInt(document.getElementById('parcelas').value) || 1;
    const dataInicialStr = document.getElementById('data').value;
    const tipoPagamentoEl = document.getElementById('tipo_pagamento');
    const metodoNome = tipoPagamentoEl.options[tipoPagamentoEl.selectedIndex].text;
    
    let totalPedido = 0;
    let totalComissao = 0;
    
    // Primeiro tenta ler dos elementos do DOM
    const totalEl = document.getElementById('order-total');
    if (totalEl && totalEl.textContent) {
        const subtotalStr = totalEl.textContent.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
        totalPedido = parseFloat(subtotalStr) || 0;
    }
    
    const comissaoEl = document.getElementById('order-comissao-total');
    if (comissaoEl && comissaoEl.textContent) {
        const comissaoStr = comissaoEl.textContent.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
        totalComissao = parseFloat(comissaoStr) || 0;
    }
    
    // Se ainda estiver 0, calcula diretamente dos itens
    if (totalPedido === 0) {
        document.querySelectorAll('.order-item-row').forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
            const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
            const comissaoPct = parseFloat(row.querySelector('.item-comissao')?.value) || 0;
            totalPedido += qty * price;
            totalComissao += (qty * price) * (comissaoPct / 100);
        });
    }
    
    if (tipoPagamentoEl.value === 'recebimento') {
        container.innerHTML = '';
        return;
    }
    
    if (!dataInicialStr) {
        container.innerHTML = '<div style="color:var(--danger);font-size:12px;padding:10px;text-align:center;background:var(--bg-tertiary);border-radius:8px;">Selecione a data do pedido primeiro para gerar as parcelas.</div>';
        return;
    }

    // Tenta recuperar parcelas existentes se for o mesmo pedido e mesma quantidade
    let existingParcelas = [];
    if (window.currentEditingOrder && window.currentEditingOrder.parcelas == parcelasCount) {
        existingParcelas = typeof window.currentEditingOrder.parcelas_detalhes === 'string' 
            ? JSON.parse(window.currentEditingOrder.parcelas_detalhes) 
            : (window.currentEditingOrder.parcelas_detalhes || []);
    }
    
    const valorParcela = totalPedido / parcelasCount;
    const comissaoParcela = totalComissao / parcelasCount;
    
    let dataAtual = new Date(dataInicialStr);
    // Ajuste de timezone
    dataAtual = new Date(dataAtual.getTime() + dataAtual.getTimezoneOffset() * 60000);
    
    let html = `<div style="margin-top: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px; border: 1px solid var(--border-color);">
                    <h4 style="margin-bottom: 12px; font-size: 14px; color: var(--text-primary); font-weight: 600;">Resumo das Parcelas</h4>
                    <div style="display:grid; grid-template-columns: 40px 1fr 130px 100px 100px 90px; gap:8px; font-weight:700; font-size:11px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-color); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                        <span>P.</span>
                        <span>Método</span>
                        <span>Vencimento</span>
                        <span style="text-align: right;">Valor</span>
                        <span style="text-align: right;">Comissão</span>
                        <span style="text-align: center;">Status</span>
                    </div>`;
                    
    for (let i = 1; i <= parcelasCount; i++) {
        const existing = existingParcelas.find(p => p.numero == i);
        const dataFormatada = existing ? existing.vencimento : dataAtual.toISOString().split('T')[0];
        const status = existing ? (existing.status || 'pendente') : 'pendente';
        const isPago = status === 'pago' || status === 'Pago';
        
        html += `<div class="installment-row" style="display:grid; grid-template-columns: 40px 1fr 130px 100px 100px 90px; gap:8px; margin-bottom:8px; align-items:center; font-size:13px; color: var(--text-primary);">
                    <span style="font-weight:600; color: var(--text-tertiary);">${i}x</span>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${metodoNome}">${metodoNome}</span>
                    <input type="date" style="width:100%; padding:4px 8px; border-radius:4px; border:1px solid var(--border-color); font-size:12px; background: var(--bg-primary); color: var(--text-primary);" value="${dataFormatada}">
                    <span class="installment-valor" style="text-align: right; font-weight: 600;">${formatarBRL(valorParcela)}</span>
                    <span class="installment-comissao" style="text-align: right; color:var(--success); font-weight: 600;">${formatarBRL(comissaoParcela)}</span>
                    <div style="text-align: center;">
                        <button type="button" class="status-toggle" data-status="${status}" onclick="toggleInstallmentStatus(this)" 
                            style="padding: 2px 8px; border-radius: 12px; border: 1px solid ${isPago ? 'var(--success)' : 'var(--warning)'}; background: ${isPago ? 'var(--success)' : 'transparent'}; color: ${isPago ? 'white' : 'var(--warning)'}; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; min-width: 70px;">
                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    </div>
                 </div>`;
                 
        if (!existing) {
            dataAtual.setMonth(dataAtual.getMonth() + 1);
        }
    }
    
    html += `</div>`;
    container.innerHTML = html;
};

// Inicia app
document.addEventListener('DOMContentLoaded', () => app.init());

// Função global para carregar usuários (usada nos modais de admin)
window.loadUsersForModal = async function(selectId) {
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    const user = JSON.parse(localStorage.getItem('CRM_USER') || localStorage.getItem('CRM_USER'));
    
    if (user?.nivel !== 'Admin') return [];
    
    try {
        const res = await fetch(`${API_BASE}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const users = data.data || [];
        
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = `<option value="${user.id}">${user.nome} (eu)</option>` +
                users.filter(u => u.id !== user.id).map(u => 
                    `<option value="${u.id}">${u.nome}</option>`
                ).join('');
        }
        return users;
    } catch (e) {
        console.error('Erro ao carregar usuários:', e);
        return [];
    }
};

// Função global para carregar observações do cliente
window.loadObservations = async function(customerId) {
    if (!customerId) {
        document.getElementById('observations-list').innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 10px;">Cliente não selecionado</div>';
        return;
    }
    
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    try {
        const res = await fetch(`${API_BASE}/interactions?customer_id=${customerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const list = document.getElementById('observations-list');
        
        if (!data.data || data.data.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 10px;">Nenhuma observação registrada</div>';
            return;
        }
        
        list.innerHTML = data.data.map(obs => {
            const dataFormatada = new Date(obs.data).toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `<div style="padding: 8px; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">${dataFormatada}</div>
                <div style="color: var(--text-primary);">${obs.observacao || ''}</div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Erro ao carregar observações:', e);
    }
};

// Função global para salvar observação
window.saveObservation = async function(customerId) {
    if (!customerId) {
        ui.showToast('Cliente não selecionado', 'error');
        return;
    }
    
    const input = document.getElementById('new-observation');
    const observacao = input.value.trim();
    
    if (!observacao) {
        ui.showToast('Digite uma observação', 'warning');
        return;
    }
    
    const createTask = document.getElementById('create-task-obs')?.checked;
    const taskDate = document.getElementById('task-datetime-obs')?.value;
    const taskDatetime = taskDate ? taskDate + 'T10:00:00' : null;
    
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    try {
        const res = await fetch(`${API_BASE}/interactions`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customer_id: customerId, observacao })
        });
        const data = await res.json();
        
        if (data.success) {
            if (createTask && taskDatetime) {
                const cliente = store.getCustomers().find(c => c.id === customerId);
                const taskRes = await fetch(`${API_BASE}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        titulo: 'Observação: ' + observacao.substring(0, 50),
                        descricao: observacao,
                        data: taskDatetime,
                        cliente_id: customerId,
                        cliente_nome: cliente?.nome || ''
                    })
                });
                const taskData = await taskRes.json();
                if (taskData.success) {
                    ui.showToast('Observação e lembrete salvos!', 'success');
                } else {
                    ui.showToast('Observação salva, mas erro ao criar lembrete', 'warning');
                }
            } else {
                ui.showToast('Observação salva!', 'success');
            }
            input.value = '';
            window.loadObservations(customerId);
        } else {
            ui.showToast(data.message || 'Erro ao salvar', 'error');
        }
    } catch (e) {
        console.error('Erro ao salvar observação:', e);
        ui.showToast('Erro ao salvar', 'error');
    }
};