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
export const cropsView = {
renderCrops(container) {
        const crops = db.getAll('crops');
        container.innerHTML = `
            <div class="animate-fade">
                <div class="m-b-2">
                    <h2 style="font-weight: 700; color: var(--text-primary);">Tipos de Cultivo</h2>
                    <p class="text-muted" style="font-size: 0.9rem;">${crops.length} tipos cadastrados</p>
                </div>

                <div class="crops-list">
                    ${crops.map(c => `
                        <div class="crop-card">
                            <div class="crop-info">
                                <div class="crop-icon-wrapper">
                                    <i data-lucide="leaf" style="width: 20px;"></i>
                                </div>
                                <span class="crop-name">${c.nome}</span>
                            </div>
                            <div class="crop-actions">
                                <button class="crop-btn-action btn-edit-crop" data-id="${c.id}">
                                    <i data-lucide="edit-3" style="width: 16px;"></i> Editar
                                </button>
                                <button class="crop-btn-action text-danger btn-delete-crop" data-id="${c.id}">
                                    <i data-lucide="trash-2" style="width: 16px;"></i> Excluir
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        lucide.createIcons();
        this.bindCropEvents();
    },

bindCropEvents() {
        document.querySelectorAll('.btn-edit-crop').forEach(btn => {
            btn.addEventListener('click', () => {
                const crop = db.getById('crops', btn.getAttribute('data-id'));
                this.renderCropForm(crop);
            });
        });

        document.querySelectorAll('.btn-delete-crop').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Deseja excluir este cultivo?')) {
                    db.delete('crops', btn.getAttribute('data-id'));
                    this.renderCrops(document.getElementById('content-area'));
                }
            });
        });
    },

renderCropForm(crop = null) {
        const isEdit = !!crop;
        const html = `
            <form id="crop-form">
                <div class="input-group">
                    <label>Nome do Cultivo</label>
                    <input type="text" id="crop-nome" value="${crop?.nome || ''}" required placeholder="Ex: Milho Safrinha">
                </div>
                <div class="input-group">
                    <label>Observações</label>
                    <textarea id="crop-obs" placeholder="Detalhes sobre este cultivo..." rows="3" style="width: 100%; resize: vertical;">${crop?.observacoes || ''}</textarea>
                </div>
                <div class="modal-footer" style="padding: 20px 0 0 0;">
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Salvar Cultivo</button>
                </div>
            </form>
        `;
        this.showModal(isEdit ? 'Editar Cultivo' : 'Novo Cultivo', html);
        document.getElementById('crop-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                nome: document.getElementById('crop-nome').value,
                observacoes: document.getElementById('crop-obs').value,
                cor: '#2563eb' // Cor padrão fixa
            };
            try {
                if (isEdit) await db.update('crops', crop.id, data);
                else await db.create('crops', data);
                this.hideModal();
                this.renderCrops(document.getElementById('content-area'));
            } catch(e) {
                alert('Erro ao salvar cultivo: ' + e.message);
            }
        });
    }

};
