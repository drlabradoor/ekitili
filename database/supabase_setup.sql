-- =====================================================
-- EkiTili: PostgreSQL / Supabase schema
-- Идемпотентный setup: можно прогонять повторно.
-- =====================================================

-- Учётные записи пользователей + JSON-блоб достижений и стрика
CREATE TABLE IF NOT EXISTS user_accounts (
    user_id           BIGSERIAL PRIMARY KEY,
    username          VARCHAR(100) NOT NULL UNIQUE,
    password_hash     VARCHAR(256) NOT NULL,
    registration_date TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    achievements      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    streak            JSONB        NOT NULL DEFAULT '{}'::jsonb
);

-- Для существующих БД: идемпотентно добавляем колонку streak
ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS streak JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Результаты тестов (для лидерборда и статистики)
CREATE TABLE IF NOT EXISTS test_results (
    result_id       BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES user_accounts(user_id) ON DELETE CASCADE,
    score           INTEGER     NOT NULL,
    total_questions INTEGER     NOT NULL,
    test_date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_user_date
    ON test_results(user_id, test_date DESC);

CREATE INDEX IF NOT EXISTS idx_test_results_date
    ON test_results(test_date DESC);

-- Справочник достижений (для будущей нормализованной версии)
CREATE TABLE IF NOT EXISTS achievements_def (
    id          VARCHAR(50)  PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    icon        VARCHAR(10),
    target      INTEGER      NOT NULL DEFAULT 1
);

-- Нормализованный прогресс пользователей (пока не используется сервером,
-- но таблица заведена на будущее — сервер работает с jsonb-блобом в user_accounts.achievements)
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id        BIGINT      NOT NULL REFERENCES user_accounts(user_id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL REFERENCES achievements_def(id),
    awarded_date   TIMESTAMPTZ,
    progress       INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, achievement_id)
);

-- Базовый набор достижений
INSERT INTO achievements_def (id, title, description, icon, target) VALUES
    ('polyglot',      'Полиглот',     'Пройти тест на определение уровня знания языка', '🎓', 1),
    ('memory_master', 'Мастер Памяти', 'Победить в игре Memory 4x4',                      '🧠', 1),
    ('streak_3',      'В ритме',       'Стрик 3 дня подряд',                              '🔥', 3),
    ('streak_7',      'Неделя силы',   'Стрик 7 дней подряд',                             '🔥', 7),
    ('streak_30',     'Месяц силы',    'Стрик 30 дней подряд',                            '🔥', 30)
ON CONFLICT (id) DO NOTHING;
