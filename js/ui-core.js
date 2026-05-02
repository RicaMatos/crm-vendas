import { store } from './store.js';
import { auth } from './auth.js';
import { dashboardView } from './views/dashboard.js';
import { customersView } from './views/customers.js';
import { productsView } from './views/products.js';
import { ordersView } from './views/orders.js';
import { cropsView } from './views/crops.js';
import { tasksView } from './views/tasks.js';
import { settingsView } from './views/settings.js';
import { commissionsView } from './views/commissions.js';
import { salesReportView } from './views/salesReport.js';

/* 
   Interface do Usuário (UI) 
   Responsável pela manipulação do DOM e renderização de views.
*/

class UIService {
    constructor() {
        this.app = document.getElementById('app');
        this.modal = this.createModalStructure();
        this.charts = {};
        this.toastContainer = this.createToastContainer();
    }

    createModalStructure() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content animate-fade">
                <div class="modal-header">
                    <h3 id="modal-title">Título do Modal</h3>
                    <button class="btn-icon" id="modal-close"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body" id="modal-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const closeBtn = overlay.querySelector('#modal-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideModal();
        });
        
        const modalContent = overlay.querySelector('.modal-content');
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        return overlay;
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
        return container;
    }

    createFallbackButton(container) {
        container.innerHTML = `<a href="#" id="google-login-fallback" class="btn-google" style="display:flex;justify-content:center;align-items:center;gap:10px;width:100%;max-width:320px;padding:12px 20px;background:#fff;border:1px solid #dadce0;border-radius:4px;cursor:pointer;font-family:Roboto,sans-serif;font-size:14px;color:#3c4043;transition:background 0.2s;text-decoration:none;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.5v5.44h7.11c4.16-3.83 6.56-9.47 6.56-15.95z"/>
                <path fill="#34A853" d="M24 46c5.4 0 9.93-1.79 13.25-4.84l-7.11-5.44c-1.79 1.19-4.09 1.89-6.14 1.89-4.72 0-8.73-3.19-10.16-7.49-3.4 6.35-10.16 10.72 10.16 10.72z"/>
                <path fill="#FBBC05" d="M13.84 27.51c.22-1.61.77-3.15 1.7-4.51v-5.44H7.11c-2.68 1.79-4.22 4.44-4.22 7.61s1.54 5.82 4.22 7.61l.03-.22z"/>
                <path fill="#EA4335" d="M24 12.75c2.63 0 4.99.91 6.84 2.68l5.7-5.7C38.93 6.11 32.4 3 24 3 15.84 3 9.01 6.86 7.1 12.75l6.56 5.09c1.43-4.3 5.44-7.49 10.16-7.49z"/>
            </svg>
            Entrar com Google
        </a>`;
        document.getElementById('google-login-fallback')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showToast('Configure o OAuth Google no Supabase para usar login com Google', 'info');
        });
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        toast.style.cssText = `background: ${colors[type] || colors.info}; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500; animation: slideIn 0.3s ease; min-width: 250px;`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    showModal(title, content) {
        const modalTitle = this.modal.querySelector('#modal-title');
        const modalBody = this.modal.querySelector('#modal-body');

        if (title) {
            modalTitle.parentElement.style.display = 'flex';
            modalTitle.innerHTML = title; 
        } else {
            modalTitle.parentElement.style.display = 'none';
        }

        modalBody.innerHTML = content;
        this.modal.classList.add('active');
        lucide.createIcons();
    }

    hideModal() {
        this.modal.classList.remove('active');
    }

    // Renderiza a tela de login
    renderLogin(error = '') {
        this.app.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">
                        <h1>CRM Senior</h1>
                        <p>Gestão Inteligente de Vendas</p>
                    </div>
                    
                    <div id="login-error" class="error-message ${error ? 'active' : ''}">
                        ${error}
                    </div>

                    <form class="login-form" id="login-form">
                        <div class="input-group">
                            <label for="email">E-mail</label>
                            <input type="email" id="email" placeholder="admin@crm.com" required>
                        </div>
                        <div class="input-group">
                            <label for="senha">Senha</label>
                            <input type="password" id="senha" placeholder="••••••••" required>
                        </div>
                        <div class="input-group" style="flex-direction: row; align-items: center; gap: 8px;">
                            <input type="checkbox" id="remember-me" style="width: auto;">
                            <label for="remember-me" style="margin: 0; font-weight: normal;">Lembrar-me por 7 dias</label>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                            <i data-lucide="log-in"></i> Entrar no Sistema
                        </button>
                    </form>

                    <div class="separator"><span>ou entre com</span></div>
                    <div id="google-login-btn" style="display: flex; justify-content: center; margin-top: 15px;"></div>

                    <div class="login-footer">
                        Não tem uma conta? <a href="#" id="go-to-register">Cadastre-se agora</a><br>
                        Esqueceu sua senha? <a href="#" id="forgot-password">Clique aqui para recuperar</a>
                    </div>
                </div>
            </div>
        `;
        
        lucide.createIcons();
        this.bindLoginEvents();
    }

bindLoginEvents() {
        setTimeout(async () => {
            const btnContainer = document.getElementById("google-login-btn");
            console.log('[UI] initGoogleLogin - container:', !!btnContainer, 'google:', !!window.google);
            if (!btnContainer) return;
            
            // Espera Google carregar
            let attempts = 0;
            while (!window.google && attempts < 10) {
                await new Promise(r => setTimeout(r, 200));
                attempts++;
                console.log('[UI] Esperando Google...', attempts);
            }
            
            if (window.google) {
                try {
                    console.log('[UI] Inicializando Google Login...');
                    google.accounts.id.initialize({
                        client_id: "818698885855-9snmgd349lskd56iba9fcndcp3vrbe36.apps.googleusercontent.com",
                        callback: (res) => this.handleGoogleLogin(res)
                    });
                    google.accounts.id.renderButton(
                        btnContainer,
                        { theme: "outline", size: "large", width: "320", text: "signin_with" }
                    );
                    console.log('[UI] Botão Google renderizado');
                } catch (e) {
                    console.error('[UI] Erro ao inicializar Google Login:', e);
                    this.createFallbackButton(btnContainer);
                }
            } else {
                console.warn('[UI] Google Identity Services não carregou');
                this.createFallbackButton(btnContainer);
            }
        }, 300);

        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const senha = document.getElementById('senha').value;
                const rememberMe = document.getElementById('remember-me')?.checked || false;
                const result = await auth.login(email, senha, rememberMe);
                if (result.success) {
                    await store.fetchAll();
                    this.renderDashboard();
                } else {
                    this.showToast(result.message || 'Email ou senha incorretos', 'error');
                }
            });
        }

        document.getElementById('go-to-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.renderRegister();
        });

        document.getElementById('forgot-password')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.renderForgotPassword();
        });
    }

    renderForgotPassword(error = '') {
        this.app.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">
                        <h1>Criar Conta</h1>
                        <p>Junte-se ao CRM Senior</p>
                    </div>
                    <div id="register-error" class="error-message ${error ? 'active' : ''}">
                        ${error}
                    </div>
                    <form class="login-form" id="register-form">
                        <div class="input-group">
                            <label for="reg-nome">Nome Completo</label>
                            <input type="text" id="reg-nome" placeholder="Seu nome" required>
                        </div>
                        <div class="input-group">
                            <label for="reg-email">E-mail</label>
                            <input type="email" id="reg-email" placeholder="seu@email.com" required>
                        </div>
                        <div class="input-group">
                            <label for="reg-senha">Senha</label>
                            <input type="password" id="reg-senha" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                            <i data-lucide="user-plus"></i> Criar minha conta
                        </button>
                    </form>
                    <div class="login-footer">
                        Já tem uma conta? <a href="#" id="go-to-login">Fazer Login</a>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
        this.bindRegisterEvents();
    }

    renderForgotPassword(error = '') {
        this.app.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">
                        <h1>Recuperar Senha</h1>
                        <p>Digite seu e-mail para receber o link de redefinição</p>
                    </div>
                    <div id="forgot-error" class="error-message ${error ? 'active' : ''}">
                        ${error}
                    </div>
                    <form class="login-form" id="forgot-form">
                        <div class="input-group">
                            <label for="forgot-email">E-mail</label>
                            <input type="email" id="forgot-email" placeholder="seu@email.com" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                            <i data-lucide="mail"></i> Enviar Link de Recuperação
                        </button>
                    </form>
                    <div class="login-footer">
                        Lembrou a senha? <a href="#" id="back-to-login">Voltar para o login</a>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
        this.bindForgotPasswordEvents();
    }

    bindForgotPasswordEvents() {
        const form = document.getElementById('forgot-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('forgot-email').value;
                const btn = form.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<span class="loader" style="width: 16px; height: 16px; margin: 0;"></span> Enviando...';
                
                try {
                    const res = await fetch('/api/auth/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showToast('Link de recuperação enviado para seu e-mail!', 'success');
                        setTimeout(() => this.renderLogin(), 3000);
                    } else {
                        this.renderForgotPassword(data.message);
                    }
                } catch (err) {
                    this.renderForgotPassword('Erro de conexão. Tente novamente.');
                }
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="mail"></i> Enviar Link de Recuperação';
            });
        }
        document.getElementById('back-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.renderLogin();
        });
    }

    bindRegisterEvents() {
        const form = document.getElementById('register-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nome = document.getElementById('reg-nome').value;
                const email = document.getElementById('reg-email').value;
                const senha = document.getElementById('reg-senha').value;
                const result = await auth.register(nome, email, senha);
                if (result.success) {
                    alert('Conta criada com sucesso! Você já pode fazer login.');
                    this.renderLogin();
                } else {
                    this.renderRegister(result.message);
                }
            });
        }
        document.getElementById('go-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.renderLogin();
        });
    }

    async handleGoogleLogin(response) {
        try {
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            const googleUser = {
                id: payload.sub,
                nome: payload.name,
                email: payload.email,
                avatar: payload.picture,
                nivel: 'Vendedor'
            };
            const result = await auth.loginWithGoogle(googleUser);
            if (result.success) {
                await store.fetchAll();
                this.renderDashboard();
            } else {
                this.showToast(result.message || 'Erro ao fazer login com Google', 'error');
            }
        } catch (e) {
            console.error('Erro ao processar login Google:', e);
            this.showToast('Erro ao processar login Google', 'error');
        }
    }

    renderDashboard() {
        const user = auth.getUser();
        this.app.innerHTML = `
            <div class="dashboard-layout">
                <aside class="sidebar">
                    <div class="sidebar-header">
                        <h2>CRM Senior</h2>
                    </div>
                    <nav class="sidebar-nav">
<a href="#" class="nav-item active" data-view="home">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                            </svg>
                            <span>Dashboard</span>
                        </a>
                        <a href="#" class="nav-item" data-view="commissions">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
                            </svg>
                            <span>Comissões</span>
                        </a>
                        <a href="#" class="nav-item" data-view="sales-report">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
                            </svg>
                            <span>Relatórios</span>
                        </a>
                        <a href="#" class="nav-item" data-view="customers">
                            <i data-lucide="users"></i> Clientes
                        </a>
                        <a href="#" class="nav-item" data-view="products">
                            <i data-lucide="package"></i> Produtos
                        </a>
                        <a href="#" class="nav-item" data-view="orders">
                            <i data-lucide="shopping-cart"></i> Pedidos
                        </a>
                        <a href="#" class="nav-item" data-view="tasks">
                            <i data-lucide="calendar"></i> Agenda
                        </a>
<a href="#" class="nav-item" data-view="crops">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 20h10M12 4v16M5 9l7-5 7 5M5 15l7-5 7 5"/>
                            </svg>
                            <span>Tipos de Cultura</span>
                        </a>
                        <a href="#" class="nav-item" data-view="tasks">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            <span>Tarefas</span>
                        </a>
                        ${auth.isAdmin() ? `
                        <a href="#" class="nav-item" data-view="users">
                            <i data-lucide="users"></i> Usuários
                        </a>
                        <a href="#" class="nav-item" data-view="settings">
                            <i data-lucide="settings"></i> Configurações
                        </a>
                        ` : ''}
                    </nav>
                    <div class="sidebar-footer">
                        <div class="user-info">
                            <div class="user-avatar">${user.nome.charAt(0)}</div>
                            <div class="user-details">
                                <span class="user-name">${user.nome}</span>
                                <span class="user-role">${user.nivel}</span>
                            </div>
                        </div>
                        <button id="logout-btn" class="btn-logout" title="Sair">
                            <i data-lucide="log-out"></i>
                        </button>
                    </div>
                </aside>
                <main class="main-content">
                    <header class="topbar">
                        <h1 id="view-title">Dashboard</h1>
                        <div class="topbar-actions">
                            <button class="btn btn-primary" id="topbar-btn-action"><i data-lucide="plus"></i> Novo Pedido</button>
                        </div>
                    </header>
                    <div id="content-area" class="content-area">
                        <div class="loader"></div>
                    </div>
                </main>
            </div>
        `;
        lucide.createIcons();
        this.bindDashboardEvents();
        this.navigate('home');
    }

    bindDashboardEvents() {
        document.getElementById('logout-btn')?.addEventListener('click', () => auth.logout());
        
        // Botão de ação da topbar (Novo Pedido por padrão)
        document.getElementById('topbar-btn-action')?.addEventListener('click', () => {
            const currentView = document.querySelector('.nav-item.active').getAttribute('data-view');
            if (currentView === 'products') this.renderProductForm();
            else if (currentView === 'customers') this.renderCustomerForm();
            else if (currentView === 'crops') this.renderCropForm();
            else if (currentView === 'tasks') this.renderTaskForm();
            else this.renderOrderForm();
        });

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                this.navigate(view);
            });
        });
    }

    navigate(view) {
        const contentArea = document.getElementById('content-area');
        const viewTitle = document.getElementById('view-title');
        const topbarBtn = document.getElementById('topbar-btn-action');
        
        contentArea.innerHTML = '<div class="loader"></div>';
        
        // Ajustar botão da topbar dependendo da view
        if (topbarBtn) {
            if (view === 'commissions' || view === 'sales-report') {
                topbarBtn.style.display = 'none';
            } else {
                topbarBtn.style.display = '';
                if (view === 'products') topbarBtn.innerHTML = '<i data-lucide="plus"></i> Novo Produto';
                else if (view === 'customers') topbarBtn.innerHTML = '<i data-lucide="plus"></i> Novo Cliente';
                else if (view === 'crops') topbarBtn.innerHTML = '<i data-lucide="plus"></i> Novo Tipo';
                else if (view === 'tasks') topbarBtn.innerHTML = '<i data-lucide="plus"></i> Nova Tarefa';
                else topbarBtn.innerHTML = '<i data-lucide="plus"></i> Novo Pedido';
            }
            lucide.createIcons();
        }

        switch(view) {
            case 'home':
                viewTitle.innerText = 'Dashboard Financeiro';
                this.renderHome(contentArea);
                break;
            case 'customers':
                viewTitle.innerText = 'Gestão de Clientes';
                this.renderCustomers(contentArea);
                break;
            case 'products':
                viewTitle.innerText = 'Gestão de Produtos';
                this.renderProducts(contentArea);
                break;
            case 'orders':
                viewTitle.innerText = 'Gestão de Pedidos';
                this.renderOrders(contentArea);
                break;
            case 'tasks':
                viewTitle.innerText = 'Agenda e Tarefas';
                this.renderTasks(contentArea);
                break;
            case 'crops':
                viewTitle.innerText = 'Gestão de Cultivos';
                this.renderCrops(contentArea);
                break;
            case 'commissions':
                viewTitle.innerText = 'Comissões';
                this.renderCommissions(contentArea);
                break;
            case 'sales-report':
                viewTitle.innerText = 'Relatório de Vendas';
                this.renderSalesReport(contentArea);
                break;
            case 'users':
                viewTitle.innerText = 'Gerenciamento de Usuários';
                this.renderSettings(contentArea);
                break;
            case 'settings':
                viewTitle.innerText = 'Configurações do Sistema';
                this.renderSettings(contentArea);
                break;
default:
        contentArea.innerHTML = `<p>View ${view} em construção.</p>`;
        }
    }
}

export const ui = new UIService();

Object.assign(ui, dashboardView, customersView, productsView, ordersView, cropsView, tasksView, settingsView, commissionsView, salesReportView);
window.ui = ui;
