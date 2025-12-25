-- =====================================================
-- EkiTili: Базовая система регистрации и аутентификации
-- СУБД: Oracle Database
-- =====================================================

-- Часть 1. Создание базовых объектов (Таблица и Последовательность)
-- =====================================================

-- 1. Создание таблицы для хранения учетных данных пользователей
-- Используем VARCHAR2 для строковых данных и NUMBER для ID [1], [2]

CREATE TABLE USER_ACCOUNTS (
    USER_ID             NUMBER(10, 0) PRIMARY KEY, -- Первичный ключ [1]
    USERNAME            VARCHAR2(100) NOT NULL UNIQUE, -- Логин должен быть уникальным
    PASSWORD_HASH       VARCHAR2(256) NOT NULL, -- Здесь хранится хеш пароля
    REGISTRATION_DATE   DATE DEFAULT SYSDATE -- Дата регистрации (используем функцию SYSDATE) [3], [4]
)
/

-- 2. Создание последовательности для автоматической генерации уникальных ID
-- Последовательность (SEQUENCE) используется для первичных ключей [5], [6]

CREATE SEQUENCE USER_ID_SEQ
    INCREMENT BY 1        -- Шаг 1 [7]
    START WITH 1          -- Начинаем с 1 [7]
    NOMAXVALUE            -- Без ограничения максимального значения [7]
    NOCYCLE
    CACHE 20              -- Кэширование для ускорения [8]
/

-- Часть 2. Создание триггера для автоматической регистрации
-- =====================================================

-- 3. Создание триггера (TRIGGER) для автоматического присвоения USER_ID
-- Триггеры неявно исполняются при модификации таблицы [9]
-- Тип: BEFORE INSERT (до вставки) [10]
-- FOR EACH ROW (триггер строки) [11]
-- Используем NEXTVAL для получения следующего значения последовательности [12]

CREATE OR REPLACE TRIGGER INS_USER_ID_AUTO
BEFORE INSERT ON USER_ACCOUNTS
FOR EACH ROW
BEGIN
    -- Вставляем следующее значение последовательности в новое поле :NEW.USER_ID
    SELECT USER_ID_SEQ.NEXTVAL INTO :NEW.USER_ID FROM DUAL;
END;
/

-- 4. Функция для регистрации (добавления нового пользователя)
-- Для регистрации используем INSERT [13]. Так как триггер автоматически присваивает ID, нам нужны только логин и хеш.
-- Примечание: предполагается, что веб-приложение передает пароль уже в виде хеша.

CREATE OR REPLACE PROCEDURE REGISTER_USER (
    p_username IN USER_ACCOUNTS.USERNAME%TYPE,
    p_password_hash IN USER_ACCOUNTS.PASSWORD_HASH%TYPE
)
IS
    -- Можно добавить объявление локальных переменных, если нужна обработка ошибок [14]
BEGIN
    INSERT INTO USER_ACCOUNTS (USERNAME, PASSWORD_HASH)
    VALUES (p_username, p_password_hash);

    COMMIT; -- Фиксация транзакции [15], [16].
END;
/

-- Часть 3. Логика аутентификации (Вход)
-- =====================================================

-- 5. Создание функции (FUNCTION) для проверки учетных данных (входа)
-- Функция вычисляет значение (например, возвращает ID пользователя, если вход успешен) [17], [18]
-- Используем неявный курсор (SELECT INTO) [19]

CREATE OR REPLACE FUNCTION AUTHENTICATE_USER (
    p_username IN USER_ACCOUNTS.USERNAME%TYPE,
    p_password_hash IN USER_ACCOUNTS.PASSWORD_HASH%TYPE -- Принимаем хеш для сравнения
)
RETURN NUMBER  -- Функция возвращает USER_ID (число)
IS
    v_user_id USER_ACCOUNTS.USER_ID%TYPE;
BEGIN
    -- Поиск пользователя с заданными логином и хешем пароля
    SELECT USER_ID
    INTO v_user_id
    FROM USER_ACCOUNTS
    WHERE USERNAME = p_username
    AND PASSWORD_HASH = p_password_hash;

    -- Если строка найдена, возвращаем ID [19]
    RETURN v_user_id;

EXCEPTION
    -- Если SELECT не нашел строку (нет такого пользователя/пароля)
    WHEN NO_DATA_FOUND THEN
        RETURN NULL; -- Возвращаем NULL, что сигнализирует о неудачной аутентификации
    WHEN OTHERS THEN
        -- Обработка других возможных ошибок
        RETURN NULL;
END;
/

-- 6. Предоставление привилегий (если веб-приложение подключается под другим пользователем)
-- Предоставление права на выполнение функции [20]

GRANT EXECUTE ON AUTHENTICATE_USER TO PUBLIC;
GRANT EXECUTE ON REGISTER_USER TO PUBLIC;

-- =====================================================
-- Проверка создания объектов
-- =====================================================

-- Проверка таблицы
SELECT table_name FROM user_tables WHERE table_name = 'USER_ACCOUNTS';

-- Проверка последовательности
SELECT sequence_name FROM user_sequences WHERE sequence_name = 'USER_ID_SEQ';

-- Проверка триггера
SELECT trigger_name FROM user_triggers WHERE trigger_name = 'INS_USER_ID_AUTO';

-- Проверка процедуры
SELECT object_name FROM user_procedures WHERE object_name = 'REGISTER_USER';

-- Проверка функции
SELECT object_name FROM user_procedures WHERE object_name = 'AUTHENTICATE_USER';

