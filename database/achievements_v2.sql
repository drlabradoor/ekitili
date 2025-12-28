-- Таблица определений достижений
CREATE TABLE ACHIEVEMENTS_DEF (
    ID          VARCHAR2(50) PRIMARY KEY,
    TITLE       VARCHAR2(100) NOT NULL,
    DESCRIPTION VARCHAR2(500),
    ICON        VARCHAR2(10),
    TARGET      NUMBER DEFAULT 1 -- Целевое значение для прогресса (например, 1 тест, 10 побед)
)
/

-- Таблица прогресса пользователей
CREATE TABLE USER_ACHIEVEMENTS (
    USER_ID        NUMBER(10, 0),
    ACHIEVEMENT_ID VARCHAR2(50),
    AWARDED_DATE   DATE,          -- Дата получения (NULL если еще в процессе)
    PROGRESS       NUMBER DEFAULT 0, -- Текущий прогресс
    CONSTRAINT FK_UA_USER FOREIGN KEY (USER_ID) REFERENCES USER_ACCOUNTS(USER_ID),
    CONSTRAINT FK_UA_ACH FOREIGN KEY (ACHIEVEMENT_ID) REFERENCES ACHIEVEMENTS_DEF(ID),
    PRIMARY KEY (USER_ID, ACHIEVEMENT_ID)
)
/

-- Заполнение базовыми достижениями
INSERT INTO ACHIEVEMENTS_DEF (ID, TITLE, DESCRIPTION, ICON, TARGET)
VALUES ('polyglot', 'Полиглот', 'Пройти тест на определение уровня знания языка', '🎓', 1)
/

INSERT INTO ACHIEVEMENTS_DEF (ID, TITLE, DESCRIPTION, ICON, TARGET)
VALUES ('memory_master', 'Мастер Памяти', 'Победить в игре Memory 4x4', '🧠', 1)
/

COMMIT
/
