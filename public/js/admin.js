/**
 * CRM Vendas - View de Admin
 * Gerenciamento de usuários e estatísticas
 */

const API_BASE = '/api';

async function fetchUsers() {
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    console.log('[admin] Token:', token?.substring(0, 20));
    const res = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('[admin] Response status:', res.status);
    const data = await res.json();
    console.log('[admin] Data:', data);
    return data.data || [];
}

async function fetchUserStats(userId) {
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    const res = await fetch(`${API_BASE}/users/${userId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data.data || {};
}

async function deleteUser(userId) {
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
}

async function updateUser(userId, nome, nivel) {
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome, nivel })
    });
}

async function createUser(email, password, nome, nivel) {
    const token = localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, nome, nivel })
    });
    return res.json();
}

function formatarBRL(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const adminView = {
    async render(container) {
        console.log('[Admin] render called');
        container.innerHTML = '<div class="loading">Carregando...</div>';
        
        try {
            const users = await fetchUsers();
            console.log('[Admin] users:', users);
            
            const usersWithStats = await Promise.all(
                users.map(async user => ({
                    ...user,
                    stats: await fetchUserStats(user.id)
                }))
            );
            console.log('[Admin] usersWithStats:', usersWithStats);

            container.innerHTML = this.renderUsersList(usersWithStats);
            this.bindEvents();
        } catch (error) {
            console.error('[Admin] Erro ao carregar:', error);
            container.innerHTML = '<div class="error">Erro ao carregar dados: ' + error.message + '</div>';
        }
    },

    renderUsersList(users) {
        return `
            <div class="admin-container">
                <div class="card">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">Gerenciamento de Usuários</h2>
                        <button class="btn btn-primary" id="btn-new-user">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Novo Usuário
                        </button>
                    </div>
                    
                    <div class="users-grid">
                        ${users.map(user => this.renderUserCard(user)).join('')}
                    </div>
                </div>
            </div>
            
            <style>
                .admin-container { padding: 20px; }
                .users-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 16px;
                }
                .user-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                }
                .user-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }
                .user-card-info h3 {
                    margin: 0 0 4px 0;
                    font-size: 1.1rem;
                }
                .user-card-info p {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .badge-nivel {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .badge-admin {
                    background: #fef3c7;
                    color: #d97706;
                    border: 1px solid #fcd34d;
                }
                .badge-vendedor {
                    background: #f1f5f9;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                }
                .user-stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin: 16px 0;
                    padding: 12px;
                    background: var(--bg-tertiary);
                    border-radius: 8px;
                }
                .stat-item {
                    text-align: center;
                }
                .stat-value {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }
                .user-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                }
            </style>
        `;
    },

    renderUserCard(user) {
        const nivelClass = user.nivel === 'Admin' ? 'badge-admin' : 'badge-vendedor';
        const stats = user.stats || {};
        
        return `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-card-header">
                    <div class="user-card-info">
                        <h3>${user.nome}</h3>
                        <p>${user.email}</p>
                    </div>
                    <span class="badge-nivel ${nivelClass}">${user.nivel}</span>
                </div>
                
                <div class="user-stats">
                    <div class="stat-item">
                        <div class="stat-value">${stats.qtd_vendas || 0}</div>
                        <div class="stat-label">Vendas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${formatarBRL(stats.valor_vendas || 0)}</div>
                        <div class="stat-label">Valor</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.produtos_cadastrados || 0}</div>
                        <div class="stat-label">Produtos</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.culturas_cadastradas || 0}</div>
                        <div class="stat-label">Culturas</div>
                    </div>
                </div>
                
                <div class="user-actions">
                    <button class="btn btn-sm btn-edit-user" data-id="${user.id}" data-nome="${user.nome}" data-nivel="${user.nivel}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete-user" data-id="${user.id}" data-nome="${user.nome}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Excluir
                    </button>
                </div>
            </div>
        `;
    },

    bindEvents() {
        document.getElementById('btn-new-user')?.addEventListener('click', () => this.showUserModal());
        
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showUserModal({
                    id: btn.dataset.id,
                    nome: btn.dataset.nome,
                    nivel: btn.dataset.nivel
                });
            });
        });
        
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm(`Tem certeza que deseja excluir o usuário "${btn.dataset.nome}"?`)) {
                    await deleteUser(btn.dataset.id);
                    this.render(document.getElementById('main-content'));
                }
            });
        });
    },

    showUserModal(user = null) {
        const isEdit = !!user;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>${isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <form id="user-form" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <div class="input-group">
                        <label>Nome Completo *</label>
                        <input type="text" id="user-nome" value="${user?.nome || ''}" placeholder="João Silva" required>
                    </div>
                    ${!isEdit ? `
                    <div class="input-group">
                        <label>E-mail *</label>
                        <input type="email" id="user-email" placeholder="joao@email.com" required>
                    </div>
                    <div class="input-group">
                        <label>Senha *</label>
                        <input type="password" id="user-senha" placeholder="Mínimo 6 caracteres" required minlength="6">
                    </div>
                    ` : ''}
                    <div class="input-group">
                        <label>Nível de Acesso</label>
                        <select id="user-nivel" required>
                            <option value="Vendedor" ${user?.nivel === 'Vendedor' ? 'selected' : ''}>Vendedor</option>
                            <option value="Admin" ${user?.nivel === 'Admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('user-nome').value;
            const nivel = document.getElementById('user-nivel').value;
            
            try {
                if (isEdit) {
                    await updateUser(user.id, nome, nivel);
                } else {
                    const email = document.getElementById('user-email').value;
                    const senha = document.getElementById('user-senha').value;
                    await createUser(email, senha, nome, nivel);
                }
                modal.remove();
                this.render(document.getElementById('main-content'));
            } catch (error) {
                alert('Erro: ' + (error.message || 'Erro ao salvar usuário'));
            }
        });
    }
};

window.adminView = adminView;