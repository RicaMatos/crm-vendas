import { store } from '../store.js';
import { ui } from '../ui-core.js';

const db = {
    getAll: (col) => store.getState()[col] || [],
    getById: (col, id) => (store.getState()[col] || []).find(x => x.id == parseInt(id)),
    create: async (col, data) => await store.add(col, data),
    update: async (col, id, data) => await store.update(col, id, data),
    delete: async (col, id) => await store.remove(col, id),
    db: { settings: { ai_api_key: '' } }
};

export const commissionsView = {
    charts: {},

    renderCommissions(container) {
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
                    <h1 class="view-title">Comissões</h1>
                    <div>
                        <select id="commFilterYear" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; font-size: 0.85rem;">
                            ${availableYears.map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                    </div>
                </header>
                <div id="commContent"></div>
            </div>
        `;

        const fy = document.getElementById('commFilterYear');
        if (fy) {
            fy.addEventListener('change', (e) => this.updateCommissions(e.target.value));
        }

        lucide.createIcons();
        this.updateCommissions(currentYear);
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

    updateCommissions(yearFilter = new Date().getFullYear().toString()) {
        const orders = db.getAll('orders') || [];
        const products = db.getAll('products') || [];
        const commContent = document.getElementById('commContent');
        if (!commContent) return;

        const yearNum = parseInt(yearFilter);
        
        let filteredOrders = orders.filter(o => {
            if (!o.data) return false;
            return new Date(o.data).getFullYear().toString() === yearFilter;
        });

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
                
                if (status === 'pago') {
                    allInstallments.push({ valor, comissao, vencimento, payday: paydayDate });
                    totalComissaoRecebida += comissao;
                    totalParcelasRecebidas++;
                }
                
                allProjectedInstallments.push({ valor, comissao, vencimento, payday: paydayDate });
                totalComissaoAReceber += comissao;
                totalParcelasAReceber++;
                
                if (paydayDate.getTime() === nextPayday.date.getTime()) {
                    comissaoProximoRecebimento += comissao;
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

        commContent.innerHTML = `
            <div class="perf-grid-top">
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--success);">
                    <div class="kpi-card-header">
                        <div class="label"><i data-lucide="check-circle" style="color: #10b981;"></i> COMISSÃO RECEBIDA</div>
                    </div>
                    <div class="kpi-card-body">
                        <div class="value">R$ ${totalComissaoRecebida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div class="sub-text">${totalParcelasRecebidas} parcela(s) paga(s)</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid var(--info);">
                    <div class="kpi-card-header">
                        <div class="label"><i data-lucide="clock" style="color: #f97316;"></i> COMISSÃO A RECEBER</div>
                    </div>
                    <div class="kpi-card-body">
                        <div class="value">R$ ${totalComissaoAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div class="sub-text">${totalParcelasAReceber} parcela(s) aberta(s)</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; border-left: 3px solid #787774;">
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
                    <h3>PAGAMENTO DE COMISSÕES</h3>
                    <div class="chart-box"><canvas id="chartComissoes"></canvas></div>
                </div>
            </div>

            <div class="perf-grid-bottom">
                <div class="chart-card">
                    <h3>PROJEÇÃO DE RECEBIMENTO DE COMISSÃO</h3>
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
        
        if (this.charts) {
            Object.values(this.charts).forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
        }
        this.charts = {};

        setTimeout(() => this.initCommissionsCharts({ receivedData, projectedData, labels: projectionLabels }), 50);
    },

    initCommissionsCharts(projection) {
        if (typeof Chart === 'undefined') return;
        const config = { responsive: true, maintainAspectRatio: false, animation: { duration: 0 } };

        const ctxC = document.getElementById('chartComissoes');
        if (ctxC && projection?.labels && projection?.receivedData && projection?.projectedData) {
            const receivedData = projection.receivedData;
            const projectedData = projection.projectedData;
            
            const data15 = receivedData.map((v, i) => i % 2 === 0 ? v : 0);
            const data30 = receivedData.map((v, i) => i % 2 === 1 ? v : 0);
            const proj15 = projectedData.map((v, i) => i % 2 === 0 ? v : 0);
            const proj30 = projectedData.map((v, i) => i % 2 === 1 ? v : 0);

            this.charts.com = new Chart(ctxC, {
                type: 'bar',
                data: {
                    labels: projection.labels,
                    datasets: [
                        { label: 'Recebido 15', data: data15, backgroundColor: '#10b981', borderRadius: 3 },
                        { label: 'Recebido 30', data: data30, backgroundColor: '#059669', borderRadius: 3 },
                        { label: 'Projetado 15', data: proj15, backgroundColor: 'rgba(249, 115, 22, 0.5)', borderRadius: 3 },
                        { label: 'Projetado 30', data: proj30, backgroundColor: 'rgba(234, 88, 12, 0.5)', borderRadius: 3 }
                    ]
                },
                options: {
                    ...config,
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
                        },
                        {
                            label: 'Projetado',
                            data: projection.projectedData || [],
                            borderColor: '#f97316',
                            backgroundColor: 'transparent',
                            borderDash: [5, 5],
                            tension: 0.4,
                            fill: false,
                            pointRadius: 4,
                            pointBackgroundColor: '#f97316'
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
    }
};