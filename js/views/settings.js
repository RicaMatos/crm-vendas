import { store } from '../store.js';
import { ui } from '../ui-core.js';
import { auth } from '../auth.js';

const db = {
    getAll: (col) => store.getState()[col] || [],
    getById: (col, id) => (store.getState()[col] || []).find(x => x.id == parseInt(id)),
    create: async (col, data) => await store.add(col, data),
    update: async (col, id, data) => await store.update(col, id, data),
    delete: async (col, id) => await store.remove(col, id),
    db: { settings: { ai_api_key: '' } }
};

const API_URL = '/api';

async function fetchUsers() {
    const token = sessionStorage.getItem('CRM_TOKEN');
    const res = await fetch(`${API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
}

export const settingsView = {
    async renderSettings(container) {
        const users = auth.isAdmin() ? await fetchUsers() : [];
        container.innerHTML = `
            <div class="grid-2 animate-fade">
                <div class="card">
                    <h3 class="m-b-2">Gerenciamento de Usuários</h3>
                    ${auth.isAdmin() ? `
                        <div class="actions-bar m-b-2">
                            <div class="search-box">
                                <i data-lucide="search"></i>
                                <input type="text" id="user-search" placeholder="Buscar usuário...">
                            </div>
                            <div class="text-muted">${users.length} usuários</div>
                        </div>
                        <div class="customer-cards-container" id="users-list">
                            ${users.map(u => `
                                <div class="customer-card animate-fade">
                                    <div class="card-left">
                                        <div class="customer-avatar" style="background: #ecfdf5; color: #059669;">
                                            <i data-lucide="user" style="width: 20px; height: 20px;"></i>
                                        </div>
                                        <div class="customer-main-info">
                                            <div class="name-row">
                                                <h3 class="customer-name">${u.nome}</h3>
                                                <span class="badge" style="background: ${u.nivel === 'Admin' ? '#fef3c7' : '#f1f5f9'}; color: ${u.nivel === 'Admin' ? '#d97706' : '#64748b'}; border: 1px solid ${u.nivel === 'Admin' ? '#fcd34d' : '#e2e8f0'};">${u.nivel}</span>
                                            </div>
                                            <div class="customer-sub-info">
                                                <span>${u.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="card-actions">
                                        <button class="btn-text btn-edit-user" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-nivel="${u.nivel}">
                                            <i data-lucide="edit-3"></i> Editar
                                        </button>
                                        ${u.id !== 1 ? `
                                        <button class="btn-text text-danger btn-delete-user" data-id="${u.id}">
                                            <i data-lucide="trash-2"></i> Excluir
                                        </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-primary" id="new-user-btn" style="margin-top: 15px;">
                            <i data-lucide="user-plus"></i> Novo Usuário
                        </button>
                    ` : '<p class="text-muted">Apenas administradores podem gerenciar usuários.</p>'}
                </div>
                <div class="card">
                    <h3 class="m-b-2">I.A. Settings</h3>
                    <div class="input-group"><label>API Key</label><input type="password" value="${db.db.settings.ai_api_key}"></div>
                </div>
            </div>
        `;
        lucide.createIcons();
        this.bindSettingsEvents();
        
        document.getElementById('user-search')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#users-list .customer-card').forEach(card => {
                const name = card.querySelector('.customer-name').innerText.toLowerCase();
                card.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    },

    bindSettingsEvents() {
        document.getElementById('new-user-btn')?.addEventListener('click', () => this.renderUserForm());
        
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                this.renderUserForm({
                    id: btn.getAttribute('data-id'),
                    nome: btn.getAttribute('data-nome'),
                    email: btn.getAttribute('data-email'),
                    nivel: btn.getAttribute('data-nivel')
                });
            });
        });
        
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                if(confirm('Tem certeza que deseja excluir este usuário?')) {
                    const token = sessionStorage.getItem('CRM_TOKEN');
                    await fetch(`${API_URL}/users/${btn.getAttribute('data-id')}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    this.renderSettings(document.getElementById('content-area'));
                }
            });
        });
    },

    renderUserForm(user = null) {
        const isEdit = !!user;
        const html = `
            <form id="user-form" style="display: flex; flex-direction: column; gap: 15px;">
                <div class="input-group">
                    <label>Nome Completo *</label>
                    <input type="text" id="user-nome" value="${user?.nome || ''}" placeholder="João Silva" required>
                </div>
                <div class="input-group">
                    <label>E-mail *</label>
                    <input type="email" id="user-email" value="${user?.email || ''}" placeholder="joao@email.com" required ${isEdit ? 'disabled' : ''}>
                </div>
                ${!isEdit ? `
                <div class="input-group">
                    <label>Senha *</label>
                    <input type="password" id="user-senha" placeholder="••••••••" required>
                </div>
                ` : ''}
                <div class="input-group">
                    <label>Nível de Acesso</label>
                    <select id="user-nivel" required>
                        <option value="Vendedor" ${user?.nivel === 'Vendedor' ? 'selected' : ''}>Vendedor</option>
                        <option value="Admin" ${user?.nivel === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div class="modal-footer" style="padding: 10px 0 0 0;">
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px;">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
                    </button>
                </div>
            </form>
        `;
        this.showModal(isEdit ? 'Editar Usuário' : 'Novo Usuário', html);
        
        document.getElementById('user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = sessionStorage.getItem('CRM_TOKEN');
            const nome = document.getElementById('user-nome').value;
            const nivel = document.getElementById('user-nivel').value;
            
            try {
                if (isEdit) {
                    await fetch(`${API_URL}/users/${user.id}`, {
                        method: 'PUT',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ nome, nivel })
                    });
                } else {
                    const email = document.getElementById('user-email').value;
                    const senha = document.getElementById('user-senha').value;
                    await fetch(`${API_URL}/users`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ nome, email, senha, nivel })
                    });
                }
                this.hideModal();
                this.renderSettings(document.getElementById('content-area'));
            } catch(err) {
                alert('Erro ao salvar usuário: ' + err.message);
            }
        });
    }
};
