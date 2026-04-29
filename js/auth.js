const API_URL = '/api/auth';

export const auth = {
    async login(email, password, rememberMe = false) {
        try {
            console.log('[auth] Tentando login:', email, 'rememberMe:', rememberMe);
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe })
            });
            const data = await res.json();
            console.log('[auth] Resposta complete do servidor:', JSON.stringify(data));
            
            if (data.success && data.data) {
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('CRM_TOKEN', data.data.token);
                console.log('[auth] Token salvo:', data.data.token?.substring(0, 20) ?? 'NULL');
                console.log('[auth] Verificando storage:', storage.getItem('CRM_TOKEN')?.substring(0, 20) ?? 'NULL');
                const userWithNivel = { ...data.data.user, nivel: data.data.user.nivel || 'Vendedor' };
                storage.setItem('CRM_USER', JSON.stringify(userWithNivel));
                return { success: true };
            } else {
                return { success: false, message: data.message || 'Erro ao fazer login' };
            }
        } catch (e) {
            console.error('[auth] Erro de conexão:', e);
            return { success: false, message: 'Erro de conexão com o servidor' };
        }
    },

    async register(nome, email, senha) {
        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, password: senha })
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
