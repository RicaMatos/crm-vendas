/**
 * Parser Local para Extração de Dados de Clientes
 * @module services/parser
 * 
 * Extrai dados de clientes de arquivos usando regex/padrões.
 * 100% gratuito - sem API externa.
 */

const XLSX = require('xlsx');

function normalizaDocumento(doc) {
    if (!doc) return null;
    return String(doc).replace(/\D/g, '');
}

function normalizaTelefone(tel) {
    if (!tel) return null;
    let telStr = String(tel).replace(/\D/g, '');
    if (telStr.length === 10) telStr = '55' + telStr;
    if (telStr.length === 11) telStr = '55' + telStr;
    return telStr;
}

function extrairClientesDeTexto(texto) {
    const clientes = [];
    const linhas = texto.split(/[\n\r]+/).filter(l => l.trim());
    
    const regexCpf = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;
    const regexCnpj = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
    const regexTel = /\d{2,3}[-\s]?\d{4,5}[-\s]?\d{4}/;
    const regexEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    
    for (const linha of linhas) {
        const textoLinha = linha.trim();
        if (!textoLinha || textoLinha.length < 3) continue;
        
        const cpfMatch = textoLinha.match(regexCpf);
        const cnpjMatch = textoLinha.match(regexCnpj);
        const docMatch = cpfMatch || cnpjMatch;
        const telMatch = textoLinha.match(regexTel);
        const emailMatch = textoLinha.match(regexEmail);
        
        let nomeLimpo = textoLinha
            .replace(regexCpf, '')
            .replace(regexCnpj, '')
            .replace(regexEmail, '')
            .replace(regexTel, '')
            .replace(/\d+/g, '')
            .replace(/[.,;]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (nomeLimpo.length > 3) {
            clientes.push({
                nome: nomeLimpo,
                documento: docMatch ? normalizaDocumento(docMatch[0]) : null,
                whatsapp: telMatch ? normalizaTelefone(telMatch[0]) : null,
                email: emailMatch ? emailMatch[0].toLowerCase() : null
            });
        } else if (docMatch || telMatch || emailMatch) {
            clientes.push({
                documento: docMatch ? normalizaDocumento(docMatch[0]) : null,
                whatsapp: telMatch ? normalizaTelefone(telMatch[0]) : null,
                email: emailMatch ? emailMatch[0].toLowerCase() : null
            });
        }
    }
    
    return clientes;
}

function extrairClientesDeExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const clientes = [];
    
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        for (const row of dados) {
            const valores = Object.values(row).filter(v => v);
            let cliente = {};
            
            for (const valor of valores) {
                const str = String(valor).trim();
                const doc = normalizaDocumento(str);
                if (doc && (doc.length === 11 || doc.length === 14)) {
                    cliente.documento = doc;
                    continue;
                }
                
                const tel = normalizaTelefone(str);
                if (tel && tel.length >= 12) {
                    cliente.whatsapp = tel;
                    continue;
                }
                
                if (str.includes('@') && str.includes('.')) {
                    cliente.email = str.toLowerCase();
                    continue;
                }
                
                if (str.length > 3 && /^[A-Za-zÀ-ÿ\s]+$/.test(str) && !cliente.nome) {
                    cliente.nome = str;
                }
            }
            
            if (cliente.nome || cliente.documento) {
                clientes.push(cliente);
            }
        }
    }
    
    return clientes;
}

function processarArquivo(buffer, filename) {
    const ext = filename.toLowerCase().split('.').pop();
    
    if (ext === 'xlsx' || ext === 'xls') {
        return extrairClientesDeExcel(buffer);
    }
    
    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
        const texto = buffer.toString('utf-8');
        return extrairClientesDeTexto(texto);
    }
    
    if (ext === 'pdf') {
        const texto = buffer.toString('utf-8');
        return extrairClientesDeTexto(texto);
    }
    
    return [];
}

module.exports = {
    extrairClientesDeTexto,
    extrairClientesDeExcel,
    processarArquivo,
    normalizaDocumento,
    normalizaTelefone
};