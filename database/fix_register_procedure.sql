-- =====================================================
-- Исправление процедуры REGISTER_USER
-- Убираем COMMIT из процедуры (коммит делается в Node.js)
-- =====================================================

CREATE OR REPLACE PROCEDURE REGISTER_USER (
    p_username IN USER_ACCOUNTS.USERNAME%TYPE,
    p_password_hash IN USER_ACCOUNTS.PASSWORD_HASH%TYPE
)
IS
BEGIN
    INSERT INTO USER_ACCOUNTS (USERNAME, PASSWORD_HASH)
    VALUES (p_username, p_password_hash);
    
    -- НЕ делаем COMMIT здесь - коммит делается в Node.js коде
    -- Это позволяет избежать проблем с блокировками
END;
/

-- Проверка что процедура создана
SELECT object_name, object_type, status 
FROM user_procedures 
WHERE object_name = 'REGISTER_USER';

