-- ============================================
-- CORREÇÃO: Status constraint do customers
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Primeiro, atualizar clientes com status inválido para Lead
UPDATE public.customers 
SET status = 'Lead' 
WHERE status IN ('Prospect', 'Cliente', 'Inativo');

-- Remover constraint antiga
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_status_check;

-- Adicionar constraint com valores válidos do formulário
ALTER TABLE public.customers ADD CONSTRAINT customers_status_check CHECK (
    status IN (
        'Lead',
        'Indicação', 
        'Listagem',
        'Contato Telefônico',
        'Cliente de outro vendedor',
        'Disparo'
    )
);