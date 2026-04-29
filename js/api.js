// js/api.js
const API_URL = '/api';

function getHeaders() {
    const sessionToken = sessionStorage.getItem('CRM_TOKEN');
    const localToken = localStorage.getItem('CRM_TOKEN');
    const token = sessionToken || localToken;
    console.log('[api] getHeaders - session:', sessionToken?.substring(0, 20) ?? 'null', 'local:', localToken?.substring(0, 20) ?? 'null');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export const api = {
    async get(collection) {
        const headers = getHeaders();
        console.log(`[api] GET ${collection}`, { hasToken: !!headers.Authorization });
        
        const res = await fetch(`${API_URL}/${collection}`, { headers });
        console.log(`[api] Response ${collection}:`, res.status, res.ok);
        
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                const errorData = await res.json().catch(() => ({}));
                console.log(`[api] Erro ${collection}:`, errorData);
                window.ui?.showToast(errorData.message || 'Sessão expirada. Faça login novamente.', 'error');
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
