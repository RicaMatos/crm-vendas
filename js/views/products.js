import { store } from '../store.js';
import { ui } from '../ui-core.js';


// Wrapper temporário para refatoração suave
const db = {
    getAll: (col) => store.getState()[col] || [],
    getById: (col, id) => (store.getState()[col] || []).find(x => x.id == parseInt(id)),
    create: async (col, data) => await store.add(col, data),
    update: async (col, id, data) => await store.update(col, id, data),
    delete: async (col, id) => await store.remove(col, id),
    db: { settings: { ai_api_key: '' } }
};
export const productsView = {
renderProducts(container) {
        const products = db.getAll('products');
        container.innerHTML = `
            <div class="actions-bar m-b-2 animate-fade">
                <div class="search-box">
                    <i data-lucide="search"></i>
                    <input type="text" id="product-search" placeholder="Buscar produto...">
                </div>
                <div class="text-muted" style="font-size: 0.9rem;">
                    ${products.length} produtos cadastrados
                </div>
            </div>

            <div class="customer-cards-container">
                ${products.map(p => `
                    <div class="customer-card animate-fade">
                        <div class="card-left">
                            <div class="customer-avatar" style="background: #eff6ff; color: #2563eb;">
                                <i data-lucide="package" style="width: 20px; height: 20px;"></i>
                            </div>
                            <div class="customer-main-info">
                                <div class="name-row">
                                    <h3 class="customer-name">${p.nome}</h3>
                                    <span class="badge" style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;">${p.quantidade}${p.unidade}</span>
                                    <span class="badge" style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;">${p.comissao || 0}% comissão</span>
                                </div>
                                <div class="customer-sub-info">
                                    <span>Custo: R$ ${p.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    ${p.descricao ? `<span class="dot">•</span> <span>${p.descricao}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="btn-text btn-edit-product" data-id="${p.id}">
                                <i data-lucide="edit-3"></i> Editar
                            </button>
                            <button class="btn-text text-danger btn-delete-product" data-id="${p.id}">
                                <i data-lucide="trash-2"></i> Excluir
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        lucide.createIcons();
        this.bindProductEvents();

        // Busca de produtos
        document.getElementById('product-search')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.customer-card');
            cards.forEach(card => {
                const name = card.querySelector('.customer-name').innerText.toLowerCase();
                card.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    },

bindProductEvents() {
        document.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', () => this.renderProductForm(db.getById('products', btn.getAttribute('data-id'))));
        });
        document.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', () => { if(confirm('Excluir?')) { db.delete('products', btn.getAttribute('data-id')); this.renderProducts(document.getElementById('content-area')); } });
        });
    },

renderProductForm(product = null) {
        const isEdit = !!product;
        const html = `
            <form id="product-form" style="display: flex; flex-direction: column; gap: 15px;">
                <div class="input-group">
                    <label>Nome do Produto *</label>
                    <input type="text" id="prod-nome" value="${product?.nome || ''}" placeholder="Ex: Óleo de Coco" required>
                </div>
                
                <div class="flex gap-2">
                    <div class="input-group" style="flex: 1;">
                        <label>Quantidade</label>
                        <input type="number" step="0.01" id="prod-qty" value="${product?.quantidade || 0}" required>
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Unidade</label>
                        <select id="prod-un" required>
                            <option value="UN" ${product?.unidade === 'UN' ? 'selected' : ''}>un (Unidade)</option>
                            <option value="G" ${product?.unidade === 'G' ? 'selected' : ''}>g (Grama)</option>
                            <option value="KG" ${product?.unidade === 'KG' ? 'selected' : ''}>kg (Kilogramas)</option>
                            <option value="L" ${product?.unidade === 'L' ? 'selected' : ''}>l (Litros)</option>
                            <option value="ML" ${product?.unidade === 'ML' ? 'selected' : ''}>ml (Mililitros)</option>
                        </select>
                    </div>
                </div>

                <div class="flex gap-2">
                    <div class="input-group" style="flex: 1;">
                        <label>Custo do Produto (R$)</label>
                        <input type="number" step="0.01" id="prod-custo" value="${product?.custo || 0}" required>
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Comissão (%)</label>
                        <input type="number" step="0.1" id="prod-comissao" value="${product?.comissao || 0}" required>
                    </div>
                </div>

                <div class="input-group">
                    <label>Descrição</label>
                    <textarea id="prod-desc" placeholder="Descrição adicional..." rows="3" style="width: 100%; resize: vertical;">${product?.descricao || ''}</textarea>
                </div>

                <div class="modal-footer" style="padding: 10px 0 0 0;">
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px;">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Produto'}
                    </button>
                </div>
            </form>
        `;
        this.showModal(isEdit ? 'Editar Produto' : 'Novo Produto', html);
        
        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                nome: document.getElementById('prod-nome').value,
                quantidade: parseFloat(document.getElementById('prod-qty').value),
                unidade: document.getElementById('prod-un').value,
                custo: parseFloat(document.getElementById('prod-custo').value),
                comissao: parseFloat(document.getElementById('prod-comissao').value),
                descricao: document.getElementById('prod-desc').value
            };
            try {
                if (isEdit) await db.update('products', product.id, data);
                else await db.create('products', data);
                this.hideModal();
                this.renderProducts(document.getElementById('content-area'));
            } catch(e) {
                alert('Erro ao salvar produto: ' + e.message);
            }
        });
    }

};
