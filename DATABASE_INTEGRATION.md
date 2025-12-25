# Взаимодействие приложения EkiTili с базой данных Oracle

## Архитектура системы

Приложение использует трёхуровневую архитектуру:

1. **Frontend (Браузер)** — интерфейс пользователя (HTML/CSS/JavaScript)
2. **Backend API (Node.js)** — сервер на Express, обрабатывает запросы и взаимодействует с БД
3. **Oracle Database** — хранит данные пользователей

## Поток данных

### Регистрация пользователя

1. Пользователь вводит логин и пароль в форме регистрации.
2. **Frontend** (`src/services/auth.js`):
   - Пароль хешируется на клиенте (SHA-256) через Web Crypto API
   - Отправляется POST-запрос на `http://localhost:3000/api/register` с `username` и `password_hash`
3. **Backend** (`server.js`):
   - Получает запрос, проверяет наличие Oracle Client
   - Открывает соединение с Oracle через `oracledb.getConnection()`
   - Вызывает хранимую процедуру `REGISTER_USER(:username, :password_hash)`
4. **Oracle Database**:
   - Процедура `REGISTER_USER` выполняет `INSERT INTO USER_ACCOUNTS`
   - Триггер `INS_USER_ID_AUTO` автоматически присваивает `USER_ID` из последовательности `USER_ID_SEQ`
   - Транзакция фиксируется (`COMMIT`)
5. **Backend**:
   - Получает `USER_ID` созданного пользователя через `SELECT`
   - Возвращает JSON: `{ user_id, username }`
6. **Frontend**:
   - Сохраняет данные в `localStorage` (userId, username)
   - Обновляет интерфейс

### Вход пользователя

1. Пользователь вводит логин и пароль.
2. **Frontend**:
   - Хеширует пароль (SHA-256)
   - Отправляет POST на `http://localhost:3000/api/login`
3. **Backend**:
   - Открывает соединение с Oracle
   - Вызывает функцию `AUTHENTICATE_USER(:username, :password_hash)` через `SELECT AUTHENTICATE_USER(...) FROM DUAL`
4. **Oracle Database**:
   - Функция ищет пользователя по `USERNAME` и `PASSWORD_HASH`
   - При успехе возвращает `USER_ID`, иначе `NULL`
5. **Backend**:
   - Если `USER_ID` получен — возвращает `{ user_id, username }`
   - Иначе — ошибка 401
6. **Frontend**:
   - Сохраняет данные в `localStorage`
   - Обновляет интерфейс

## Структура базы данных

### Таблица `USER_ACCOUNTS`

```sql
CREATE TABLE USER_ACCOUNTS (
    USER_ID             NUMBER(10, 0) PRIMARY KEY,
    USERNAME            VARCHAR2(100) NOT NULL UNIQUE,
    PASSWORD_HASH       VARCHAR2(256) NOT NULL,
    REGISTRATION_DATE   DATE DEFAULT SYSDATE
)
```

- `USER_ID` — первичный ключ, генерируется автоматически
- `USERNAME` — уникальный логин
- `PASSWORD_HASH` — хеш пароля (SHA-256)
- `REGISTRATION_DATE` — дата регистрации

### Последовательность `USER_ID_SEQ`

Автоматически генерирует уникальные ID для новых пользователей.

### Триггер `INS_USER_ID_AUTO`

Срабатывает перед вставкой новой записи и присваивает `USER_ID` из последовательности.

### Хранимая процедура `REGISTER_USER`

```sql
CREATE OR REPLACE PROCEDURE REGISTER_USER (
    p_username IN USER_ACCOUNTS.USERNAME%TYPE,
    p_password_hash IN USER_ACCOUNTS.PASSWORD_HASH%TYPE
)
```

Выполняет `INSERT` в `USER_ACCOUNTS` и фиксирует транзакцию.

### Функция `AUTHENTICATE_USER`

```sql
CREATE OR REPLACE FUNCTION AUTHENTICATE_USER (
    p_username IN USER_ACCOUNTS.USERNAME%TYPE,
    p_password_hash IN USER_ACCOUNTS.PASSWORD_HASH%TYPE
) RETURN NUMBER
```

Проверяет учетные данные и возвращает `USER_ID` при успехе, иначе `NULL`.

## Безопасность

1. **Хеширование паролей**:
   - Пароли не хранятся в открытом виде
   - Используется SHA-256 (для продакшена рекомендуется bcrypt/argon2)
   - Хеширование выполняется на клиенте перед отправкой

2. **Параметризованные запросы**:
   - Используются bind-переменные (`:username`, `:password_hash`)
   - Защита от SQL-инъекций

3. **Обработка ошибок**:
   - Ошибки базы данных не раскрывают детали клиенту
   - Уникальные ошибки (ORA-00001) обрабатываются отдельно

## Технические детали подключения

### Конфигурация подключения (`server.js`)

```javascript
const dbConfig = {
    user: process.env.ORACLE_USER || 'SYSTEM',
    password: process.env.ORACLE_PASSWORD || 'system228',
    connectString: process.env.ORACLE_CONNECTION_STRING || 'localhost:1521/XE'
};
```

Можно задать через переменные окружения или изменить в коде.

### Управление соединениями

- Соединение открывается для каждого запроса
- После выполнения соединение закрывается (`connection.close()`)
- При ошибках выполняется `rollback()`

### Инициализация Oracle Client

При запуске сервера:
1. Проверяется наличие Oracle Instant Client
2. Выполняется `oracledb.initOracleClient()`
3. Тестируется подключение к базе данных

## Примеры запросов

### Регистрация (Backend → Oracle)

```javascript
await connection.execute(
    `BEGIN REGISTER_USER(:username, :password_hash); END;`,
    { username: username, password_hash: password_hash }
);
```

### Вход (Backend → Oracle)

```javascript
const result = await connection.execute(
    `SELECT AUTHENTICATE_USER(:username, :password_hash) as user_id FROM DUAL`,
    { username: username, password_hash: password_hash }
);
```

## Установка и настройка

1. Установить Oracle Database (XE или другая версия)
2. Выполнить SQL-скрипт `database/oracle_setup.sql` для создания объектов
3. Установить Oracle Instant Client для Node.js
4. Настроить параметры подключения в `server.js` или через переменные окружения
5. Запустить backend-сервер (`node server.js`)

## Резюме

Приложение использует стандартный подход: клиент хеширует пароль, отправляет данные на API, сервер вызывает хранимые процедуры/функции Oracle, база данных обрабатывает запросы и возвращает результат. Безопасность обеспечивается хешированием паролей, параметризованными запросами и обработкой ошибок.

