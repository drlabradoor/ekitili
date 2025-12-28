-- =====================================================
-- EkiTili: Таблица для хранения результатов тестов и лидерборда
-- =====================================================

-- Создание таблицы для результатов тестов
CREATE TABLE TEST_RESULTS (
    RESULT_ID          NUMBER(10, 0) PRIMARY KEY,
    USER_ID            NUMBER(10, 0) NOT NULL,
    SCORE              NUMBER(10, 0) NOT NULL, -- Количество правильных ответов
    TOTAL_QUESTIONS    NUMBER(10, 0) NOT NULL, -- Всего вопросов
    TEST_DATE          DATE DEFAULT SYSDATE,
    CONSTRAINT FK_TEST_USER FOREIGN KEY (USER_ID) REFERENCES USER_ACCOUNTS(USER_ID)
)
/

-- Создание последовательности для RESULT_ID
CREATE SEQUENCE TEST_RESULT_ID_SEQ
    INCREMENT BY 1
    START WITH 1
    NOMAXVALUE
    NOCYCLE
    CACHE 20
/

-- Триггер для автоматического присвоения RESULT_ID
CREATE OR REPLACE TRIGGER INS_TEST_RESULT_ID_AUTO
BEFORE INSERT ON TEST_RESULTS
FOR EACH ROW
BEGIN
    SELECT TEST_RESULT_ID_SEQ.NEXTVAL INTO :NEW.RESULT_ID FROM DUAL;
END;
/

-- Индекс для быстрого поиска по USER_ID и дате
CREATE INDEX IDX_TEST_RESULTS_USER_DATE ON TEST_RESULTS(USER_ID, TEST_DATE DESC)
/

-- Функция для сохранения результата теста
CREATE OR REPLACE PROCEDURE SAVE_TEST_RESULT (
    p_user_id IN TEST_RESULTS.USER_ID%TYPE,
    p_score IN TEST_RESULTS.SCORE%TYPE,
    p_total_questions IN TEST_RESULTS.TOTAL_QUESTIONS%TYPE
)
IS
BEGIN
    INSERT INTO TEST_RESULTS (USER_ID, SCORE, TOTAL_QUESTIONS)
    VALUES (p_user_id, p_score, p_total_questions);
    
    COMMIT;
END;
/

-- Функция для получения лидерборда за неделю
CREATE OR REPLACE FUNCTION GET_LEADERBOARD_WEEK
RETURN SYS_REFCURSOR
IS
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR
        SELECT 
            u.USERNAME as name,
            SUM(t.SCORE) as points
        FROM USER_ACCOUNTS u
        INNER JOIN TEST_RESULTS t ON u.USER_ID = t.USER_ID
        WHERE t.TEST_DATE >= SYSDATE - 7
        GROUP BY u.USER_ID, u.USERNAME
        ORDER BY points DESC
        FETCH FIRST 10 ROWS ONLY;
    
    RETURN v_cursor;
END;
/

-- Функция для получения лидерборда за месяц
CREATE OR REPLACE FUNCTION GET_LEADERBOARD_MONTH
RETURN SYS_REFCURSOR
IS
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR
        SELECT 
            u.USERNAME as name,
            SUM(t.SCORE) as points
        FROM USER_ACCOUNTS u
        INNER JOIN TEST_RESULTS t ON u.USER_ID = t.USER_ID
        WHERE t.TEST_DATE >= SYSDATE - 30
        GROUP BY u.USER_ID, u.USERNAME
        ORDER BY points DESC
        FETCH FIRST 10 ROWS ONLY;
    
    RETURN v_cursor;
END;
/

-- Функция для получения места пользователя в лидерборде за месяц
CREATE OR REPLACE FUNCTION GET_USER_LEADERBOARD_PLACE (
    p_user_id IN USER_ACCOUNTS.USER_ID%TYPE
)
RETURN NUMBER
IS
    v_place NUMBER;
    v_user_points NUMBER;
BEGIN
    -- Получаем очки пользователя за месяц
    SELECT NVL(SUM(SCORE), 0)
    INTO v_user_points
    FROM TEST_RESULTS
    WHERE USER_ID = p_user_id
    AND TEST_DATE >= SYSDATE - 30;
    
    -- Считаем место пользователя
    SELECT COUNT(*) + 1
    INTO v_place
    FROM (
        SELECT USER_ID, SUM(SCORE) as total_points
        FROM TEST_RESULTS
        WHERE TEST_DATE >= SYSDATE - 30
        GROUP BY USER_ID
        HAVING SUM(SCORE) > v_user_points
    );
    
    RETURN v_place;
END;
/

-- Предоставление привилегий
GRANT EXECUTE ON SAVE_TEST_RESULT TO PUBLIC;
GRANT EXECUTE ON GET_LEADERBOARD_WEEK TO PUBLIC;
GRANT EXECUTE ON GET_LEADERBOARD_MONTH TO PUBLIC;
GRANT EXECUTE ON GET_USER_LEADERBOARD_PLACE TO PUBLIC;

