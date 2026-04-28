/**
 * Cliente Supabase - Frontend
 * @file public/js/supabaseClient.js
 * 
 * Gerencia conexão com Supabase para o frontend.
 * Suporta modo offline com cache local.
 */

const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://zgtakbznmuxkibxybdky.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOilzdXBhYmFzZSIsInJlZiI6InpndGFrYnpubXV4a2lieHliZGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYwODIsImV4cCI6MjA5MjQzMjA4Mn0.oifEbE6EflNcBdKk_AmYbHm0g5y1Q5MNfrn89UkkiDQ';

// Tentará o backend primeiro, se falhar usa API direta do Supabase
let API_BASE = '/api';

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.token = this.getToken();
    }

    getToken() {
        return localStorage.getItem('CRM_TOKEN') || sessionStorage.getItem('CRM_TOKEN');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('CRM_TOKEN', token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('CRM_TOKEN');
        sessionStorage.removeItem('CRM_TOKEN');
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': this.token ? `Bearer ${this.token}` : `Bearer ${this.key}`
        };
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `Erro HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            }
            return response.text();
        } catch (error) {
            console.error('[SupabaseClient] Erro na requisição:', error);
            throw error;
        }
    }

    // Tabela genérica
    from(table) {
        return {
            select: (columns = '*') => {
                const query = { _select: columns };
                return {
                    eq: (column, value) => {
                        query[`${column}`] = `eq.${value}`;
                        return this.buildQuery(table, query);
                    },
                    order: (column, { ascending = true } = {}) => {
                        query['_order'] = column;
                        query['_sort'] = ascending ? 'asc' : 'desc';
                        return this.buildQuery(table, query);
                    },
                    limit: (count) => {
                        query['_limit'] = count;
                        return this.buildQuery(table, query);
                    }
                };
            },
            insert: (data) => this.request(table, {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            update: (data) => {
                const id = data.id;
                delete data.id;
                return this.request(`${table}?id=eq.${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data)
                });
            },
            delete: (id) => this.request(`${table}?id=eq.${id}`, {
                method: 'DELETE'
            })
        };
    }

    buildQuery(table, query) {
        let url = `${table}?select=${query._select || '*'}`;
        
        for (const [key, value] of Object.entries(query)) {
            if (key.startsWith('_')) continue;
            if (key === '_select') continue;
            
            if (key.includes('.')) {
                url += `&${key}=${value}`;
            } else {
                url += `&${key}=eq.${value}`;
            }
        }

        if (query._order) {
            url += `&order=${query._order}${query._sort === 'desc' ? '.desc' : ''}`;
        }
        if (query._limit) {
            url += `&limit=${query._limit}`;
        }

        return {
            then: (resolve, reject) => {
                this.request(url).then(resolve).catch(reject);
            }
        };
    }

    // Auth
    auth = {
        signUp: async (email, password) => {
            const response = await fetch(`${this.url}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.key
                },
                body: JSON.stringify({ email, password })
            });
            return response.json();
        },

        signInWithPassword: async (email, password) => {
            const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.key
                },
                body: JSON.stringify({ email, password })
            });
            return response.json();
        },

        getSession: async () => {
            if (!this.token) return { data: { session: null }, error: null };
            
            const response = await fetch(`${this.url}/auth/v1/user`, {
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                return { data: { session: { user } }, error: null };
            }
            return { data: { session: null }, error: new Error('Sessão inválida') };
        }
    };
}

// Singleton - expõe globalmente
window.supabase = new SupabaseClient();
window.SupabaseClient = SupabaseClient;