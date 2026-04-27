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
export const customersView = {
renderCustomers(container) {
        const customers = db.getAll('customers');
        const orders = db.getAll('orders');
        
        container.innerHTML = `
            <div class="actions-bar m-b-2 animate-fade">
                <div class="search-box">
                    <i data-lucide="search"></i>
                    <input type="text" id="customer-search" placeholder="Buscar por nome, documento ou cultivo...">
                </div>
                <div class="text-muted" style="font-size: 0.9rem;">
                    ${customers.length} clientes encontrados
                </div>
            </div>
            
            <div class="customer-cards-container">
                ${customers.map(c => {
                    const customerOrders = orders.filter(o => o.customerId === c.id);
                    const crop = db.getAll('crops').find(cr => cr.id == c.cropId) || { nome: 'Não definido', cor: '#94a3b8' };
                    
                    return `
                        <div class="customer-card animate-fade">
                            <div class="card-left">
                                <div class="customer-avatar">${c.nome.charAt(0)}</div>
                                <div class="customer-main-info">
                                    <div class="name-row">
                                        <h3 class="customer-name">${c.nome}</h3>
                                        <span class="badge ${this.getStatusClass(c.status)}">${c.status}</span>
                                        <span class="badge" style="background: ${crop.cor}15; color: ${crop.cor}; border: 1px solid ${crop.cor}30;">${crop.nome}</span>
                                    </div>
                                    <div class="customer-sub-info">
                                        <span>${c.localizacao || 'Localização não informada'}</span>
                                        <span class="dot">•</span>
                                        <span>Cliente desde ${new Date(c.createdAt || Date.now()).toLocaleDateString('pt-BR')}</span>
                                        <span class="dot">•</span>
                                        <span><i data-lucide="shopping-bag" style="width: 14px; height: 14px;"></i> ${customerOrders.length} pedido(s)</span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-actions">
                                <a href="https://wa.me/55${c.whatsapp}" target="_blank" class="btn-icon text-success" title="WhatsApp">
                                    <i data-lucide="message-circle"></i>
                                </a>
                                <button class="btn-text btn-edit-customer" data-id="${c.id}">
                                    <i data-lucide="edit-3"></i> Editar
                                </button>
                                <button class="btn-text text-danger btn-delete-customer" data-id="${c.id}">
                                    <i data-lucide="trash-2"></i> Excluir
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        lucide.createIcons();
        this.bindCustomerEvents();
    },

getStatusClass(status) {
        const map = { 
            'Lead': 'badge-warning', 
            'Indicação': 'badge-success', 
            'Contato telefonico': 'badge-info', 
            'Era de outro vendedor': 'badge-danger', 
            'Listagem': 'badge-secondary',
            'Disparo': 'badge-primary'
        };
        return map[status] || 'badge-secondary';
    },

bindCustomerEvents() {
        document.querySelectorAll('.btn-edit-customer').forEach(btn => {
            btn.addEventListener('click', () => this.renderCustomerForm(db.getById('customers', btn.getAttribute('data-id'))));
        });
        
        document.querySelectorAll('.btn-delete-customer').forEach(btn => {
            btn.addEventListener('click', () => {
                if(confirm('Deseja realmente excluir este cliente?')) {
                    db.delete('customers', btn.getAttribute('data-id'));
                    this.renderCustomers(document.getElementById('content-area'));
                }
            });
        });
    },

renderCustomerForm(customer = null) {
        const isEdit = !!customer;
        const crops = db.getAll('crops');
        const orders = db.getAll('orders').filter(o => o.customerId === customer?.id);
        const interactions = db.getAll('interactions').filter(i => i.customerId === customer?.id);
        
        const ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

        const html = `
            <div class="modal-form-container">
                <div class="modal-form-header">
                    <div class="flex align-center gap-2">
                        <h2 style="font-size: 1.25rem; font-weight: 700;">${isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                        ${isEdit ? '<button class="btn btn-primary btn-sm" id="btn-save-customer">Salvar Alterações</button>' : '<button class="btn btn-primary btn-sm" id="btn-save-customer">Salvar Cliente</button>'}
                        ${isEdit ? '<button class="btn btn-secondary btn-sm" id="btn-new-order-modal">+ Novo Pedido</button>' : ''}
                    </div>
                    <button class="btn-icon" onclick="ui.hideModal()"><i data-lucide="x"></i></button>
                </div>

                <form id="customer-form" class="animate-fade">
                    <p class="section-title">DADOS</p>
                    
                    <div class="flex gap-2 m-b-2">
                        <div class="input-group" style="flex: 1;">
                            <label>Nome / Razão Social *</label>
                            <input type="text" id="cust-nome" value="${customer?.nome || ''}" required placeholder="Ex: Carlos da Soja">
                        </div>
                        <div class="input-group" style="flex: 1;">
                            <label>CPF/CNPJ</label>
                            <input type="text" id="cust-doc" value="${customer?.documento || ''}" placeholder="000.000.000-00">
                        </div>
                    </div>

                    <div class="flex gap-2 m-b-2">
                        <div class="input-group" style="flex: 1;">
                            <label>WhatsApp</label>
                            <input type="text" id="cust-wa" value="${customer?.whatsapp || ''}" placeholder="+5500000000000">
                        </div>
                        <div class="input-group" style="flex: 1;">
                            <label>E-mail</label>
                            <input type="email" id="cust-email" value="${customer?.email || ''}" placeholder="email@exemplo.com">
                        </div>
                    </div>

                    <div class="flex gap-2 m-b-2">
                        <div class="input-group" style="flex: 1; position: relative;">
                            <label>Data de Aniversário</label>
                            <input type="date" id="cust-birth" value="${customer?.dataAniversario || ''}" style="width: 100%;">
                            <p class="text-muted" style="font-size: 0.75rem; margin-top: 4px; position: absolute; bottom: -18px; width: 100%;">Serão criadas tarefas na agenda: 1 dia antes e no dia do aniversário.</p>
                        </div>
                        <div class="input-group" style="flex: 1;">
                            <label>&nbsp;</label>
                            <div class="flex justify-between align-center card p-2 bg-input" style="height: 48px; border-radius: 8px; border: 1px solid var(--border-color);">
                                <span class="flex align-center gap-1" style="font-size: 0.85rem;"><i data-lucide="bell" style="width:16px; color: var(--warning);"></i> Lembrete</span>
                                <label class="switch">
                                    <input type="checkbox" id="cust-reminder" ${customer?.lembreteAniversario ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div style="height: 15px;"></div> <!-- Espaçador para o texto absoluto -->

                    <div class="flex gap-2 m-b-2">
                        <div class="input-group" style="flex: 1;">
                            <label>Origem do cliente</label>
                            <select id="cust-status">
                                <option value="Lead" ${customer?.status === 'Lead' ? 'selected' : ''}>Lead</option>
                                <option value="Indicação" ${customer?.status === 'Indicação' ? 'selected' : ''}>Indicação</option>
                                <option value="Contato telefonico" ${customer?.status === 'Contato telefonico' ? 'selected' : ''}>Contato telefonico</option>
                                <option value="Era de outro vendedor" ${customer?.status === 'Era de outro vendedor' ? 'selected' : ''}>Era de outro vendedor</option>
                                <option value="Listagem" ${customer?.status === 'Listagem' ? 'selected' : ''}>Listagem</option>
                                <option value="Disparo" ${customer?.status === 'Disparo' ? 'selected' : ''}>Disparo</option>
                            </select>
                        </div>
                        <div class="input-group" style="flex: 0.5;">
                            <label>Estado (UF)</label>
                            <select id="cust-uf">
                                <option value="">UF</option>
                                ${ufs.map(uf => `<option value="${uf}" ${customer?.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group" style="flex: 1;">
                            <label>Cidade</label>
                            <input type="text" id="cust-city" value="${customer?.cidade || ''}" placeholder="Digite a cidade">
                        </div>
                    </div>

                    <div class="flex gap-2 m-b-2">
                        <div class="input-group" style="flex: 1;">
                            <label>Endereço</label>
                            <input type="text" id="cust-endereco" value="${customer?.endereco || ''}" placeholder="Rua, número, bairro...">
                        </div>
                        <div class="input-group" style="flex: 0.5;">
                            <label>CEP</label>
                            <input type="text" id="cust-cep" value="${customer?.cep || ''}" placeholder="00000-000" maxlength="9">
                        </div>
                    </div>

                    <div class="input-group m-b-2">
                        <label>Complemento</label>
                        <input type="text" id="cust-complemento" value="${customer?.complemento || ''}" placeholder="Apartamento, sala, referência...">
                    </div>

                    <div class="input-group m-b-2">
                        <label>Tipo de Cultivo</label>
                        <select id="cust-crop">
                            <option value="">Selecione o cultivo...</option>
                            ${crops.map(cr => `<option value="${cr.id}" ${customer?.cropId == cr.id ? 'selected' : ''}>${cr.nome}</option>`).join('')}
                        </select>
                    </div>

                    <div class="input-group m-b-3">
                        <label>Observações</label>
                        <textarea id="cust-obs" placeholder="Histórico de interações..." rows="4" style="width: 100%; resize: vertical; border-radius: 8px;">${customer?.observacoes || ''}</textarea>
                    </div>

                    ${isEdit ? `
                    <p class="section-title">HISTÓRICO DE PEDIDOS</p>
                    <div class="history-section m-b-3">
                        ${orders.length > 0 ? orders.map(o => {
                            const items = o.items || [];
                            const productTags = items.map(item => {
                                const prod = db.getById('products', item.productId);
                                return `<span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 0.7rem;">${prod ? prod.nome : 'Produto'}</span>`;
                            }).join(' ');

                            return `
                                <div class="history-item card p-3 m-b-1 animate-fade" 
                                     onclick="window.editOrderFromHistory('${o.id}')"
                                     style="border-left: 4px solid ${o.statusPagamento === 'Pago' ? '#10b981' : '#f59e0b'}; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;"
                                     onmouseenter="this.style.transform='translateY(-2px)'" 
                                     onmouseleave="this.style.transform='translateY(0)'">
                                    <div class="flex justify-between align-start m-b-1" style="pointer-events: none;">
                                        <div>
                                            <div style="font-size: 0.7rem; font-weight: 700; color: var(--primary); margin-bottom: 2px;">PEDIDO #${o.numeroPedido || 'ANTIGO'}</div>
                                            <div class="flex align-center gap-2 m-b-1">
                                                <h3 style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem;">R$ ${o.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                                <span class="badge ${o.statusPagamento === 'Pago' ? 'badge-success' : 'badge-warning'}" style="font-size: 0.65rem; padding: 2px 8px;">${o.statusPagamento.toUpperCase()}</span>
                                            </div>
                                            <div class="flex flex-wrap gap-1">
                                                ${productTags}
                                            </div>
                                        </div>
                                        <div style="text-align: right; pointer-events: none;">
                                            <div class="text-muted" style="font-size: 0.8rem; font-weight: 600; margin-bottom: 4px;">
                                                ${new Date(o.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </div>
                                            <div class="text-muted" style="font-size: 0.75rem;">
                                                <i data-lucide="credit-card" style="width:12px; vertical-align: middle;"></i> ${o.parcelas}x (${o.tipoPagamento})
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<p class="text-muted p-2">Nenhum pedido realizado.</p>'}
                    </div>

                    <p class="section-title">HISTÓRICO DE CONTATOS</p>
                    <div class="add-interaction-box card p-2 m-b-2 bg-input">
                        <label style="font-size: 0.8rem; font-weight: 600; margin-bottom: 8px; display: block;">Registrar Nova Interação</label>
                        <div class="flex gap-1 m-b-1">
                            <input type="text" id="new-interaction-obs" placeholder="Ex: Cliente solicitou orçamento via WhatsApp..." style="flex: 1; font-size: 0.9rem;">
                            <select id="new-interaction-type" style="width: 130px; font-size: 0.9rem;">
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Ligação">Ligação</option>
                                <option value="Visita">Visita</option>
                                <option value="E-mail">E-mail</option>
                            </select>
                            <button type="button" class="btn btn-primary" id="btn-add-interaction" style="padding: 0 15px;">Salvar</button>
                        </div>
                        <div class="flex align-center gap-2" style="padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05);">
                            <label style="font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox" id="int-schedule-return"> 📅 Agendar Retorno?
                            </label>
                            <div id="return-date-container" style="display: none; align-items: center; gap: 6px;">
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">Ligar dia:</span>
                                <input type="date" id="int-return-date" style="padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.75rem;">
                            </div>
                        </div>
                    </div>

                    <div class="history-section" id="interactions-list">
                        <!-- interactions will be loaded here by window.renderInteractionsList -->
                    </div>
                    ` : ''}
                </form>
            </div>
        `;

        ui.showModal(null, html);
        
        // Definir funções globais ANTES de chamá-las
        window.editOrderFromHistory = (orderId) => {
            const order = db.getById('orders', orderId);
            if (order) this.renderOrderForm(order, true);
        };

        window.renderInteractionsList = (customerId) => {
            const listEl = document.getElementById('interactions-list');
            if (!listEl) return;
            const updatedInteractions = db.getAll('interactions').filter(i => i.customerId == customerId);
            if (updatedInteractions.length === 0) {
                listEl.innerHTML = '<p class="text-muted p-2">Nenhuma interação registrada.</p>';
            } else {
                listEl.innerHTML = updatedInteractions.sort((a,b) => new Date(b.data) - new Date(a.data)).map(i => `
                    <div class="history-item card p-2 m-b-1 animate-fade">
                        <div class="flex justify-between m-b-1">
                            <span class="badge badge-info">${i.tipo}</span>
                            <div class="flex align-center gap-2">
                                <span class="text-muted" style="font-size: 0.8rem;">${new Date(i.data).toLocaleDateString('pt-BR')} ${new Date(i.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                <button type="button" class="btn-icon text-primary" onclick="window.editInteraction('${i.id}', '${customerId}')" title="Editar Interação" style="padding: 0;">
                                    <i data-lucide="edit-3" style="width: 14px;"></i>
                                </button>
                                <button type="button" class="btn-icon text-danger" onclick="window.deleteInteraction('${i.id}', '${customerId}')" title="Excluir Interação" style="padding: 0;">
                                    <i data-lucide="trash-2" style="width: 14px;"></i>
                                </button>
                            </div>
                        </div>
                        <p style="font-size: 0.9rem;">${i.observacao}</p>
                    </div>
                `).join('');
            }
            lucide.createIcons();
        };

        window.editInteraction = (interactionId, customerId) => {
            const interaction = db.getById('interactions', interactionId);
            if (!interaction) return;
            const newObs = prompt('Editar observação da interação:', interaction.observacao);
            if (newObs !== null && newObs.trim() !== '') {
                db.update('interactions', interactionId, { observacao: newObs.trim() }).then(() => {
                    window.renderInteractionsList(customerId);
                }).catch(e => alert('Erro ao editar: ' + e.message));
            }
        };

        window.deleteInteraction = (interactionId, customerId) => {
            if (confirm('Deseja realmente excluir esta interação?')) {
                db.delete('interactions', interactionId).then(() => {
                    window.renderInteractionsList(customerId);
                }).catch(e => alert('Erro ao excluir: ' + e.message));
            }
        };

// Máscara de CEP
        const cepInput = document.getElementById('cust-cep');
        if (cepInput) {
            cepInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 5) {
                    value = value.substring(0, 5) + '-' + value.substring(5, 8);
                }
                e.target.value = value;
            });
        }

        // Evento salvar cliente (funciona para criar e editar)
        document.getElementById('btn-save-customer').addEventListener('click', async () => {
            const data = {
                nome: document.getElementById('cust-nome')?.value || '',
                documento: document.getElementById('cust-doc')?.value || '',
                whatsapp: document.getElementById('cust-wa')?.value || '',
                email: document.getElementById('cust-email')?.value || '',
                dataAniversario: document.getElementById('cust-birth')?.value || '',
                lembreteAniversario: document.getElementById('cust-reminder')?.checked || false,
                status: document.getElementById('cust-status')?.value || '',
                uf: document.getElementById('cust-uf')?.value || '',
                cidade: document.getElementById('cust-city')?.value || '',
                endereco: document.getElementById('cust-endereco')?.value || '',
                cep: document.getElementById('cust-cep')?.value || '',
                complemento: document.getElementById('cust-complemento')?.value || '',
                cropId: document.getElementById('cust-crop')?.value || '',
                observacoes: document.getElementById('cust-obs')?.value || '',
                localizacao: `${document.getElementById('cust-city')?.value || ''}/${document.getElementById('cust-uf')?.value || ''}`,
                createdAt: customer?.createdAt || new Date().toISOString()
            };
            
            try {
                if (isEdit && customer) await db.update('customers', customer.id, data);
                else await db.create('customers', data);
                
                ui.hideModal();
                this.renderCustomers(document.getElementById('content-area'));
            } catch(e) {
                alert('Erro ao salvar cliente: ' + e.message);
            }
        });

        // Recursos exclusivos do modo edição (histórico de interações e pedidos)
        if (isEdit) {
            // Renderiza histórico de interações
            window.renderInteractionsList(customer.id);
            lucide.createIcons();

            const returnCheck = document.getElementById('int-schedule-return');
            const returnDateCont = document.getElementById('return-date-container');
            if (returnCheck) {
                returnCheck.addEventListener('change', () => {
                    returnDateCont.style.display = returnCheck.checked ? 'flex' : 'none';
                });
            }

            // Evento para adicionar interação
            document.getElementById('btn-add-interaction').addEventListener('click', async () => {
                if (!customer?.id) return alert('Salve o cliente primeiro para registrar interações.');
                
                const obs = document.getElementById('new-interaction-obs').value;
                const type = document.getElementById('new-interaction-type').value;
                const shouldSchedule = document.getElementById('int-schedule-return').checked;
                const returnDateStr = document.getElementById('int-return-date').value;
                
                if (!obs) return alert('Digite uma observação para o contato.');

                try {
                    await db.create('interactions', {
                        customerId: customer.id,
                        data: new Date().toISOString(),
                        tipo: type,
                        observacao: obs
                    });

                    // Lógica de agendamento automático
                    if (shouldSchedule && returnDateStr) {
                        await db.create('tasks', {
                            titulo: `Retorno: ${customer.nome} (${type})`,
                            data: returnDateStr,
                            prioridade: 'Alta',
                            status: 'Pendente',
                            customerId: customer.id
                        });

                        const rDate = new Date(returnDateStr);
                        rDate.setDate(rDate.getDate() - 1);
                        const reminderDateStr = rDate.toISOString().split('T')[0];

                        await db.create('tasks', {
                            titulo: `Lembrete: Retorno amanhã - ${customer.nome}`,
                            data: reminderDateStr,
                            prioridade: 'Média',
                            status: 'Pendente',
                            customerId: customer.id
                        });

                        alert('Retorno agendado com sucesso!');
                    }

                    // Feedback visual e limpa campo
                    document.getElementById('new-interaction-obs').value = '';
                    if (returnCheck) {
                        returnCheck.checked = false;
                        returnDateCont.style.display = 'none';
                    }
                    
                    window.renderInteractionsList(customer.id);
                } catch(e) {
                    alert('Erro ao salvar interação: ' + e.message);
                }
            });

            // Botão novo pedido
            document.getElementById('btn-new-order-modal').addEventListener('click', () => {
                ui.hideModal();
                this.renderOrderForm({ customerId: customer.id }, false);
            });
        } // fim do if (isEdit)
    },

renderCustomerDetails(customer) {
        const orders = db.getAll('orders').filter(o => o.customerId === customer.id);
        const html = `
            <div class="customer-details">
                <div class="flex justify-between m-b-2">
                    <div><p class="text-muted">Documento</p><p>${customer.documento}</p></div>
                    <div><p class="text-muted">Origem</p><span class="badge ${this.getStatusClass(customer.status)}">${customer.status}</span></div>
                </div>
                <h4>Histórico de Pedidos</h4>
                <table class="data-table">
                    <thead><tr><th>Data</th><th>Valor</th><th>Pagamento</th></tr></thead>
                    <tbody>
                        ${orders.map(o => `<tr><td>${new Date(o.data).toLocaleDateString()}</td><td>R$ ${o.valorTotal}</td><td>${o.tipoPagamento}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
        ui.showModal(`Perfil: ${customer.nome}`, html);
    }

};
