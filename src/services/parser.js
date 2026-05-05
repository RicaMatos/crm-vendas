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
    
    console.log('[parser] Total de linhas:', linhas.length);
    
    for (const linha of linhas) {
        const textoLinha = linha.trim();
        if (!textoLinha || textoLinha.length < 3) continue;
        
        // Separa por tab, vírgula ou ponto-e-vírgula
        const campos = textoLinha.split(/[\t,;]+/).map(c => c.trim()).filter(c => c);
        
        // Tenta extrair dados de cada campo
        let cliente = { nome: null, documento: null, whatsapp: null, email: null };
        
        for (const campo of campos) {
            const doc = normalizaDocumento(campo);
            if (doc && (doc.length === 11 || doc.length === 14)) {
                cliente.documento = doc;
                continue;
            }
            
            const tel = normalizaTelefone(campo);
            if (tel && tel.length >= 12) {
                cliente.whatsapp = tel;
                continue;
            }
            
            if (campo.includes('@') && campo.includes('.')) {
                cliente.email = campo.toLowerCase();
                continue;
            }
        }
        
        // Se tem documento, usa como nome o primeiro campo texto
        if (cliente.documento && !cliente.nome) {
            for (const campo of campos) {
                if (!normalizaDocumento(campo) && !campo.includes('@') && campo.length > 3) {
                    cliente.nome = campo;
                    break;
                }
            }
        }
        
        // Se só tem nome (sem documento), tenta usar
        if (!cliente.nome && campos.length > 0) {
            for (const campo of campos) {
                if (!normalizaDocumento(campo) && !campo.includes('@') && !campo.match(/^\d+$/) && campo.length > 3) {
                    cliente.nome = campo;
                    break;
                }
            }
        }
        
        // Aceita qualquer coisa que tenha nome OU documento
        if (cliente.nome || cliente.documento) {
            clientes.push(cliente);
        }
    }
    
    console.log('[parser] Clientes extraídos:', clientes.length);
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