import { store } from '../store.js';
import { ui } from '../ui-core.js';
import brazilMap from '../components/brazilMap.js';

const db = {
    getAll: (col) => {
        const state = store.getState();
        const data = (state[col] && Array.isArray(state[col])) ? state[col] : [];
        console.log(`[db.getAll] ${col}:`, data.length, 'itens');
        return data;
    },
    getById: (col, id) => (db.getAll(col)).find(x => x.id == parseInt(id)),
    create: async (col, data) => await store.add(col, data),
    update: async (col, id, data) => await store.update(col, id, data),
    delete: async (col, id) => await store.remove(col, id),
    db: { settings: { ai_api_key: '' } }
};

export const dashboardView = {
    charts: {},

    renderHome(container) {
        const orders = db.getAll('orders') || [];
        const currentYear = new Date().getFullYear().toString();
        
        const availableYears = [...new Set(orders.map(o => {
            if (!o.data) return null;
            const d = new Date(o.data);
            return isNaN(d.getTime()) ? null : d.getFullYear().toString();
        }).filter(y => y))];
        
        if (!availableYears.includes(currentYear)) availableYears.push(currentYear);
        availableYears.sort((a,b) => b - a);
        
        container.innerHTML = `
            <div class="animate-fade">
                <header class="view-header">
                    <h1 class="view-title">Dashboard</h1>
                    <div>
                        <select id="dashFilterYear" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; font-size: 0.85rem;">
                            ${availableYears.map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                    </div>
                </header>
                <div id="dashContent"></div>
            </div>
        `;

        const fy = document.getElementById('dashFilterYear');
        if (fy) {
            fy.addEventListener('change', (e) => this.updateDashboard('Todos os Produtos', e.target.value));
        }

        lucide.createIcons();
        this.updateDashboard('Todos os Produtos', currentYear);
    },

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
    },

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
    },

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
    },

    updateDashboard(productFilter = 'Todos os Produtos', yearFilter = new Date().getFullYear().toString()) {
        const orders = db.getAll('orders');
        const products = db.getAll('products');
        const customers = db.getAll('customers');
        
        console.log('[updateDashboard] orders:', orders.length);
        console.log('[updateDashboard] products:', products.length);
        console.log('[updateDashboard] customers:', customers.length);
        
        const dashContent = document.getElementById('dashContent');
        if (!dashContent) return;

        const yearNum = parseInt(yearFilter);
        const today = new Date();
        
        let filteredOrders;
        
        let periodFilter = 'ano';
        const periodSelect = document.querySelector('.kpi-period-filter[data-kpi="vendas"]');
        if (periodSelect) {
            periodFilter = periodSelect.value || 'ano';
        }
        
        if (periodFilter === 'ano' || periodFilter === 'tudo') {
            filteredOrders = orders;
        } else {
            filteredOrders = orders.filter(o => {
                if (!o.data) return false;
                return new Date(o.data).getFullYear().toString() === yearFilter;
            });
        }
        
        let filteredTotalVendas = 0;
        let finalOrdersForDisplay = [];

        if (productFilter === 'Todos os Produtos') {
            filteredTotalVendas = filteredOrders.reduce((acc, o) => acc + (parseFloat(o.valorTotal) || 0), 0);
            finalOrdersForDisplay = filteredOrders;
        } else {
            filteredOrders.forEach(order => {
                let orderMatches = false;
                const itemsList = order.itens || order.items || [];
                itemsList.forEach(item => {
                    const itemName = (item.nome || item.productName || '').trim().toLowerCase();
                    if (itemName === productFilter.trim().toLowerCase()) {
                        const preco = item.precoUnitario || item.valorUnitario || 0;
                        filteredTotalVendas += (item.quantidade * preco);
                        orderMatches = true;
                    }
                });
                if (orderMatches) finalOrdersForDisplay.push(order);
            });
        }

        const monthlyData = new Array(12).fill(0);
        filteredOrders.forEach(o => {
            if (!o.data) return;
            const m = new Date(o.data).getMonth();
            if (productFilter === 'Todos os Produtos') {
                monthlyData[m] += (parseFloat(o.valorTotal) || 0);
            } else {
                const itemsList = o.itens || o.items || [];
                itemsList.forEach(item => {
                    if ((item.nome || item.productName || '').trim().toLowerCase() === productFilter.trim().toLowerCase()) {
                        monthlyData[m] += (item.quantidade * (item.precoUnitario || item.valorUnitario || 0));
                    }
                });
            }
        });

        const salesByState = {};
        finalOrdersForDisplay.forEach(order => {
            const customer = customers.find(c => c.id === order.customerId);
            const uf = customer?.uf || 'N/I';
            if (!salesByState[uf]) salesByState[uf] = 0;
            
            if (productFilter === 'Todos os Produtos') {
                salesByState[uf] += (parseFloat(order.valorTotal) || 0);
            } else {
                const itemsList = order.itens || order.items || [];
                itemsList.forEach(item => {
                    if ((item.nome || item.productName || '').trim().toLowerCase() === productFilter.trim().toLowerCase()) {
                        salesByState[uf] += (item.quantidade * (item.precoUnitario || item.valorUnitario || 0));
                    }
                });
            }
        });

        const stateChartData = Object.entries(salesByState)
            .map(([uf, total]) => ({
                uf, total,
                percent: filteredTotalVendas > 0 ? Math.round((total / filteredTotalVendas) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total);

        let totalComissaoRecebida = 0;
        let totalComissaoAReceber = 0;
        let totalParcelasRecebidas = 0;
        let totalParcelasAReceber = 0;
        let comissaoProximoRecebimento = 0;
        const nextPayday = this.getNextPayday();

        const allInstallments = [];
        const allProjectedInstallments = [];

        filteredOrders.forEach(o => {
            const detalhes = Array.isArray(o.parcelas_detalhes) ? o.parcelas_detalhes : [];
            const { totalComissao } = this.calculateCommissionForOrder(o, products);

            detalhes.forEach(p => {
                if (!p || !p.vencimento) return;
                const valor = parseFloat(p.valor) || 0;
                const vencimento = new Date(p.vencimento + 'T00:00:00');
                const status = (p.status || '').toLowerCase();
                const comissao = valor * (totalComissao / (o.valorTotal || 1));
                
                const payday = this.getPaydayForDate(vencimento);
                const paydayDate = new Date(payday.paydayYear, payday.paydayMonth, payday.payday);
                
                // Recebido = apenas status pago
                if (status === 'pago') {
                    allInstallments.push({ valor, comissao, vencimento, payday: paydayDate });
                    totalComissaoRecebida += comissao;
                    totalParcelasRecebidas++;
                }
                
                // Projetado = pago + pendente (todos os status)
                allProjectedInstallments.push({ valor, comissao, vencimento, payday: paydayDate });
                totalComissaoAReceber += comissao;
                totalParcelasAReceber++;
                
                if (paydayDate.getTime() === nextPayday.date.getTime()) {
                    comissaoProximoRecebimento += comissao;
                }
            });
        });

        const projectionData = new Array(24).fill(0);
        const projectionLabels = [];
        
        for (let m = 0; m < 12; m++) {
            const d = new Date(yearNum, m, 1);
            let monthName = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
            projectionLabels.push(`${monthName} 15`, `${monthName} 30`);
        }

        [...allInstallments, ...allProjectedInstallments].forEach(inst => {
            const payday = inst.payday;
            if (payday.getFullYear() === yearNum && payday.getMonth() >= 0 && payday.getMonth() <= 11) {
                const is15 = payday.getDate() === 15;
                const idx = payday.getMonth() * 2 + (is15 ? 0 : 1);
                projectionData[idx] += inst.comissao;
            }
        });

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

        const ticketMedio = finalOrdersForDisplay.length > 0 ? (filteredTotalVendas / finalOrdersForDisplay.length) : 0;
        const percentAtingido = Math.min(Math.round((filteredTotalVendas / 450000) * 100), 100);
        
        const availableYears = [...new Set(orders.map(o => {
            if (!o.data) return null;
            const d = new Date(o.data);
            return isNaN(d.getTime()) ? null : d.getFullYear().toString();
        }).filter(y => y))];

        if (!availableYears.includes(yearFilter)) availableYears.push(yearFilter);
        availableYears.sort((a,b) => b - a);

        dashContent.innerHTML = `
            <div class="perf-grid-top">
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--primary);">
                    <div class="kpi-card-header">
                        <div class="label"><i data-lucide="circle-dollar-sign" style="color: #10b981;"></i> VENDAS TOTAIS</div>
                        <select class="kpi-period-filter" data-kpi="vendas">
                            <option value="ano">Ano</option>
                            <option value="trimestre">Trimestre</option>
                            <option value="mes">Mês</option>
                            <option value="tudo">Tudo</option>
                        </select>
                    </div>
                    <div class="kpi-card-body">
                        <div class="value" id="kpiVendasValue">R$ ${filteredTotalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--success);">
                    <div class="kpi-card-header">
                        <div class="label"><i data-lucide="check-circle" style="color: #10b981;"></i> COMISSÃO RECEBIDA</div>
                        <select class="kpi-period-filter" data-kpi="comissao_recebida">
                            <option value="ano">Ano</option>
                            <option value="trimestre">Trimestre</option>
                            <option value="mes">Mês</option>
                            <option value="tudo">Tudo</option>
                        </select>
                    </div>
                    <div class="kpi-card-body">
                        <div class="value" id="kpiComissaoRecebidaValue">R$ ${totalComissaoRecebida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div class="sub-text">${totalParcelasRecebidas} parcela(s) paga(s)</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--info);">
                    <div class="kpi-card-header">
                        <div class="label"><i data-lucide="clock" style="color: #f97316;"></i> COMISSÃO A RECEBER</div>
                        <select class="kpi-period-filter" data-kpi="comissao_a_receber">
                            <option value="ano">Ano</option>
                            <option value="trimestre">Trimestre</option>
                            <option value="mes">Mês</option>
                            <option value="tudo">Tudo</option>
                        </select>
                    </div>
                    <div class="kpi-card-body">
                        <div class="value" id="kpiComissaoAReceberValue">R$ ${totalComissaoAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div class="sub-text">${totalParcelasAReceber} parcela(s) aberta(s)</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid #8b5cf6;">
                    <div class="kpi-card-header">
                        <div class="label"><i data-lucide="calendar-check" style="color: #8b5cf6;"></i> PRÓXIMO RECEBIMENTO</div>
                    </div>
                    <div class="kpi-card-body">
                        <div class="value">Dia ${nextPayday.day}</div>
                        <div class="sub-text">R$ ${comissaoProximoRecebimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${nextPayday.daysUntil} dia(s)</div>
                    </div>
                </div>
            </div>

            <div class="perf-grid-mid">
                <div class="chart-card" style="grid-column: span 2;">
                    <h3>VENDAS MENSAIS</h3>
                    <div class="chart-box"><canvas id="chartMensal"></canvas></div>
                </div>
                <div class="chart-card states-card">
                    <h3>VENDAS POR ESTADO</h3>
                    <div class="states-layout">
                        <div class="states-table">
                            <div class="state-header-row">
                                <span>UF</span>
                                <span>Valor</span>
                                <span>%</span>
                            </div>
                            ${stateChartData.map((s, i) => `
                                <div class="state-perf-row ${i === 0 ? 'highlight' : ''}">
                                    <span class="state-label">${s.uf}</span>
                                    <div class="state-bar-container">
                                        <div class="state-bar ${this.getStateColorClass(i)}" style="width: ${s.percent}%"></div>
                                    </div>
                                    <span class="state-val">R$ ${(s.total / 1000).toFixed(1)}k</span>
                                    <span class="state-pct">${s.percent}%</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="states-map-wrapper" style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; min-height: 250px;">
                            <div id="brazil-map-container" style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;"></div>
                            <div id="map-tooltip" class="map-tooltip" style="display: none; position: absolute; background: var(--bg-elevated, #1e293b); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); color: var(--text-primary, #f8fafc); padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; pointer-events: none; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: opacity 0.2s; top: 0; left: 0;">
                                <div id="tooltip-uf" style="font-weight: 600; margin-bottom: 4px; color: var(--primary, #3b82f6);"></div>
                                <div id="tooltip-value" style="font-weight: 500;"></div>
                                <div id="tooltip-percent" style="color: var(--text-secondary, #94a3b8); font-size: 0.8rem; margin-top: 2px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="perf-grid-bottom">
                <div class="chart-card">
                    <h3>PROJEÇÃO DE COMISSÃO</h3>
                    <div class="projection-legend">
                        <div class="legend-item">
                            <div class="legend-dot recebido"></div>
                            <span>Comissão Recebida</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot projetado"></div>
                            <span>Comissão Projetada</span>
                        </div>
                    </div>
                    <div class="chart-box"><canvas id="chartEvolucao"></canvas></div>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // Adiciona listeners aos filtros de período dos KPIs
        document.querySelectorAll('.kpi-period-filter').forEach(select => {
            select.addEventListener('change', (e) => this.handleKpiPeriodFilter(e));
        });
        
        if (this.charts) {
            Object.values(this.charts).forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
        }
        this.charts = {};

        setTimeout(() => this.initDashboardCharts(filteredTotalVendas, percentAtingido, monthlyData, stateChartData, { receivedData, projectedData, labels: projectionLabels }), 50);
    },

    handleKpiPeriodFilter(e) {
        const kpiType = e.target.dataset.kpi;
        const period = e.target.value;
        const yearFilter = document.getElementById('dashFilterYear')?.value || new Date().getFullYear().toString();
        
        const data = this.getFilteredDataByPeriod(period, yearFilter, kpiType);
        
        const valueElement = document.getElementById(`kpi${this.getKpiIdSuffix(kpiType)}Value`);
        const subTextElement = valueElement?.closest('.kpi-card-body')?.querySelector('.sub-text');
        
        if (valueElement) {
            valueElement.textContent = `R$ ${data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
        
        if (subTextElement && (kpiType === 'comissao_recebida' || kpiType === 'comissao_a_receber')) {
            subTextElement.textContent = `${data.parcelas} parcela(s) ${kpiType === 'comissao_recebida' ? 'paga(s)' : 'aberta(s)'}`;
        }
    },

    getKpiIdSuffix(kpiType) {
        const map = {
            'vendas': 'Vendas',
            'comissao_recebida': 'ComissaoRecebida',
            'comissao_a_receber': 'ComissaoAReceber'
        };
        return map[kpiType] || '';
    },

    getFilteredDataByPeriod(period, yearFilter, kpiType) {
        const orders = db.getAll('orders') || [];
        const products = db.getAll('products') || [];
        const yearNum = parseInt(yearFilter);
        
        let filteredOrders;
        
        if (period === 'ano' || period === 'tudo') {
            filteredOrders = orders;
        } else {
            filteredOrders = orders.filter(o => {
                if (!o.data) return false;
                return new Date(o.data).getFullYear().toString() === yearFilter;
            });
        }
        
        const ordersToCalculate = this.filterOrdersByPeriod(filteredOrders, period, yearNum);
        
        let value = 0;
        let parcelas = 0;
        
        if (kpiType === 'vendas') {
            value = ordersToCalculate.reduce((acc, o) => acc + (parseFloat(o.valorTotal) || 0), 0);
            return { value, parcelas: ordersToCalculate.length };
        }
        
        const allInstallments = [];
        ordersToCalculate.forEach(o => {
            const detalhes = Array.isArray(o.parcelas_detalhes) ? o.parcelas_detalhes : [];
            const { totalComissao } = this.calculateCommissionForOrder(o, products);
            
            detalhes.forEach(p => {
                if (!p || !p.vencimento) return;
                const valor = parseFloat(p.valor) || 0;
                const status = (p.status || '').toLowerCase();
                const comissao = valor * (totalComissao / (o.valorTotal || 1));
                allInstallments.push({ comissao, status });
            });
        });
        
        if (kpiType === 'comissao_recebida') {
            allInstallments.forEach(inst => {
                if (inst.status === 'pago') {
                    value += inst.comissao;
                    parcelas++;
                }
            });
        } else if (kpiType === 'comissao_a_receber') {
            allInstallments.forEach(inst => {
                if (inst.status !== 'pago') {
                    value += inst.comissao;
                    parcelas++;
                }
            });
        }
        
        return { value, parcelas };
    },

    filterOrdersByPeriod(orders, period, yearNum) {
        const today = new Date();
        const currentMonth = today.getMonth();
        
        if (period === 'tudo') {
            return orders;
        }
        
        if (period === 'ano') {
            return orders;
        }
        
        if (period === 'mes') {
            return orders.filter(o => {
                if (!o.data) return false;
                const orderDate = new Date(o.data);
                return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === yearNum;
            });
        }
        
        if (period === 'trimestre') {
            const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
            return orders.filter(o => {
                if (!o.data) return false;
                const orderDate = new Date(o.data);
                const month = orderDate.getMonth();
                return month >= quarterStartMonth && month < quarterStartMonth + 3 && orderDate.getFullYear() === yearNum;
            });
        }
        
        return orders;
    },

    getStateColorClass(i) {
        const colors = ['sp', 'mg', 'pr', 'default'];
        return colors[i % colors.length];
    },

    initDashboardCharts(total, pct, monthly, states, projection) {
        if (typeof Chart === 'undefined') return;
        const config = { responsive: true, maintainAspectRatio: false, animation: { duration: 0 } };

        const ctxM = document.getElementById('chartMensal');
        if (ctxM) {
            this.charts.men = new Chart(ctxM, {
                type: 'bar',
                data: { labels: ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'], datasets: [{ data: monthly, backgroundColor: 'rgba(35, 131, 226, 0.6)', borderRadius: 4 }] },
                options: { ...config, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { x: { ticks: { color: '#787774', font: { size: 10 } }, grid: { display: false } }, y: { display: false } } }
            });
        }

        const ctxE = document.getElementById('chartEvolucao');
        if (ctxE) {
            this.charts.evo = new Chart(ctxE, {
                type: 'line',
                data: {
                    labels: projection.labels || [],
                    datasets: [
                        {
                            label: 'Recebido',
                            data: projection.receivedData || [],
                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 4,
                            pointBackgroundColor: '#06b6d4'
                        }
                    ]
                },
                options: {
                    ...config,
                    plugins: { 
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            color: '#f8fafc',
                            font: { size: 9, weight: 'bold' },
                            formatter: (v) => v > 0 ? 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#94a3b8', font: { size: 9 } },
                            grid: { display: false }
                        },
                        y: {
                            ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                }
            });
        }

        const mapContainer = document.getElementById('brazil-map-container');
        if (mapContainer && typeof brazilMap !== 'undefined') {
            this.initDashboardMap(mapContainer, states);
        }
    },

    initDashboardMap(container, statesData) {
        // Find max total to calculate color intensity
        const maxTotal = statesData.length > 0 ? Math.max(...statesData.map(s => s.total)) : 0;
        
        // Color palette for states (ordered by rank)
        const colorPalette = [
            '#e74c3c', // vermelho
            '#e67e22', // laranja
            '#f1c40f', // amarelo
            '#2ecc71', // verde
            '#1abc9c', // verde-azulado
            '#3498db', // azul
            '#9b59b6', // roxo
            '#34495e'  // cinza escuro
        ];
        
        let svgHTML = `<svg viewBox="${brazilMap.viewBox}" style="width: 100%; max-height: 250px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">`;
        
        brazilMap.locations.forEach(loc => {
            const stateId = loc.id.toUpperCase();
            const stateInfo = statesData.find(s => s.uf === stateId);
            const rankIndex = statesData.findIndex(s => s.uf === stateId);
            
            // Calculate fill color based on rank
            let fill = 'var(--bg-tertiary, #334155)'; // default neutral color
            let cursor = 'default';
            let stroke = 'rgba(127, 127, 127, 0.5)';
            let strokeWidth = 1.5;
            
            if (stateInfo && stateInfo.total > 0 && rankIndex >= 0) {
                fill = colorPalette[rankIndex % colorPalette.length];
                cursor = 'pointer';
            }
            
            svgHTML += `
                <path 
                    d="${loc.path}" 
                    id="map-state-${stateId}"
                    data-uf="${stateId}"
                    data-name="${loc.name}"
                    data-total="${stateInfo ? stateInfo.total : 0}"
                    data-percent="${stateInfo ? stateInfo.percent : 0}"
                    fill="${fill}"
                    stroke="${stroke}"
                    stroke-width="${strokeWidth}"
                    style="transition: fill 0.3s ease; cursor: ${cursor};"
                    class="map-state-path"
                />
            `;
        });
        
        svgHTML += `</svg>`;
        container.innerHTML = svgHTML;

        // Add Tooltip Events
        const tooltip = document.getElementById('map-tooltip');
        const tooltipUf = document.getElementById('tooltip-uf');
        const tooltipVal = document.getElementById('tooltip-value');
        const tooltipPct = document.getElementById('tooltip-percent');
        const wrapper = container.parentElement;

        const paths = container.querySelectorAll('.map-state-path');
        paths.forEach(path => {
            const total = parseFloat(path.getAttribute('data-total'));
            if (total === 0) return; // No tooltip for empty states

            path.addEventListener('mouseenter', (e) => {
                path.setAttribute('stroke', '#ffffff');
                path.setAttribute('stroke-width', '2.5');
                
                tooltipUf.textContent = `${path.getAttribute('data-name')} (${path.getAttribute('data-uf')})`;
                tooltipVal.textContent = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                tooltipPct.textContent = path.getAttribute('data-percent') + '% do total';
                
                tooltip.style.display = 'block';
                tooltip.style.opacity = '1';
            });

            path.addEventListener('mousemove', (e) => {
                const rect = wrapper.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                tooltip.style.left = (x + 15) + 'px';
                tooltip.style.top = (y - 15) + 'px';
            });

            path.addEventListener('mouseleave', () => {
                path.setAttribute('stroke', 'rgba(255,255,255,0.2)');
                path.setAttribute('stroke-width', '1.5');
                tooltip.style.opacity = '0';
                tooltip.style.display = 'none';
            });
        });
};