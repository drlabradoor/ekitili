-- =====================================================
-- EkiTili: плейсхолдеры для лидерборда
-- Создаёт несколько демо-пользователей и их результаты тестов,
-- чтобы лидерборд не выглядел пустым на свежей базе.
-- Идемпотентный: ON CONFLICT DO NOTHING + не дублирует test_results.
-- Запуск: psql ... -f database/seed_leaderboard.sql
--      или: node scripts/seed_leaderboard.js
-- =====================================================

-- Пароль для всех плейсхолдеров — никто не сможет войти, потому что хэш
-- невалидный (просто строка-маркер). Эти юзеры существуют только для лидерборда.
INSERT INTO user_accounts (username, password_hash, registration_date) VALUES
    ('aibek_qz',       '__placeholder__', NOW() - INTERVAL '60 days'),
    ('madina.s',       '__placeholder__', NOW() - INTERVAL '55 days'),
    ('nurlan_batyr',   '__placeholder__', NOW() - INTERVAL '50 days'),
    ('saya_kz',        '__placeholder__', NOW() - INTERVAL '45 days'),
    ('temirlan99',     '__placeholder__', NOW() - INTERVAL '40 days'),
    ('aruzhan_ai',     '__placeholder__', NOW() - INTERVAL '35 days'),
    ('daniyar.steppe', '__placeholder__', NOW() - INTERVAL '30 days'),
    ('zhanar_ok',      '__placeholder__', NOW() - INTERVAL '25 days')
ON CONFLICT (username) DO NOTHING;

-- Результаты тестов с разбросом по последним 30 дням.
-- Чтобы апдейтить лидерборд недели/месяца, нужны test_date в нужных окнах.
-- Идемпотентность: вычищаем старые placeholder-результаты для тех же юзеров
-- и записываем заново — это безопасно, потому что плейсхолдеры не пишут реальные тесты.
DELETE FROM test_results
WHERE user_id IN (
    SELECT user_id FROM user_accounts WHERE password_hash = '__placeholder__'
);

INSERT INTO test_results (user_id, score, total_questions, test_date)
SELECT u.user_id, t.score, t.total, NOW() - make_interval(days => t.days_ago)
FROM user_accounts u
CROSS JOIN LATERAL (VALUES
    -- (username, score, total, days_ago)
    ('aibek_qz',        85,  10, 1),
    ('aibek_qz',        72,  10, 5),
    ('aibek_qz',        66,  10, 12),
    ('madina.s',        78,  10, 2),
    ('madina.s',        90,  10, 6),
    ('madina.s',        45,  10, 14),
    ('nurlan_batyr',    62,  10, 3),
    ('nurlan_batyr',    55,  10, 7),
    ('nurlan_batyr',    40,  10, 20),
    ('saya_kz',         50,  10, 2),
    ('saya_kz',         48,  10, 9),
    ('temirlan99',      45,  10, 4),
    ('temirlan99',      55,  10, 10),
    ('aruzhan_ai',      35,  10, 6),
    ('aruzhan_ai',      30,  10, 13),
    ('daniyar.steppe',  28,  10, 8),
    ('zhanar_ok',       22,  10, 11)
) AS t(username, score, total, days_ago)
WHERE u.username = t.username;

-- Сводка — посмотреть, что получилось
SELECT u.username,
       COALESCE(SUM(t.score), 0) AS week_points,
       COUNT(t.result_id) AS tests
FROM user_accounts u
LEFT JOIN test_results t ON u.user_id = t.user_id
    AND t.test_date >= NOW() - INTERVAL '7 days'
WHERE u.password_hash = '__placeholder__'
GROUP BY u.username
ORDER BY week_points DESC;
