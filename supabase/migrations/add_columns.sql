-- Adicionar novas colunas na tabela customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cep TEXT;

-- Remover colunas antigas se existirem
ALTER TABLE public.customers DROP COLUMN IF EXISTS endereco;