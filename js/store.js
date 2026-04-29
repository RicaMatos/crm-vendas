import { api } from './api.js';

class Store {
    constructor() {
        this.state = {
            customers: [],
            products: [],
            orders: [],
            crops: [],
            interactions: [],
            tasks: []
        };
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    getState() {
        return this.state;
    }

    async fetchAll() {
        try {
            const [customersRes, productsRes, ordersRes, cropsRes, interactionsRes, tasksRes] = await Promise.all([
                api.get('customers'),
                api.get('products'),
                api.get('orders'),
                api.get('crops'),
                api.get('interactions'),
                api.get('tasks')
            ]);
            
            // Extrai array de resposta API { success, data }
            const extractData = (res) => res?.data || res || [];
            
            this.state = {
                ...this.state,
                customers: extractData(customersRes),
                products: extractData(productsRes),
                orders: extractData(ordersRes),
                crops: extractData(cropsRes),
                interactions: extractData(interactionsRes),
                tasks: extractData(tasksRes)
            };
            this.notify();
        } catch (error) {
            console.error("Erro ao carregar dados do store:", error);
        }
    }

    async add(collection, data) {
        try {
            const res = await api.create(collection, data);
            const novo = res?.data || res;
            const list = this.state[collection] || [];
            list.push(novo);
            this.state[collection] = list;
            this.notify();
            window.ui?.showToast(`${collection} adicionado com sucesso!`, 'success');
            return novo;
        } catch (error) {
            console.error(`Erro ao adicionar em ${collection}`, error);
            window.ui?.showToast('Erro ao salvar. Verifique os dados.', 'error');
            throw error;
        }
    }

    async update(collection, id, data) {
        try {
            await api.update(collection, id, data);
            const list = this.state[collection] || [];
            const index = list.findIndex(item => item.id === id);
            if (index !== -1) {
                list[index] = { ...list[index], ...data };
                this.state[collection] = list;
                this.notify();
            }
            window.ui?.showToast(`${collection} atualizado com sucesso!`, 'success');
        } catch (error) {
            console.error(`Erro ao atualizar ${collection}`, error);
            window.ui?.showToast('Erro ao atualizar. Tente novamente.', 'error');
            throw error;
        }
    }

    async remove(collection, id) {
        try {
            await api.delete(collection, id);
            this.state[collection] = this.state[collection].filter(item => item.id != id);
            this.notify();
            window.ui?.showToast(`${collection} removido com sucesso!`, 'success');
        } catch (error) {
            console.error(`Erro ao remover de ${collection}`, error);
            window.ui?.showToast('Erro ao remover. Tente novamente.', 'error');
            throw error;
        }
    }
}

export const store = new Store();
