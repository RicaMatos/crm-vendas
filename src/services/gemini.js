/**
 * Serviço de Integração com Google Gemini API
 * @module services/gemini
 * 
 * Usa Gemini 1.5 Flash (gratuito) para extrair dados
 * estruturados de arquivos de clientes.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Extrai dados de clientes a partir do texto extraído de um arquivo
 * @param {string} textoConteudo - Texto extraído do arquivo
 * @param {string} tipoArquivo - Tipo original do arquivo (ex: csv, xlsx, pdf, txt)
 * @returns {Promise<Array>} Array de objetos de cliente
 */
async function extrairClientesDoTexto(textoConteudo, tipoArquivo) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não configurada no .env');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
Você é um assistente especializado em extrair dados de clientes de arquivos.
Analise o conteúdo abaixo extraído de um arquivo do tipo "${tipoArquivo}" e retorne APENAS um JSON válido.

REGRAS:
1. Retorne SOMENTE um array JSON válido, sem markdown, sem explicações
2. Se não encontrar nenhum cliente, retorne []
3. Mapeie colunas que encontrar para os campos abaixo
4. Se um campo não existir no arquivo, use null
5. Normalize os valores conforme as regras abaixo

CAMPOS (todos opcionais exceto nome):
- nome (string, obrigatório): Nome completo do cliente
- documento (string|null): CPF ou CNPJ (apenas números, remover formatação)
- whatsapp (string|null): Telefone/WhatsApp (apenas números com código do país, ex: 5511999999999)
- email (string|null): E-mail do cliente
- logradouro (string|null): Nome da rua/avenida
- numero (string|null): Número do endereço
- complemento (string|null): Complemento do endereço
- bairro (string|null): Bairro
- cep (string|null): CEP (apenas números)
- cidade (string|null): Nome da cidade
- uf (string|null): Sigla do estado (2 letras maiúsculas)
- localizacao (string|null): Referência de localização
- status (string|null): STATUS - Deve ser um de: "Lead", "Prospect", "Cliente", "Inativo". Se não encontrar, use "Lead"
- data_aniversario (string|null): Data de aniversário no formato YYYY-MM-DD. Se não tiver ano, use o ano atual
- observacao (string|null): Observação adicional sobre o cliente

CONTEÚDO DO ARQUIVO:
---
${textoConteudo.substring(0, 30000)}
---
`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Remove markdown code blocks se houver
        let jsonStr = text.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```\n?/g, '').trim();
        }

        const clientes = JSON.parse(jsonStr);

        if (!Array.isArray(clientes)) {
            throw new Error('Gemini não retornou um array válido');
        }

        // Filtra entradas sem nome
        return clientes.filter(c => c.nome && c.nome.trim() !== '');
    } catch (error) {
        console.error('[gemini] Erro ao processar resposta:', error);
        throw new Error(`Falha ao extrair dados com IA: ${error.message}`);
    }
}

/**
 * Extrai dados de clientes a partir de uma imagem usando Gemini Vision
 * @param {string} base64Image - Imagem em formato base64
 * @param {string} mimeType - Tipo MIME da imagem
 * @returns {Promise<Array>} Array de objetos de cliente
 */
async function extrairClientesDeImagem(base64Image, mimeType) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não configurada no .env');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
Você é um assistente especializado em extrair dados de clientes de imagens.
Analise a imagem fornecida e retorne APENAS um JSON válido com os dados dos clientes encontrados.

REGRAS:
1. Retorne SOMENTE um array JSON válido, sem markdown
2. Se não encontrar nenhum cliente, retorne []

CAMPOS (todos opcionais exceto nome):
- nome (string): Nome completo
- documento (string|null): CPF ou CNPJ (apenas números)
- whatsapp (string|null): Telefone com código do país
- email (string|null): E-mail
- logradouro (string|null): Rua/avenida
- numero (string|null): Número
- complemento (string|null): Complemento
- bairro (string|null): Bairro
- cep (string|null): CEP (apenas números)
- cidade (string|null): Cidade
- uf (string|null): Estado (2 letras)
- status (string|null): "Lead", "Prospect", "Cliente", "Inativo"
- observacao (string|null): Observação
`;

    try {
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        const text = response.text();

        let jsonStr = text.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }

        const clientes = JSON.parse(jsonStr);

        if (!Array.isArray(clientes)) {
            throw new Error('Gemini não retornou um array válido');
        }

        return clientes.filter(c => c.nome && c.nome.trim() !== '');
    } catch (error) {
        console.error('[gemini] Erro ao processar imagem:', error);
        throw new Error(`Falha ao processar imagem com IA: ${error.message}`);
    }
}

module.exports = {
    extrairClientesDoTexto,
    extrairClientesDeImagem
};
