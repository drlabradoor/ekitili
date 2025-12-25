-- =====================================================
-- Тестовый скрипт для проверки работы системы
-- Выполните этот скрипт после oracle_setup.sql
-- =====================================================

SET SERVEROUTPUT ON;

-- Тест 1: Регистрация пользователя
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 1: Регистрация пользователя ===');
    REGISTER_USER('test_user_1', 'hash123456789');
    DBMS_OUTPUT.PUT_LINE('✓ Пользователь test_user_1 зарегистрирован');
END;
/

-- Тест 2: Проверка регистрации
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 2: Проверка данных пользователя ===');
    FOR rec IN (SELECT USER_ID, USERNAME, REGISTRATION_DATE 
                FROM USER_ACCOUNTS 
                WHERE USERNAME = 'test_user_1') LOOP
        DBMS_OUTPUT.PUT_LINE('✓ Найден пользователь:');
        DBMS_OUTPUT.PUT_LINE('  ID: ' || rec.USER_ID);
        DBMS_OUTPUT.PUT_LINE('  Имя: ' || rec.USERNAME);
        DBMS_OUTPUT.PUT_LINE('  Дата регистрации: ' || TO_CHAR(rec.REGISTRATION_DATE, 'DD.MM.YYYY HH24:MI:SS'));
    END LOOP;
END;
/

-- Тест 3: Успешная аутентификация
DECLARE
    v_user_id NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 3: Успешная аутентификация ===');
    v_user_id := AUTHENTICATE_USER('test_user_1', 'hash123456789');
    IF v_user_id IS NOT NULL THEN
        DBMS_OUTPUT.PUT_LINE('✓ Вход успешен! USER_ID = ' || v_user_id);
    ELSE
        DBMS_OUTPUT.PUT_LINE('✗ Ошибка: Вход не удался');
    END IF;
END;
/

-- Тест 4: Неудачная аутентификация (неверный пароль)
DECLARE
    v_user_id NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 4: Неудачная аутентификация (неверный пароль) ===');
    v_user_id := AUTHENTICATE_USER('test_user_1', 'wrong_password');
    IF v_user_id IS NULL THEN
        DBMS_OUTPUT.PUT_LINE('✓ Корректно отклонен неверный пароль');
    ELSE
        DBMS_OUTPUT.PUT_LINE('✗ Ошибка: Неверный пароль был принят!');
    END IF;
END;
/

-- Тест 5: Неудачная аутентификация (несуществующий пользователь)
DECLARE
    v_user_id NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 5: Неудачная аутентификация (несуществующий пользователь) ===');
    v_user_id := AUTHENTICATE_USER('non_existent_user', 'any_password');
    IF v_user_id IS NULL THEN
        DBMS_OUTPUT.PUT_LINE('✓ Корректно отклонен несуществующий пользователь');
    ELSE
        DBMS_OUTPUT.PUT_LINE('✗ Ошибка: Несуществующий пользователь был принят!');
    END IF;
END;
/

-- Тест 6: Регистрация второго пользователя
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 6: Регистрация второго пользователя ===');
    REGISTER_USER('test_user_2', 'hash987654321');
    DBMS_OUTPUT.PUT_LINE('✓ Пользователь test_user_2 зарегистрирован');
END;
/

-- Тест 7: Проверка уникальности USERNAME
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ТЕСТ 7: Проверка уникальности USERNAME ===');
    BEGIN
        REGISTER_USER('test_user_1', 'another_hash');
        DBMS_OUTPUT.PUT_LINE('✗ Ошибка: Дубликат USERNAME был принят!');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('✓ Корректно отклонен дубликат USERNAME');
    END;
END;
/

-- Итоговая статистика
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== ИТОГОВАЯ СТАТИСТИКА ===');
    DBMS_OUTPUT.PUT_LINE('Всего зарегистрировано пользователей: ' || 
        (SELECT COUNT(*) FROM USER_ACCOUNTS));
END;
/

-- Показать всех пользователей
SELECT USER_ID, USERNAME, TO_CHAR(REGISTRATION_DATE, 'DD.MM.YYYY HH24:MI') AS REG_DATE
FROM USER_ACCOUNTS
ORDER BY USER_ID;

