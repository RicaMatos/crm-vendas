# CRM Vendas - Histórico de Ajustes

## Problema Reportado
Clientes não carregando na tela do usuário logado - retornando erro 401 (token undefined)

## Diagnóstico Realizado

### 1. Descoberta Inicial
- O sistema usa TWO apps JavaScript diferentes:
  - `/js/app.js` (SPA moderna - não estava sendo usada)
  - `/public/js/app.js` (app mobile-first - era a usada)

### 2. Identificação do Bug
- O `DataStore` em `public/js/app.js` não inicializava `this.token`
- O construtor não tinha referência ao token do localStorage
- Resultado: todas as APIs (customers, orders, products, crops, tasks) enviavam `Bearer undefined`

## Ajustes Realizados

### public/js/app.js - DataStore (linha ~316)

**Antes:**
```javascript
class DataStore {
    constructor() {
        this.data = { customers: [], orders: [], ... };
    }
}
```

**Depois:**
```javascript
class DataStore {
    constructor() {
        this.token = localStorage.getItem('CRM_TOKEN');
        this.data = { customers: [], orders: [], ... };
    }
}
```

### public/js/app.js - fetchAll (linha ~327)

**Antes:**
```javascript
async fetchAll() {
    const token = this.token;  // undefined!
    const headers = { 'Authorization': `Bearer ${token}`, ... };
}
```

**Depois:**
```javascript
async fetchAll() {
    const token = localStorage.getItem('CRM_TOKEN') || this.token;
    const headers = { 'Authorization': `Bearer ${token}`, ... };
}
```

### Backend - Logs de debug temporários adicionados e removidos
- `src/middleware/authenticate.js` - logs de debug removidos
- `src/services/customerService.js` - logs de debug removidos  
- `src/routes/auth.js` - logs de debug removidos
- `src/routes/customers.js` - logs de debug removidos

### Frontend JS (não usado) - também limpo
- `js/auth.js` - logs de debug removidos
- `js/api.js` - logs de debug removidos
- `js/store.js` - logs de debug removidos

## Data da Correção
29/04/2026

## Resultado
Clientes agora aparecem corretamente na tela do usuário logado após login.