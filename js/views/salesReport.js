import { store } from '../store.js';
import { ui } from '../ui-core.js';

const db = {
    getAll: (col) => store.getState()[col] || [],
    getById: (col, id) => (store.getState()[col] || []).find(x => x.id == parseInt(id))
};

export const salesReportView = {
    renderSalesReport(container) {
        const orders = db.getAll('orders') || [];
        const customers = db.getAll('customers') || [];
        const products = db.getAll('products') || [];

        const today = new Date().toISOString().split('T')[0];
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        container.innerHTML = `
            <div class="sales-report-container">
                <div class="filters-section card m-b-2 animate-fade">
                    <h3 class="section-title"><i data-lucide="filter"></i> Filtros</h3>
                    <div class="filters-grid">
                        <div class="filter-group">
                            <label>Data Inicial</label>
                            <input type="date" id="filter-date-start" value="${firstOfMonth}">
                        </div>
                        <div class="filter-group">
                            <label>Data Final</label>
                            <input type="date" id="filter-date-end" value="${today}">
                        </div>
                        <div class="filter-group">
                            <label>Status de Pagamento</label>
                            <select id="filter-status">
                                <option value="">Todos</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Pago">Pago</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Forma de Pagamento</label>
                            <select id="filter-payment">
                                <option value="">Todas</option>
                                <option value="Boleto">Boleto</option>
                                <option value="À Vista">À Vista</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Pix">Pix</option>
                                <option value="Pagamento na entrega">Pagamento na entrega</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Cliente</label>
                            <select id="filter-customer">
                                <option value="">Todos</option>
                                ${customers.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-actions">
                            <button class="btn btn-primary" id="btn-apply-filters">
                                <i data-lucide="search"></i> Aplicar
                            </button>
                            <button class="btn btn-secondary" id="btn-clear-filters">
                                <i data-lucide="x"></i> Limpar
                            </button>
                        </div>
                    </div>
                </div>

                <div class="report-summary cards-row m-b-2 animate-fade" id="report-summary">
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #ecfdf5; color: #10b981;">
                            <i data-lucide="shopping-cart"></i>
                        </div>
                        <div class="stat-content">
                            <span class="stat-label">Total de Pedidos</span>
                            <span class="stat-value" id="total-orders">0</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #eff6ff; color: #3b82f6;">
                            <i data-lucide="dollar-sign"></i>
                        </div>
                        <div class="stat-content">
                            <span class="stat-label">Valor Total</span>
                            <span class="stat-value" id="total-value">R$ 0,00</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #fef3c7; color: #f59e0b;">
                            <i data-lucide="clock"></i>
                        </div>
                        <div class="stat-content">
                            <span class="stat-label">Pendente</span>
                            <span class="stat-value" id="pending-value">R$ 0,00</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #dcfce7; color: #22c55e;">
                            <i data-lucide="check-circle"></i>
                        </div>
                        <div class="stat-content">
                            <span class="stat-label">Recebido</span>
                            <span class="stat-value" id="paid-value">R$ 0,00</span>
                        </div>
                    </div>
                </div>

                <div class="report-details card animate-fade">
                    <div class="table-header">
                        <h3 class="section-title"><i data-lucide="file-text"></i> Detalhamento</h3>
                        <button class="btn btn-sm btn-secondary" id="btn-export-csv">
                            <i data-lucide="download"></i> Exportar CSV
                        </button>
                    </div>
                    <div class="table-container" style="overflow-x: auto;">
                        <table class="data-table" id="sales-report-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Pedido</th>
                                    <th>Cliente</th>
                                    <th>Forma Pagamento</th>
                                    <th>Parcelas</th>
                                    <th>Status</th>
                                    <th style="text-align: right;">Valor</th>
                                </tr>
                            </thead>
                            <tbody id="report-body">
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="6" style="text-align: right; font-weight: 700;">Total:</td>
                                    <td id="report-total" style="text-align: right; font-weight: 700;">R$ 0,00</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        lucide.createIcons();
        this.bindReportEvents(orders, customers, products);
        this.applyFilters(orders, customers, products);
    },

    bindReportEvents(orders, customers, products) {
        document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
            this.applyFilters(orders, customers, products);
        });

        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            document.getElementById('filter-date-start').value = '';
            document.getElementById('filter-date-end').value = '';
            document.getElementById('filter-status').value = '';
            document.getElementById('filter-payment').value = '';
            document.getElementById('filter-customer').value = '';
            this.applyFilters(orders, customers, products);
        });

        document.getElementById('btn-export-csv')?.addEventListener('click', () => {
            this.exportToCSV(orders, customers, products);
        });
    },

    applyFilters(orders, customers, products) {
        const dateStart = document.getElementById('filter-date-start').value;
        const dateEnd = document.getElementById('filter-date-end').value;
        const status = document.getElementById('filter-status').value;
        const payment = document.getElementById('filter-payment').value;
        const customerId = document.getElementById('filter-customer').value;

        let filtered = orders.filter(order => {
            const orderDate = order.data ? new Date(order.data).toISOString().split('T')[0] : '';
            
            if (dateStart && orderDate < dateStart) return false;
            if (dateEnd && orderDate > dateEnd) return false;
            if (status && order.statusPagamento !== status) return false;
            if (payment && order.tipoPagamento !== payment) return false;
            if (customerId && order.customerId != customerId) return false;
            
            return true;
        });

        filtered.sort((a, b) => new Date(b.data) - new Date(a.data));

        this.renderReportTable(filtered, customers);
        this.updateSummary(filtered);
    },

    renderReportTable(orders, customers) {
        const tbody = document.getElementById('report-body');
        
        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Nenhum pedido encontrado para os filtros selecionados.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(order => {
            const customer = customers.find(c => c.id === order.customerId) || { nome: 'N/A' };
            const parcelasInfo = order.parcelas_detalhes?.length || order.parcelas || 1;
            const parcelasPagas = (order.parcelas_detalhes || []).filter(p => p.status === 'Pago' || p.status === 'pago').length;
            
            return `
                <tr>
                    <td>${order.data ? new Date(order.data).toLocaleDateString('pt-BR') : 'N/I'}</td>
                    <td><span class="badge">#${order.numeroPedido || 'ANTIGO'}</span></td>
                    <td>${customer.nome}</td>
                    <td>${order.tipoPagamento || 'N/I'}</td>
                    <td>${parcelasPagas}/${parcelasInfo}</td>
                    <td><span class="badge ${order.statusPagamento === 'Pago' ? 'badge-success' : 'badge-warning'}">${order.statusPagamento || 'Pendente'}</span></td>
                    <td style="text-align: right; font-weight: 600;">R$ ${parseFloat(order.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        }).join('');

        const total = orders.reduce((sum, o) => sum + parseFloat(o.valorTotal || 0), 0);
        document.getElementById('report-total').textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    },

    updateSummary(orders) {
        const totalOrders = orders.length;
        const totalValue = orders.reduce((sum, o) => sum + parseFloat(o.valorTotal || 0), 0);
        const pendingValue = orders.filter(o => o.statusPagamento !== 'Pago').reduce((sum, o) => sum + parseFloat(o.valorTotal || 0), 0);
        const paidValue = orders.filter(o => o.statusPagamento === 'Pago').reduce((sum, o) => sum + parseFloat(o.valorTotal || 0), 0);

        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('total-value').textContent = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        document.getElementById('pending-value').textContent = `R$ ${pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        document.getElementById('paid-value').textContent = `R$ ${paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    },

    exportToCSV(orders, customers, products) {
        const dateStart = document.getElementById('filter-date-start').value;
        const dateEnd = document.getElementById('filter-date-end').value;
        const status = document.getElementById('filter-status').value;
        const payment = document.getElementById('filter-payment').value;
        const customerId = document.getElementById('filter-customer').value;

        let filtered = orders.filter(order => {
            const orderDate = order.data ? new Date(order.data).toISOString().split('T')[0] : '';
            if (dateStart && orderDate < dateStart) return false;
            if (dateEnd && orderDate > dateEnd) return false;
            if (status && order.statusPagamento !== status) return false;
            if (payment && order.tipoPagamento !== payment) return false;
            if (customerId && order.customerId != customerId) return false;
            return true;
        });

        const csvRows = [];
        csvRows.push(['Data', 'Pedido', 'Cliente', 'Forma Pagamento', 'Parcelas', 'Status', 'Valor']);

        filtered.forEach(order => {
            const customer = customers.find(c => c.id === order.customerId) || { nome: 'N/A' };
            const parcelasInfo = order.parcelas_detalhes?.length || order.parcelas || 1;
            csvRows.push([
                order.data ? new Date(order.data).toLocaleDateString('pt-BR') : '',
                order.numeroPedido || '',
                customer.nome,
                order.tipoPagamento || '',
                parcelasInfo,
                order.statusPagamento || 'Pendente',
                (order.valorTotal || 0).toString().replace('.', ',')
            ]);
        });

        const csvContent = csvRows.map(row => row.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_vendas_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
};