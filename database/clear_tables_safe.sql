-- =====================================================
-- Безопасная очистка с проверками
-- Рекомендуемый способ для регулярного использования
-- =====================================================

-- 1. Проверяем текущее состояние
SELECT 'Пользователей: ' || COUNT(*) AS info FROM USER_ACCOUNTS;
SELECT 'Результатов тестов: ' || COUNT(*) AS info FROM TEST_RESULTS;

-- 2. Откатываем все незавершенные транзакции
ROLLBACK;

-- 3. Удаляем результаты тестов (сначала дочерняя таблица)
DELETE FROM TEST_RESULTS;
COMMIT;

-- 4. Удаляем пользователей (родительская таблица)
DELETE FROM USER_ACCOUNTS;
COMMIT;

-- 5. Сбрасываем последовательности (опционально, но рекомендуется)
ALTER SEQUENCE USER_ID_SEQ RESTART START WITH 1;
ALTER SEQUENCE TEST_RESULT_ID_SEQ RESTART START WITH 1;

-- 6. Финальная проверка
SELECT 'После очистки - Пользователей: ' || COUNT(*) AS result FROM USER_ACCOUNTS;
SELECT 'После очистки - Результатов: ' || COUNT(*) AS result FROM TEST_RESULTS;

-- Готово!

