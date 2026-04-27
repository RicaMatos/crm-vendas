// js/api.js
const API_URL = '/api';

function getHeaders() {
    const token = sessionStorage.getItem('CRM_TOKEN') || localStorage.getItem('CRM_TOKEN');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export const api = {
    async get(collection) {
        const res = await fetch(`${API_URL}/${collection}`, { headers: getHeaders() });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                sessionStorage.removeItem('CRM_TOKEN');
                localStorage.removeItem('CRM_TOKEN');
                window.location.reload();
            }
            throw new Error(`Erro ao buscar ${collection}`);
        }
        return res.json();
    },
    async create(collection, data) {
        const res = await fetch(`${API_URL}/${collection}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Erro ao criar em ${collection}`);
        }
        return res.json();
    },
    async update(collection, id, data) {
        const res = await fetch(`${API_URL}/${collection}/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Erro ao atualizar ${collection}`);
        }
        return res.json();
    },
    async delete(collection, id) {
        const res = await fetch(`${API_URL}/${collection}/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Erro ao deletar de ${collection}`);
        }
        return res.json();
    }
};
