-- Script para deletar usuário e todos os seus dados
-- Execute este script no SQL Editor do Supabase

-- 1. Deletar pedidos do usuário
DELETE FROM public.orders WHERE user_id = 'cf67ff37-1c63-4ba4-807a-4aedaebd8560';

-- 2. Deletar produtos do usuário
DELETE FROM public.products WHERE user_id = 'cf67ff37-1c63-4ba4-807a-4aedaebd8560';

-- 3. Deletar culturas do usuário
DELETE FROM public.crops WHERE user_id = 'cf67ff37-1c63-4ba4-807a-4aedaebd8560';

-- 4. Deletar clientes do usuário
DELETE FROM public.customers WHERE user_id = 'cf67ff37-1c63-4ba4-807a-4aedaebd8560';

-- 5. Deletar tarefas do usuário
DELETE FROM public.tasks WHERE user_id = 'cf67ff37-1c63-4ba4-807a-4aedaebd8560';

-- 6. Deletar interações do usuário
DELETE FROM public.interactions WHERE user_id = 'cf67ff37-1c63-4ba4-807a-4aedaebd8560';

-- 7. Agora deletar o usuário
SELECT auth.admin.delete_user('cf67ff37-1c63-4ba4-807a-4aedaebd8560');