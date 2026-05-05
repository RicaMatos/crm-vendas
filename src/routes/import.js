/**
 * Rotas de Importação de Clientes
 * @module routes/import
 * 
 * Upload de arquivos (CSV, XLSX, PDF, TXT) com extração
 * automática via IA (Gemini) e cadastro em lote.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const os = require('os');

const { authenticate } = require('../middleware/authenticate');
const { supabase } = require('../config/supabaseClient');
const { processarArquivo } = require('../services/parser');
const { extrairTextoDeImagem, extrairClientesDoTexto: extrairClientesViaOCR } = require('../services/ocr');

// Configura multer para armazenar em memória
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'text/csv',
            'text/plain',
            'text/tab-separated-values',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/pdf',
            'application/octet-stream',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ];
        const allowedExts = ['.csv', '.txt', '.xlsx', '.xls', '.pdf', '.tsv', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

        if (!file.fieldname) {
            file.fieldname = file.originalname;
        }
        
        const ext = path.extname(file.fieldname).toLowerCase();
        if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Formato não suportado: ${ext}. Use CSV, XLSX, PDF, TXT ou imagem (JPG, PNG).`));
        }
    }
});

// Aplica autenticação em todas as rotas
router.use(authenticate);

/**
 * Extrai texto do buffer do arquivo conforme o tipo
 */
function extrairTextoArquivo(buffer, originalname) {
    const ext = path.extname(originalname).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets = [];

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (jsonData.length > 0) {
                const headers = Object.keys(jsonData[0]);
                sheets.push(`--- Planilha: ${sheetName} ---`);
                sheets.push(headers.join('\t'));
                jsonData.forEach(row => {
                    sheets.push(headers.map(h => String(row[h] || '')).join('\t'));
                });
            }
        });

        return sheets.join('\n');
    }

    if (ext === '.pdf') {
        // Para PDF, retornamos o buffer em base64 e deixamos o Gemini processar
        // Mas primeiro tentamos extrair texto com pdf-parse
        try {
            const pdfParse = require('pdf-parse');
            return pdfParse(buffer).then(data => data.text);
        } catch (e) {
            // Se pdf-parse falhar, retornamos indicação para Gemini processar o binário
            return `[Arquivo PDF: ${originalname}]\nConteúdo binário disponível para análise.`;
        }
    }

    // CSV, TXT, TSV - lê como texto
    return buffer.toString('utf-8');
}

/**
 * POST /api/import/customers/preview
 * Faz upload do arquivo e retorna preview dos dados extraídos
 */
router.post('/customers/preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo enviado. Selecione um arquivo CSV, XLSX, PDF, TXT ou imagem (JPG, PNG).'
            });
        }

        const { buffer, originalname, mimetype } = req.file;
        const ext = path.extname(originalname).toLowerCase();

        console.log(`[import] Processando arquivo: ${originalname} (${(buffer.length / 1024).toFixed(1)}KB)`);

        // Extrai texto do arquivo
        let textoExtraido;
        let tipoArquivo = ext.replace('.', '').toUpperCase();

        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            // Imagens: usa OCR local (Tesseract.js)
            const base64 = buffer.toString('base64');
            const mimeType = mimetype || `image/${ext.replace('.', '')}`;
            
            console.log(`[import] Processando imagem com OCR: ${originalname}`);
            const textoOCR = await extrairTextoDeImagem(`data:${mimeType};base64,${base64}`);
            console.log(`[import] OCR extraiu ${textoOCR.length} caracteres`);
            
            clientesExtraidos = extrairClientesViaOCR(textoOCR);
        } else if (ext === '.pdf') {
            try {
                const pdfParse = require('pdf-parse');
                const pdfData = await pdfParse(buffer);
                textoExtraido = pdfData.text;
                console.log(`[import] PDF extraído: ${textoExtraido.length} caracteres`);
            } catch (pdfErr) {
                console.warn('[import] pdf-parse falhou, enviando raw para Gemini:', pdfErr.message);
                textoExtraido = `[Arquivo PDF: ${originalname}]\nO conteúdo está em formato binário (base64). Analise o documento e extraia os dados dos clientes.`;
            }
        } else {
            // CSV, XLSX, TXT: usa parser local
            clientesExtraidos = processarArquivo(buffer, originalname);
        }

        if (!clientesExtraidos || clientesExtraidos.length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Não foi possível identificar dados de clientes no arquivo. Verifique o formato e tente novamente.',
                data: {
                    filename: originalname,
                    linhasProcessadas: textoExtraido.split('\n').length,
                    clientesEncontrados: 0
                }
            });
        }

        console.log(`[import] Gemini extraiu ${clientesExtraidos.length} clientes de ${originalname}`);

        // Retorna preview
        res.json({
            success: true,
            data: {
                filename: originalname,
                tamanhoKB: (buffer.length / 1024).toFixed(1),
                linhasProcessadas: textoExtraido.split('\n').length,
                clientesEncontrados: clientesExtraidos.length,
                clientes: clientesExtraidos
            }
        });

    } catch (error) {
        console.error('[import] Erro no preview:', error);

        if (error.message.includes('Formato não suportado')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('GEMINI_API_KEY')) {
            return res.status(500).json({
                success: false,
                message: 'Chave da API Gemini não configurada. Configure GEMINI_API_KEY no .env.'
            });
        }

        res.status(500).json({
            success: false,
            message: `Erro ao processar arquivo: ${error.message}`
        });
    }
});

