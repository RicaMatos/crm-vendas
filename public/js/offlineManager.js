/**
 * Gerenciador Offline - IndexedDB
 * @file public/js/offlineManager.js
 * 
 * Salva dados localmente para funcionar sem internet.
 * Sincroniza automaticamente quando a conexão voltar.
 */

const DB_NAME = 'crm-vendas-offline';
const DB_VERSION = 1;

class OfflineManager {
    constructor() {
        this.db = null;
        this.isOnline = navigator.onLine;
        this.pendingSync = [];
        
        this.init();
    }

    async init() {
        await this.openDB();
        this.setupEventListeners();
        await this.loadPendingSync();
    }

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[OfflineManager] Erro ao abrir DB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[OfflineManager] IndexedDB conectado');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store para dados cacheados
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }
                
                // Store para sincronização pendente
                if (!db.objectStoreNames.contains('pending')) {
                    const pendingStore = db.createObjectStore('pending', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    pendingStore.createIndex('type', 'type', { unique: false });
                    pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    setupEventListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    handleOnline() {
        console.log('[OfflineManager] Conexão restaurada!');
        this.isOnline = true;
        this.syncPending();
        window.ui?.showToast('Conexão restaurada!', 'success');
    }

    handleOffline() {
        console.log('[OfflineManager] Conexão perdida!');
        this.isOnline = false;
        window.ui?.showToast('Modo offline - dados serão salvos localmente', 'warning');
    }

    // ============================================
    // CACHE DE DADOS
    // ============================================

    async setCache(key, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            
            const request = store.put({
                key,
                data,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCache(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result?.data || null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearCache(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // FILA DE SINCRONIZAÇÃO
    // ============================================

    async addToPendingSync(operation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            
            const record = {
                ...operation,
                timestamp: Date.now(),
                retries: 0
            };

            const request = store.add(record);

            request.onsuccess = () => {
                console.log('[OfflineManager] Operação salva para sincronizar:', operation.type);
                this.pendingSync.push(record);
                
                // Se online, tenta sincronizar
                if (this.isOnline) {
                    this.syncPending();
                }
                
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async loadPendingSync() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readonly');
            const store = transaction.objectStore('pending');
            const request = store.getAll();

            request.onsuccess = () => {
                this.pendingSync = request.result || [];
                console.log(`[OfflineManager] ${this.pendingSync.length} operações pendentes`);
                resolve(this.pendingSync);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async syncPending() {
        if (!this.isOnline || this.pendingSync.length === 0) return;

        console.log(`[OfflineManager] Sincronizando ${this.pendingSync.length} operações...`);

        const failed = [];

        for (const operation of this.pendingSync) {
            try {
                await this.executeOperation(operation);
                await this.removePending(operation.id);
                console.log('[OfflineManager] Sincronizado:', operation.type);
            } catch (error) {
                console.error('[OfflineManager] Erro ao sincronizar:', error);
                
                operation.retries++;
                if (operation.retries >= 3) {
                    console.error('[OfflineManager] Operation failed after 3 retries, removing:', operation.type);
                    await this.removePending(operation.id);
                } else {
                    failed.push(operation);
                }
            }
        }

        this.pendingSync = failed;
        
        if (failed.length === 0) {
            window.ui?.showToast('Dados sincronizados com sucesso!', 'success');
        } else {
            window.ui?.showToast(`${failed.length} operações falharam`, 'error');
        }
    }

    async executeOperation(operation) {
        const { type, endpoint, method, body } = operation;
        
        const response = await fetch(`/api/${endpoint}`, {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('CRM_TOKEN')}`
            },
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    async removePending(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            const request = store.delete(id);

            request.onsuccess = () => {
                this.pendingSync = this.pendingSync.filter(p => p.id !== id);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // FORMULÁRIOS (PERSISTÊNCIA)
    // ============================================

    async saveFormDraft(key, data) {
        return this.setCache(`form_draft_${key}`, data);
    }

    async getFormDraft(key) {
        return this.getCache(`form_draft_${key}`);
    }

    async clearFormDraft(key) {
        return this.clearCache(`form_draft_${key}`);
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus() {
        return {
            isOnline: this.isOnline,
            pendingCount: this.pendingSync.length,
            lastSync: this.pendingSync.length > 0 
                ? new Date(Math.max(...this.pendingSync.map(p => p.timestamp)))
                : null
        };
    }
}

// Singleton - expõe globalmente
window.offlineManager = new OfflineManager();
window.OfflineManager = OfflineManager;