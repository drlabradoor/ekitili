-- =====================================================
-- Быстрая очистка таблиц через TRUNCATE
-- ВНИМАНИЕ: TRUNCATE нельзя откатить (ROLLBACK не работает)!
-- =====================================================

-- TRUNCATE быстрее чем DELETE, но нельзя откатить
-- Используйте только если точно уверены!

-- Откатить незавершенные транзакции
ROLLBACK;

-- Очистить таблицу результатов тестов (дочерняя таблица)
TRUNCATE TABLE TEST_RESULTS;

-- Очистить таблицу пользователей (родительская таблица)
TRUNCATE TABLE USER_ACCOUNTS;

-- Сбросить последовательности
ALTER SEQUENCE USER_ID_SEQ RESTART START WITH 1;
ALTER SEQUENCE TEST_RESULT_ID_SEQ RESTART START WITH 1;

-- Проверка
SELECT 'USER_ACCOUNTS: ' || COUNT(*) AS user_count FROM USER_ACCOUNTS;
SELECT 'TEST_RESULTS: ' || COUNT(*) AS test_count FROM TEST_RESULTS;

