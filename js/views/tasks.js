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
export const tasksView = {
renderTasks(container) {
        if (!this.currentCalendarDate) this.currentCalendarDate = new Date();
        const tasks = db.getAll('tasks');
        const customers = db.getAll('customers');
        const month = this.currentCalendarDate.getMonth();
        const year = this.currentCalendarDate.getFullYear();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = this.currentCalendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        container.innerHTML = `
            <div class="calendar-layout animate-fade">
                <aside class="agenda-sidebar">
                    <h3 style="font-weight: 700; margin-bottom: 10px; font-size: 1rem;">Tarefas de ${this.currentCalendarDate.toLocaleDateString('pt-BR', { month: 'short' })}</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${this.renderTaskCards(tasks, month, year, customers)}
                    </div>
                </aside>

                <section class="calendar-main">
                    <div class="calendar-header-nav">
                        <button class="btn-icon" id="prev-month"><i data-lucide="chevron-left"></i></button>
                        <h2 style="text-transform: capitalize; font-weight: 700;">${monthName}</h2>
                        <button class="btn-icon" id="next-month"><i data-lucide="chevron-right"></i></button>
                    </div>
                    <div class="calendar-grid">
                        ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
                        ${this.generateCalendarDays(firstDay, daysInMonth, month, year, tasks, customers)}
                    </div>
                </section>
            </div>
        `;

        lucide.createIcons();
        this.bindCalendarEvents();
    },

generateCalendarDays(firstDay, daysInMonth, month, year, tasks, customers) {
        let html = '';
        const today = new Date();
        
        // Células vazias no início
        for (let i = 0; i < firstDay; i++) {
            html += `<div class="calendar-day empty"></div>`;
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            
            const dayTasks = tasks.filter(t => t.data === dateStr);
            const birthdays = customers.filter(c => {
                if (!c.dataAniversario) return false;
                const bDate = new Date(c.dataAniversario);
                return bDate.getDate() === day && bDate.getMonth() === month;
            });

            html += `
                <div class="calendar-day ${isToday ? 'today' : ''}">
                    <div class="day-number">${day}</div>
                    <div class="day-tasks">
                        ${dayTasks.map(t => {
                            let extraClass = '';
                            if (t.titulo.startsWith('Retorno:')) extraClass = 'return';
                            if (t.titulo.startsWith('Lembrete:')) extraClass = 'reminder';
                            return `<span class="task-dot ${extraClass}" title="${t.titulo}">${t.titulo}</span>`;
                        }).join('')}
                        ${birthdays.map(c => `<span class="task-dot" style="background: var(--warning);" title="Aniversário: ${c.nome}">🎂 ${c.nome}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        return html;
    },

renderTaskCards(tasks, month, year, customers) {
        const monthTasks = tasks.filter(t => {
            const d = new Date(t.data);
            return d.getUTCMonth() === month && d.getUTCFullYear() === year;
        });

        const monthBirthdays = customers.filter(c => {
            if (!c.dataAniversario) return false;
            const bDate = new Date(c.dataAniversario);
            return bDate.getUTCMonth() === month;
        });

        if (monthTasks.length === 0 && monthBirthdays.length === 0) {
            return '<p class="text-muted" style="font-size: 0.85rem;">Nenhuma tarefa para este mês.</p>';
        }

        let html = '';
        const currentYear = new Date().getFullYear();

        // Adicionar Aniversários primeiro
        monthBirthdays.forEach(c => {
            const bDate = new Date(c.dataAniversario);
            const isSent = c.lastBirthdayGreetedYear === currentYear;

            html += `
                <div class="task-card-item" style="border-left-color: var(--warning); background: #fffcf0; position: relative;">
                    <div class="task-card-title">
                        <i data-lucide="gift" style="width:16px; color: var(--warning);"></i> 
                        <span>Aniversário: ${c.nome}</span>
                    </div>
                    <div class="task-card-time">
                        <i data-lucide="calendar" style="width:14px;"></i> 
                        <span>Dia ${bDate.getUTCDate()} de ${this.currentCalendarDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    </div>
                    <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                        ${isSent ? `
                            <span style="color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="check-circle-2" style="width:12px;"></i> Parabéns Enviado
                            </span>
                        ` : `
                            <button class="btn btn-sm btn-greet" data-id="${c.id}" style="color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; padding: 5px 12px; font-size: 0.75rem; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                <i data-lucide="message-circle" style="width:14px;"></i> Dar Parabéns
                            </button>
                        `}
                    </div>
                </div>
            `;
        });

        // Adicionar Tarefas
        monthTasks.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(t => {
            let borderColor = t.prioridade === 'Alta' ? 'var(--danger)' : 'var(--primary)';
            if (t.titulo.startsWith('Retorno:')) borderColor = '#8b5cf6';
            if (t.titulo.startsWith('Lembrete:')) borderColor = '#6366f1';

            html += `
                <div class="task-card-item" style="border-left-color: ${borderColor}; position: relative;">
                    <div class="task-card-title">${t.titulo}</div>
                    <div class="task-card-time">
                        <i data-lucide="clock" style="width:14px;"></i> 
                        <span>${new Date(t.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <button class="btn-icon text-danger btn-delete-task" data-id="${t.id}" style="position: absolute; bottom: 8px; right: 8px; padding: 4px;" title="Excluir Tarefa">
                        <i data-lucide="trash-2" style="width:14px;"></i>
                    </button>
                </div>
            `;
        });

        return html;
    },

bindCalendarEvents() {
        document.getElementById('prev-month').onclick = () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
            this.renderTasks(document.getElementById('content-area'));
        };
        document.getElementById('next-month').onclick = () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
            this.renderTasks(document.getElementById('content-area'));
        };

        // Evento para o botão de dar parabéns
        document.querySelectorAll('.btn-greet').forEach(btn => {
            btn.onclick = (e) => {
                const customerId = btn.getAttribute('data-id');
                const customer = db.getById('customers', customerId);
                
                // Abre o WhatsApp
                window.open(`https://wa.me/55${customer.whatsapp}`, '_blank');
                
                // Marca como enviado no banco de dados
                db.update('customers', customerId, {
                    lastBirthdayGreetedYear: new Date().getFullYear()
                });
                
                // Recarrega a agenda para mostrar o selo de enviado
                this.renderTasks(document.getElementById('content-area'));
            };
        });

        // Evento para excluir tarefa
        document.querySelectorAll('.btn-delete-task').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Deseja realmente excluir esta tarefa?')) {
                    db.delete('tasks', btn.getAttribute('data-id'));
                    this.renderTasks(document.getElementById('content-area'));
                }
            };
        });
    },

