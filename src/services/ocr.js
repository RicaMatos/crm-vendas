/**
 * Serviço de OCR para Extração de Texto de Imagens
 * @module services/ocr
 * 
 * Usa Tesseract.js para OCR local (gratuito, sem API externa).
 */

const Tesseract = require('tesseract.js');

/**
 * Extrai texto de uma imagem usando OCR local
 * @param {Buffer|string} imageData - Imagem em buffer ou base64
 * @returns {Promise<string>} Texto extraído
 */
async function extrairTextoDeImagem(imageData) {
    try {
        const result = await Tesseract.recognize(imageData, 'por+eng', {
            logger: () => {}
        });
        return result.data.text;
    } catch (error) {
        console.error('[ocr] Erro ao processar imagem:', error.message);
        throw new Error(`Falha no OCR: ${error.message}`);
    }
}

/**
 * Extrai dados de clientes do texto usando regex/padrões
 * @param {string} texto - Texto extraído da imagem
 * @returns {Array} Array de clientes
 */
function extrairClientesDoTexto(texto) {
    const clientes = [];
    const linhas = texto.split('\n').filter(l => l.trim());

    let clienteAtual = null;

    for (const linha of linhas) {
        const limpa = linha.trim();
        if (!limpa) continue;

        // Detecta padrão de nome (geralmente linhas com letras maiúsculas)
        const nomeMatch = limpa.match(/^([A-ZÀÁÉÍÓÚÂÊÎÔÛÃÕ][a-zàáéíóúâêîôûãõ]+\s+[A-ZÀÁÉÍÓÚÂÊÎÔÛÃÕ][a-zàáéíóúâêîôûãõ]+)/);
        
        // Detecta CPF (###.###.###-## ou ###########)
        const cpfMatch = limpa.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        
        // Detecta telefone/whatsapp
        const telMatch = limpa.match(/(?:whatsapp|tel|fone)?\s*[:.]?\s*(\d{2,3}[-\s]?\d{4,5}[-\s]?\d{4})/i);
        
        // Detecta email
        const emailMatch = limpa.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

        // Se encontrou nome, cria novo cliente
        if (nomeMatch && nomeMatch[1] && nomeMatch[1].length > 3) {
            if (clienteAtual && clienteAtual.nome) {
                clientes.push(clienteAtual);
            }
            clienteAtual = { nome: nomeMatch[1].trim() };
        }

        if (clienteAtual) {
            if (cpfMatch && !clienteAtual.documento) {
                clienteAtual.documento = cpfMatch[1].replace(/\D/g, '');
            }
            if (telMatch && !clienteAtual.whatsapp) {
                let tel = telMatch[1].replace(/\D/g, '');
                if (tel.length === 10 || tel.length === 11) {
                    tel = '55' + tel;
                }
                clienteAtual.whatsapp = tel;
            }
            if (emailMatch && !clienteAtual.email) {
                clienteAtual.email = emailMatch[1].toLowerCase();
            }
        }
    }

    if (clienteAtual && clienteAtual.nome) {
        clientes.push(clienteAtual);
    }

    return clientes.filter(c => c.nome && c.nome.length > 2);
}

module.exports = {
    extrairTextoDeImagem,
    extrairClientesDoTexto
};