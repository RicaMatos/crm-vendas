-- Função para deletar usuário do Auth mas manter os dados no sistema
-- Execute no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION public.soft_delete_user(user_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT u.id INTO user_record
    FROM auth.users u
    WHERE u.email = LOWER(user_email);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;

    IF LOWER(user_email) = 'admin@crm.com' THEN
        RAISE EXCEPTION 'Não é possível deletar o administrador principal';
    END IF;

    PERFORM auth.admin.delete_user(user_record.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_user(TEXT) TO authenticated;

-- Deletar o usuário suellen
SELECT public.soft_delete_user('suellenbernardinomatos@gmail.com');
GRANT EXECUTE ON FUNCTION public.soft_delete_user(TEXT) TO service_role;