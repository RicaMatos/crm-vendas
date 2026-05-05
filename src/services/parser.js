/**
 * Parser Local para Extração de Dados de Clientes
 * @module services/parser
 * 
 * Extrai dados de clientes de arquivos usando regex/padrões.
 * 100% gratuito - sem API externa.
 */

const XLSX = require('xlsx');

/**
 * Normaliza CPF/CNPJ (remove pontuação)
 */
function normalizaDocumento(doc) {
    if (!doc) return null;
    return String(doc).replace(/\D/g, '');
}

/**
 * Normaliza telefone (adiciona código do país)
 */
function normalizaTelefone(tel) {
    if (!tel) return null;
    let telStr = String(tel).replace(/\D/g, '');
    if (telStr.length === 10) telStr = '55' + telStr;
    if (telStr.length === 11) telStr = '55' + telStr;
    return telStr;
}

/**
 * Extrai dados de clientes de texto
 * @param {string} texto - Texto do arquivo
 * @returns {Array} Array de clientes
 */
function extrairClientesDeTexto(texto) {
    const clientes = [];
    const linhas = texto.split(/[\n\r]+/).filter(l => l.trim());

    // Regexes padrão
    const regexNome = /^"?([A-ZÀÁÉÍÓÚÂÊÎÔÛÃÕ][a-zàáéíóúâêîôûãõ]+(?:\s+[A-ZÀÁÉÍÓÚÂÊÎÔÛÃÕ][a-zàáéíóúâêîôûãõ]+)+)/i;
    const regexCpf = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
    const regexCnpj = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
    const regexTel = /(\d{2,3}[-\s]?\d{4,5}[-\s]?\d{4})/;
    const regexEmail = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const regexCep = /(\d{5}-?\d{3})/;
    const regexStatus = /(lead|prospect|cliente|inativo)/i;

    for (const linha of linhas) {
        const originais = linha.split(/\t|,|;/).map(c => c.trim()).filter(c => c);
        if (originais.length < 2) continue;

        let cliente = {};

        // Tenta detectar campos por posição ou por padrão
        for (const valor of originais) {
            const doc = normalizaDocumento(valor);
            if (doc && (doc.length === 11 || doc.length === 14)) {
                if (doc.length === 11) cliente.documento = doc;
                else cliente.documento = doc;
                continue;
            }

            const tel = normalizaTelefone(valor);
            if (tel && tel.length >= 12) {
                cliente.whatsapp = tel;
                continue;
            }

            const email = valor.match(regexEmail);
            if (email) {
                cliente.email = email[1].toLowerCase();
                continue;
            }

            const nome = valor.match(regexNome);
            if (nome && nome[1].length > 3 && !cliente.nome) {
                cliente.nome = nome[1].trim();
                continue;
            }
        }

        if (cliente.nome || cliente.documento) {
            clientes.push(cliente);
        }
    }

    return clientes.filter(c => c.nome || c.documento);
}

/**
 * Extrai dados de planilha Excel
 */
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

/**
 * Processa arquivo e retorna clientes
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} filename - Nome do arquivo
 * @returns {Array} Array de clientes
 */
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
        // PDF precisa de parser próprio ou retornar texto
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