renderTaskForm(task = null) {
        const isEdit = !!task;
        const html = `
            <form id="task-form">
                <div class="input-group">
                    <label>Título da Tarefa</label>
                    <input type="text" id="task-title" value="${task?.titulo || ''}" required placeholder="Ex: Reunião com fornecedor">
                </div>
                <div class="flex gap-2">
                    <div class="input-group" style="flex: 1;">
                        <label>Data</label>
                        <input type="date" id="task-date" value="${task?.data || new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Prioridade</label>
                        <select id="task-priority">
                            <option value="Baixa" ${task?.prioridade === 'Baixa' ? 'selected' : ''}>Baixa</option>
                            <option value="Média" ${task?.prioridade === 'Média' ? 'selected' : ''}>Média</option>
                            <option value="Alta" ${task?.prioridade === 'Alta' ? 'selected' : ''}>Alta</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px 0 0 0;">
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Salvar Tarefa</button>
                </div>
            </form>
        `;
        this.showModal(isEdit ? 'Editar Tarefa' : 'Nova Tarefa', html);
        
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                titulo: document.getElementById('task-title').value,
                data: document.getElementById('task-date').value,
                prioridade: document.getElementById('task-priority').value,
                status: task?.status || 'Pendente'
            };
            if (isEdit) db.update('tasks', task.id, data);
            else db.create('tasks', data);
            this.hideModal();
            this.renderTasks(document.getElementById('content-area'));
        });
    }

};
