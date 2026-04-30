const http = require('http');

function makeRequest(path, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/' + path,
            method: 'GET',
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve({ raw: data });
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// Gerar token de teste
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'crm_vendas_2026_chave_jwt_producao_segura_aleatoria';

// Preciso de um token válido - vou criar um
const testToken = jwt.sign(
    { sub: 'test-user-id', email: 'test@test.com' },
    JWT_SECRET,
    { expiresIn: '7d' }
);

console.log('Token:', testToken);
console.log('Testando /api/customers...\n');

makeRequest('customers', testToken).then(r => {
    console.log('Customers response:', JSON.stringify(r, null, 2));
}).catch(e => console.error('Erro:', e.message));