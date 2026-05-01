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
export const ordersView = {
    charts: {},

    calculateOrderCommission(items, products) {
        let totalComissao = 0;
        let totalValor = 0;
        (items || []).forEach(item => {
            const prod = products.find(p => p.id == item.productId);
            const comissaoProd = item.comissao !== undefined ? parseFloat(item.comissao) : (prod ? (parseFloat(prod.comissao) || 0) : 0);
            const preco = parseFloat(item.valorUnitario) || 0;
            const qtd = parseInt(item.quantidade) || 0;
            const subtotal = preco * qtd;
            totalComissao += (subtotal * comissaoProd / 100);
            totalValor += subtotal;
        });
        return totalValor > 0 ? Math.round((totalComissao / totalValor) * 100) : 0;
    },

    renderOrders(container) {
        const orders = db.getAll('orders');
        const customers = db.getAll('customers');
        
        container.innerHTML = `
            <div class="actions-bar m-b-2 animate-fade">
                <div class="search-box">
                    <i data-lucide="search"></i>
                    <input type="text" id="order-search" placeholder="Buscar por nome do cliente...">
                </div>
                <div class="text-muted" style="font-size: 0.9rem;">
                    ${orders.length} pedidos
                </div>
            </div>

            <div class="customer-cards-container">
                ${orders.sort((a,b) => new Date(b.data) - new Date(a.data)).map(o => {
                    const customer = customers.find(c => c.id === o.customerId) || { nome: 'N/A', whatsapp: '' };
                    const products = db.getAll('products') || [];
                    const orderItems = Array.isArray(o.items) ? o.items : (Array.isArray(o.itens) ? o.itens : []);
                    
                    // Calcula taxa de comissão real do pedido
                    let taxaPonderada = 0;
                    let totalItensVal = 0;
                    orderItems.forEach(item => {
                        const prod = products.find(p => p.id == item.productId);
                        const comProd = item.comissao !== undefined ? parseFloat(item.comissao) : (prod ? (parseFloat(prod.comissao) || 0) : 0);
                        const subtotal = (parseFloat(item.valorUnitario) || 0) * (parseInt(item.quantidade) || 0);
                        taxaPonderada += comProd * subtotal;
                        totalItensVal += subtotal;
                    });
                    const taxaComissao = totalItensVal > 0 ? Math.round(taxaPonderada / totalItensVal) : 0;

                    // Conta parcelas pagas
                    let detalhes = Array.isArray(o.parcelas_detalhes) ? o.parcelas_detalhes : [];
                    const totalParcelasInfo = parseInt(o.parcelas) || 1;
                    
                    // Se não tem detalhes mas tem parcelas > 1, gerar automaticamente
                    if (detalhes.length === 0 && totalParcelasInfo > 1) {
                        const valorPorParcela = o.valorTotal / totalParcelasInfo;
                        const baseDate = o.data ? new Date(o.data) : new Date();
                        detalhes = [];
                        for (let i = 1; i <= totalParcelasInfo; i++) {
                            const date = new Date(baseDate);
                            date.setMonth(baseDate.getMonth() + (i - 1));
                            detalhes.push({
                                numero: i,
                                valor: parseFloat(valorPorParcela.toFixed(2)),
                                vencimento: date.toISOString().split('T')[0],
                                status: 'Pendente'
                            });
                        }
                    }
                    
                    const totalParcelas = detalhes.length || totalParcelasInfo;
                    const parcelasPagas = detalhes.filter(p => p && (p.status === 'Pago' || p.status === 'pago')).length;

                    // Gera HTML das parcelas com botões
                    const parcelasHtml = detalhes.length > 0 ? `
                        <div class="parcelas-list" style="margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px;">
                            ${detalhes.map((p, idx) => {
                                const isPago = p.status === 'Pago' || p.status === 'pago';
                                return `
                                    <button class="btn-status-pill ${isPago ? 'pago' : 'pendente'}" 
                                            data-order-id="${o.id}" 
                                            data-parcela-idx="${idx}"
                                            style="padding: 4px 8px; font-size: 0.65rem;"
                                            title="Clique para alternar status">
                                        <i data-lucide="${isPago ? 'check-circle' : 'circle'}" style="width: 10px; height: 10px;"></i>
                                        ${idx + 1}ª: R$ ${parseFloat(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    ` : '';

                    return `
                        <div class="customer-card animate-fade">
                            <div class="card-left">
                                <div class="customer-main-info">
                                    <div class="name-row">
                                        <h3 class="customer-name">${customer.nome}</h3>
                                        <span style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: #eff6ff; padding: 2px 6px; border-radius: 4px;">#${o.numeroPedido || 'ANTIGO'}</span>
                                        <span class="badge ${o.statusPagamento === 'Pago' ? 'badge-success' : 'badge-warning'}">${o.statusPagamento}</span>
                                        <span class="badge" style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;">${o.tipoPagamento || 'Boleto'}</span>
                                        ${taxaComissao > 0 ? `<span class="badge" style="background: #ecfdf5; color: #10b981; border: 1px solid #d1fae5;">${taxaComissao}% comissão</span>` : ''}
                                    </div>
                                    <div class="customer-sub-info">
                                        <span>${new Date(o.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        <span class="dot">•</span>
                                        <span style="font-weight: 600; color: #64748b;">${customer.cidade || 'Cidade N/I'} - ${customer.uf || 'UF'}</span>
                                        <span class="dot">•</span>
                                        <span style="font-weight: 600; color: ${parcelasPagas === totalParcelas && totalParcelas > 0 ? '#10b981' : '#f59e0b'};"><i data-lucide="credit-card" style="width: 13px; height: 13px; vertical-align: middle;"></i> ${parcelasPagas}/${totalParcelas} pagas</span>
                                        ${taxaComissao > 0 ? `<span class="dot">•</span><span style="font-weight: 700; color: #10b981;"><i data-lucide="coins" style="width: 13px; height: 13px; vertical-align: middle;"></i> Comissão: R$ ${(o.valorTotal * taxaComissao / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>` : ''}
                                    </div>
                                    ${parcelasHtml}
                                </div>
                            </div>
                            
                            <div class="flex align-center gap-3">
                                <div style="text-align: right; margin-right: 20px;">
                                    <h3 style="font-weight: 700; color: var(--text-primary);">R$ ${o.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                </div>
                                
                                <div class="card-actions" style="border-left: 1px solid var(--border-color); padding-left: 20px;">
                                    <a href="https://wa.me/55${customer.whatsapp}" target="_blank" class="btn-icon text-success" title="WhatsApp">
                                        <i data-lucide="message-circle"></i>
                                    </a>
                                    <button class="btn-text btn-edit-order" data-id="${o.id}">
                                        <i data-lucide="edit-3"></i> Editar
                                    </button>
                                    <button class="btn-text text-danger btn-delete-order" data-id="${o.id}">
                                        <i data-lucide="trash-2"></i> Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        lucide.createIcons();
        this.bindOrderEvents();
    },

bindOrderEvents() {
        document.querySelectorAll('.btn-edit-order').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-id');
                const order = db.getById('orders', orderId);
                this.renderOrderForm(order, true);
            });
        });

        document.querySelectorAll('.btn-delete-order').forEach(btn => {
            btn.addEventListener('click', () => {
                if(confirm('Deseja realmente excluir este pedido?')) {
                    db.delete('orders', btn.getAttribute('data-id'));
                    this.renderOrders(document.getElementById('content-area'));
                }
            });
        });

        // Lógica de Busca de Pedidos
        document.getElementById('order-search')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.customer-card');
            cards.forEach(card => {
                const name = card.querySelector('.customer-name').innerText.toLowerCase();
                card.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });

        // Alternar status da parcela
        document.querySelectorAll('.parcelas-list .btn-status-pill').forEach(btn => {
            btn.addEventListener('click', async () => {
                const orderId = btn.getAttribute('data-order-id');
                const parcelaIdx = parseInt(btn.getAttribute('data-parcela-idx'));
                const order = db.getById('orders', orderId);
                
                if (order && order.parcelas_detalhes && order.parcelas_detalhes[parcelaIdx]) {
                    const currentStatus = order.parcelas_detalhes[parcelaIdx].status;
                    order.parcelas_detalhes[parcelaIdx].status = (currentStatus === 'Pago' || currentStatus === 'pago') ? 'Pendente' : 'Pago';
                    
                    await db.update('orders', orderId, { parcelas_detalhes: order.parcelas_detalhes });
                    this.renderOrders(document.getElementById('content-area'));
                }
            });
        });
    },

renderOrderForm(data = null, isEdit = false) {
        const isPreSelected = data && !isEdit;
        const isEditing = data && isEdit;
        const order = isEditing ? data : (isPreSelected ? data : null);

        const customers = db.getAll('customers') || [];
        const products = db.getAll('products') || [];
        
        console.log('Products loaded:', products);
        console.log('Products[0]:', products[0]);
        
        const html = `
            <form id="order-form">
                <div class="flex justify-between align-center m-b-2">
                    <h2 style="font-weight: 700; color: var(--text-primary);">${isEditing ? `Pedido #${order.numeroPedido || ''}` : 'Novo Pedido'}</h2>
                </div>
                <div class="flex gap-2">
                    <div class="input-group" style="flex: 2;">
                        <label>Cliente</label>
                        <select id="order-customer" required ${(isEditing || isPreSelected) ? 'disabled' : ''}>
                            <option value="">Selecione...</option>
                            ${customers.map(c => `<option value="${c.id}" ${data?.customerId === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Data da Venda</label>
                        <input type="date" id="order-date" value="${(data?.data ? new Date(data.data) : new Date()).toISOString().split('T')[0]}" required style="padding: 10px; font-size: 0.95rem;">
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="input-group" style="flex: 1;">
                        <label>Valor do Pedido (R$)</label>
                        <input type="number" id="order-total" value="${data?.valorTotal || 0}" readonly style="background: #f1f5f9; cursor: not-allowed; font-weight: 700;">
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Status de Pagamento</label>
                        <select id="order-status">
                            <option value="Pendente" ${data?.statusPagamento === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Pago" ${data?.statusPagamento === 'Pago' ? 'selected' : ''}>Pago</option>
                        </select>
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="input-group" style="flex: 1;">
                        <label>Forma de Pagamento</label>
                        <select id="order-pay-type">
                            <option value="Boleto" ${data?.tipoPagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
                            <option value="À Vista" ${data?.tipoPagamento === 'À Vista' ? 'selected' : ''}>À Vista</option>
                            <option value="Cartão de Crédito" ${data?.tipoPagamento === 'Cartão de Crédito' ? 'selected' : ''}>Cartão de Crédito</option>
                            <option value="Pix" ${data?.tipoPagamento === 'Pix' ? 'selected' : ''}>Pix</option>
                            <option value="Pagamento na entrega" ${data?.tipoPagamento === 'Pagamento na entrega' ? 'selected' : ''}>Pagamento na entrega</option>
                        </select>
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Parcelas</label>
                        <input type="number" id="order-installments" value="${data?.parcelas || 1}" min="1">
                    </div>
                </div>
                <div class="input-group m-b-2">
                    <label>Observações do Pedido</label>
                    <textarea id="order-obs" placeholder="Detalhes da entrega, condições especiais, etc..." rows="2" style="width: 100%; resize: vertical; border-radius: 8px;">${data?.observacoes || ''}</textarea>
                </div>

                <p class="section-title">Itens do Pedido</p>
                <div class="card p-0 m-b-2" style="overflow: hidden; border: 1px solid #e2e8f0;">
                    <table class="data-table" style="font-size: 0.85rem;">
                        <thead style="background: #f8fafc;">
                            <tr>
                                <th style="padding: 10px;">Produto</th>
                                <th style="padding: 10px; width: 80px;">Qtd</th>
                                <th style="padding: 10px; width: 120px;">V. Unit (R$)</th>
                                <th style="padding: 10px; width: 120px;">Subtotal</th>
                                <th style="padding: 10px; width: 100px;">Comissão (%)</th>
                                <th style="padding: 10px; width: 120px;">Comissão (R$)</th>
                                <th style="padding: 10px; width: 40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="items-body"></tbody>
                    </table>
                    <div style="padding: 12px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item">
                            <i data-lucide="plus" style="width: 14px;"></i> Adicionar Produto
                        </button>
                    </div>
                </div>

                <div id="installments-section" style="display: none;">
                    <p class="section-title">Resumo das Parcelas</p>
                    <div id="installments-grid" class="installments-grid"></div>
                </div>

                <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width: 100%;">${isEditing ? 'Salvar Alterações' : 'Finalizar Pedido'}</button></div>
            </form>
        `;
        const modalTitle = isEditing ? 
            `<div class="flex align-center gap-2">
                <button type="button" id="btn-back-to-customer" class="btn btn-primary" style="padding: 4px 8px; min-width: auto; height: 32px; border-radius: 6px;">
                    <i data-lucide="arrow-left" style="width: 18px;"></i>
                </button>
                <span style="font-size: 1.1rem; font-weight: 700;">Editar Pedido</span>
            </div>` : 'Novo Pedido';

        this.showModal(modalTitle, html);
        lucide.createIcons();

        // Evento de voltar ao cliente
        if (isEditing) {
            document.getElementById('btn-back-to-customer').addEventListener('click', () => {
                const customer = db.getById('customers', order.customerId);
                this.renderCustomerForm(customer);
            });
        }

        const form = document.getElementById('order-form');
        const payType = document.getElementById('order-pay-type');
        const instCount = document.getElementById('order-installments');
        const totalInput = document.getElementById('order-total');
        const instSection = document.getElementById('installments-section');
        const instGrid = document.getElementById('installments-grid');
        const itemsBody = document.getElementById('items-body');
        const btnAddItem = document.getElementById('btn-add-item');

        let installments = Array.isArray(data?.parcelas_detalhes) ? data.parcelas_detalhes : [];
        let items = Array.isArray(data?.items) ? data.items : [];

        const calculateTotal = () => {
            const total = items.reduce((acc, item) => {
                const qtd = parseInt(item.quantidade) || 1;
                const sub = parseFloat(item.valorUnitario) * qtd || (parseFloat(item.subtotal) || 0);
                return acc + sub;
            }, 0);
            totalInput.value = total.toFixed(2);
            renderInstallments();
        };

        const renderItems = () => {
            itemsBody.innerHTML = items.map((item, idx) => {
                const prod = products.find(p => p.id == item.productId);
                let comRate = item.comissao !== undefined ? parseFloat(item.comissao) : (prod ? (parseFloat(prod.comissao) || 0) : 0);
                item.comissao = comRate; // Garante que o estado seja atualizado
                
                const subtotal = (parseFloat(item.valorUnitario) || 0) * (parseInt(item.quantidade) || 0);
                const comValue = subtotal * (comRate / 100);
                
                // Debug: verificar os dados do produto
                const debugProd = products.find(p => p.id == item.productId);
                console.log('Render item - productId:', item.productId, 'prod:', debugProd, 'custo:', debugProd?.custo);
                
                return `
                <tr data-idx="${idx}">
                    <td style="padding: 8px 10px;">
                        <select class="item-product" style="padding: 4px; font-size: 0.85rem; width: 100%;">
                             <option value="">Selecione...</option>
                             ${(products || []).map(p => `<option value="${p.id}" ${item.productId == p.id ? 'selected' : ''} data-price="${p.custo || p.preco || p.valor || 0}" data-comissao="${p.comissao || 0}">${p.nome}</option>`).join('')}
                        </select>
                    </td>
                    <td style="padding: 8px 10px;"><input type="number" class="item-qty" value="${item.quantidade}" min="1" style="padding: 4px; font-size: 0.85rem;"></td>
                    <td style="padding: 8px 10px;"><input type="number" step="any" class="item-price" value="${item.valorUnitario || debugProd?.custo || debugProd?.preco || 0}" style="padding: 4px; font-size: 0.85rem; width: 100%;"></td>
                    <td style="padding: 8px 10px;"><input type="number" step="any" class="item-subtotal" value="${subtotal.toFixed(2)}" style="padding: 4px; font-size: 0.85rem; width: 100px; font-weight: 600;"></td>
                    <td style="padding: 8px 10px;"><input type="number" step="0.1" class="item-com-rate" value="${comRate}" style="padding: 4px; font-size: 0.85rem; width: 100%;"></td>
                    <td style="padding: 8px 10px; font-weight: 600; color: #10b981;" class="item-com-val">${comRate > 0 ? `R$ ${comValue.toFixed(2)}` : '-'}</td>
                    <td style="padding: 8px 10px;">
                        <button type="button" class="btn-icon text-danger btn-remove-item"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                    </td>
                </tr>
            `}).join('');

            lucide.createIcons();

            // Bind de eventos sem renderizar novamente para manter o foco
            itemsBody.querySelectorAll('tr').forEach(row => {
                const idx = row.dataset.idx;
                const sel = row.querySelector('.item-product');
                const qtyInput = row.querySelector('.item-qty');
                const priceInput = row.querySelector('.item-price');
                const comRateInput = row.querySelector('.item-com-rate');
                const subDisplay = row.querySelector('.item-subtotal');
                const btnRemove = row.querySelector('.btn-remove-item');

                const comDisplay = row.querySelector('.item-com-val');

                const updateRow = () => {
                    const qtd = parseInt(qtyInput.value) || 1;
                    const sub = parseFloat(subDisplay.value) || 0;
                    items[idx].quantidade = qtd;
                    items[idx].subtotal = sub;
                    items[idx].valorUnitario = sub / qtd;
                    items[idx].comissao = parseFloat(comRateInput.value) || 0;
                    
                    priceInput.value = items[idx].valorUnitario.toFixed(2);
                    
                    const currentRate = items[idx].comissao;
                    comDisplay.innerText = currentRate > 0 ? `R$ ${(sub * currentRate / 100).toFixed(2)}` : '-';
                    calculateTotal();
                };

                sel.addEventListener('change', (e) => {
                    const option = sel.options[sel.selectedIndex];
                    items[idx].productId = sel.value;
                    items[idx].valorUnitario = parseFloat(option.dataset.price) || 0;
                    items[idx].comissao = parseFloat(option.dataset.comissao) || 0;
                    
                    priceInput.value = items[idx].valorUnitario > 0 ? items[idx].valorUnitario.toFixed(2) : '0';
                    comRateInput.value = items[idx].comissao > 0 ? items[idx].comissao.toFixed(1) : '0';
                    updateRow();
                });

                qtyInput.addEventListener('input', updateRow);
                subDisplay.addEventListener('input', updateRow);
                priceInput.addEventListener('input', updateRow);
                comRateInput.addEventListener('input', updateRow);
                btnRemove.addEventListener('click', () => {
                    items.splice(idx, 1);
                    renderItems();
                    calculateTotal();
                });
            });
        };

        btnAddItem.addEventListener('click', () => {
            items.push({ productId: '', quantidade: 1, valorUnitario: 0 });
            renderItems();
        });

        let isFirstRender = true; // Flag para preservar dados salvos na abertura inicial

        const renderInstallments = () => {
            const type = payType.value;
            const count = parseInt(instCount.value) || 1;
            console.log('DEBUG renderInstallments - type:', type, 'count:', count);
            
            if ((type === 'Boleto' || type === 'Cartão de Crédito') || count > 1) {
                instSection.style.display = 'block';
                const total = parseFloat(totalInput.value) || 0;
                const valPerInst = total > 0 ? parseFloat((total / count).toFixed(2)) : 0;

                if (installments.length !== count) {
                    // Regenera parcelas: usa data do pedido selecionada
                    const orderDateStr = document.getElementById('order-date').value;
                    const baseDate = orderDateStr ? new Date(orderDateStr + 'T12:00:00Z') : new Date();
                    const oldInstallments = [...installments]; // Preserva status das parcelas anteriores
                    installments = [];
                    for (let i = 1; i <= count; i++) {
                        const date = new Date(baseDate);
                        date.setMonth(baseDate.getMonth() + (i - 1));
                        installments.push({
                            numero: i,
                            valor: valPerInst,
                            vencimento: date.toISOString().split('T')[0],
                            status: (oldInstallments[i-1] && oldInstallments[i-1].status) || 'Pendente'
                        });
                    }
                } else if (!isFirstRender) {
                    // Atualiza apenas o valor (sem tocar nas datas e status) quando o total muda
                    installments.forEach(inst => inst.valor = valPerInst);
                }
                // Na primeira renderização com dados existentes, NÃO altera nada

                isFirstRender = false;

                const taxaComissao = this.calculateOrderCommission(items, products);

                instGrid.innerHTML = installments.map((inst, idx) => {
                    const comissao = (parseFloat(inst.valor) || 0) * (taxaComissao / 100);
                    const isPago = inst.status === 'Pago' || inst.status === 'pago';
                    
                    return `
                    <div class="installment-card animate-fade">
                        <div class="inst-header">
                            <span>${inst.numero}ª PARCELA</span>
                            <span class="inst-comissao">R$ ${comissao.toFixed(2)}</span>
                        </div>
                        <div class="inst-value">
                            <input type="number" class="inst-val" data-idx="${idx}" value="${parseFloat(inst.valor) || 0}" 
                                   style="width: 100%; border: none; padding: 2px 0; font-size: 1.1rem; font-weight: 700; background: transparent;">
                        </div>
                        <div class="inst-date">
                            <label class="inst-date-label">VENCIMENTO</label>
                            <input type="date" class="inst-date" data-idx="${idx}" value="${inst.vencimento}" 
                                   style="width: 100%; border: none; padding: 2px 0; font-size: 0.85rem; background: transparent; color: var(--text-secondary);">
                        </div>
                        <button type="button" class="btn-status-pill ${isPago ? 'pago' : 'pendente'}" data-idx="${idx}">
                            <i data-lucide="${isPago ? 'check-circle' : 'circle'}"></i>
                            ${isPago ? 'Pago' : 'Pendente'}
                        </button>
                    </div>
                `}).join('');

                lucide.createIcons();

                // Bind de eventos das parcelas
                instGrid.querySelectorAll('.btn-status-pill').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = btn.dataset.idx;
                        installments[idx].status = (installments[idx].status === 'Pago' || installments[idx].status === 'pago') ? 'Pendente' : 'Pago';
                        renderInstallments();
                    });
                });
                instGrid.querySelectorAll('.inst-val').forEach(input => {
                    input.addEventListener('change', (e) => {
                        installments[e.target.dataset.idx].valor = parseFloat(e.target.value) || 0;
                        renderInstallments();
                    });
                });
                instGrid.querySelectorAll('.inst-date').forEach(input => {
                    input.addEventListener('change', (e) => installments[e.target.dataset.idx].vencimento = e.target.value);
                });
            } else {
                instSection.style.display = 'none';
            }
        };

        payType.addEventListener('change', renderInstallments);
        instCount.addEventListener('input', renderInstallments);
        totalInput.addEventListener('input', renderInstallments);
        document.getElementById('order-date')?.addEventListener('change', renderInstallments);

        // Inicializa se for edição ou se já houver dados
        renderItems();
        renderInstallments();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const customerId = isEditing || isPreSelected ? data.customerId : parseInt(document.getElementById('order-customer').value);
            
            const payload = {
                customerId: customerId,
                valorTotal: parseFloat(totalInput.value),
                statusPagamento: document.getElementById('order-status').value,
                tipoPagamento: payType.value,
                parcelas: parseInt(instCount.value),
                parcelas_detalhes: installments,
                items: items,
                observacoes: document.getElementById('order-obs').value,
                data: new Date(document.getElementById('order-date').value + 'T12:00:00Z').toISOString(),
                numeroPedido: isEditing ? data.numero_pedido : `${Math.floor(1000 + Math.random() * 9000)}`
            };
            try {
                if (isEditing) await db.update('orders', data.id, payload);
                else await db.create('orders', payload);
                this.hideModal();
                this.renderOrders(document.getElementById('content-area'));
            } catch (err) {
                alert('Erro ao salvar pedido: ' + err.message);
            }
        });
    }

};
