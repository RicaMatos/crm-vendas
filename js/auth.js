const API_URL = '/api/auth';

export const auth = {
    async login(email, senha, rememberMe = false) {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha, rememberMe })
            });
            const data = await res.json();
            if (data.success) {
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('CRM_TOKEN', data.token);
                storage.setItem('CRM_USER', JSON.stringify(data.user));
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (e) {
            return { success: false, message: 'Erro de conexão com o servidor' };
        }
    },

    async register(nome, email, senha) {
        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha })
            });
            const data = await res.json();
            return data;
        } catch (e) {
            return { success: false, message: 'Erro de conexão com o servidor' };
        }
    },

    logout() {
        sessionStorage.removeItem('CRM_TOKEN');
        sessionStorage.removeItem('CRM_USER');
        localStorage.removeItem('CRM_TOKEN');
        localStorage.removeItem('CRM_USER');
        window.location.reload();
    },

    isAuthenticated() {
        return !!(sessionStorage.getItem('CRM_TOKEN') || localStorage.getItem('CRM_TOKEN'));
    },

    getUser() {
        const user = sessionStorage.getItem('CRM_USER') || localStorage.getItem('CRM_USER');
        return user ? JSON.parse(user) : null;
    },

    isAdmin() {
        const user = this.getUser();
        return user && user.nivel === 'Admin';
    }
};