/**
 * POST /api/import/customers/confirm
 * Confirma a importação e cadastra os clientes no Supabase
 */
router.post('/customers/confirm', async (req, res) => {
    try {
        const { clientes } = req.body;

        if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum cliente para importar. Envie um array de clientes.'
            });
        }

        if (clientes.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limite máximo de 1000 clientes por importação.'
            });
        }

        const userId = req.user.id;
        const resultados = [];
        let importados = 0;
        const erros = [];

        for (let i = 0; i < clientes.length; i++) {
            const c = clientes[i];

            try {
                // Valida nome
                if (!c.nome || c.nome.trim() === '') {
                    erros.push({ linha: i + 1, motivo: 'Nome do cliente é obrigatório', dados: c });
                    continue;
                }

                // Normaliza documento
                let documento = c.documento;
                if (documento) {
                    documento = String(documento).replace(/[^\d]/g, '');
                }

                // Normaliza WhatsApp
                let whatsapp = c.whatsapp;
                if (whatsapp) {
                    whatsapp = String(whatsapp).replace(/[^\d+]/g, '');
                    if (!whatsapp.startsWith('+')) {
                        whatsapp = '+55' + whatsapp.replace(/^55/, '');
                    }
                }

                // Prepara dados para inserção
                const data_aniversario = c.data_aniversario || c.dataAniversario || null;

                const clienteData = {
                    user_id: userId,
                    nome: c.nome.trim(),
                    documento: documento || null,
                    whatsapp: whatsapp || null,
                    email: c.email || null,
                    logradouro: c.logradouro || null,
                    numero: c.numero ? String(c.numero) : null,
                    complemento: c.complemento || null,
                    bairro: c.bairro || null,
                    cep: c.cep ? String(c.cep).replace(/[^\d]/g, '') : null,
                    uf: c.uf || null,
                    cidade: c.cidade || null,
                    localizacao: c.localizacao || null,
                    status: validarStatus(c.status) || 'Lead',
                    data_aniversario: data_aniversario || null,
                    lembrete_aniversario: !!data_aniversario,
                    created_at: new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('customers')
                    .insert([clienteData])
                    .select()
                    .single();

                if (error) {
                    erros.push({ linha: i + 1, motivo: error.message, dados: c });
                    continue;
                }

                importados++;
                resultados.push(data);

                // Registra interação de importação
                try {
                    await supabase
                        .from('interactions')
                        .insert([{
                            user_id: userId,
                            customer_id: data.id,
                            tipo: 'sistema',
                            observacao: 'Cliente importado em lote',
                            metadata_ia: { importacao: true, origem: 'importacao_arquivo' }
                        }]);
                } catch (logErr) {
                    console.warn(`[import] Erro ao registrar interação do cliente ${data.id}:`, logErr.message);
                }

            } catch (err) {
                erros.push({ linha: i + 1, motivo: err.message, dados: c });
            }
        }

        console.log(`[import] Importação concluída: ${importados} importados, ${erros.length} erros`);

        res.json({
            success: true,
            message: `${importados} cliente(s) importado(s) com sucesso!`,
            data: {
                importados,
                erros: erros.length,
                detalhesErros: erros.slice(0, 20) // Limita detalhes dos erros
            }
        });

    } catch (error) {
        console.error('[import] Erro ao confirmar importação:', error);
        res.status(500).json({
            success: false,
            message: `Erro ao importar clientes: ${error.message}`
        });
    }
});

/**
 * Valida status do cliente
 */
function validarStatus(status) {
    if (!status) return null;
    const statusValidos = ['Lead', 'Prospect', 'Cliente', 'Inativo'];
    const statusNormalizado = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    return statusValidos.includes(statusNormalizado) ? statusNormalizado : null;
}

/**
 * Tratamento de erro do multer
 */
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Arquivo muito grande. Limite máximo: 10MB.'
            });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
});

module.exports = router;
