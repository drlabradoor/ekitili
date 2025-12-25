# База данных Oracle для EkiTili

## Описание

Этот модуль содержит SQL скрипты для создания системы регистрации и аутентификации пользователей в Oracle Database.

## Структура

- `oracle_setup.sql` - Основной скрипт создания объектов базы данных

## Установка

1. Подключитесь к Oracle Database с правами администратора
2. Выполните скрипт `oracle_setup.sql`:
   ```sql
   @oracle_setup.sql
   ```
   или
   ```sql
   START oracle_setup.sql
   ```

## Созданные объекты

### Таблица
- **USER_ACCOUNTS** - Хранит учетные данные пользователей
  - `USER_ID` (NUMBER) - Первичный ключ
  - `USERNAME` (VARCHAR2) - Уникальный логин
  - `PASSWORD_HASH` (VARCHAR2) - Хеш пароля
  - `REGISTRATION_DATE` (DATE) - Дата регистрации

### Последовательность
- **USER_ID_SEQ** - Автоматическая генерация ID пользователей

### Триггер
- **INS_USER_ID_AUTO** - Автоматически присваивает USER_ID при вставке новой записи

### Процедура
- **REGISTER_USER** - Регистрация нового пользователя
  ```sql
  EXEC REGISTER_USER('username', 'password_hash');
  ```

### Функция
- **AUTHENTICATE_USER** - Аутентификация пользователя
  ```sql
  SELECT AUTHENTICATE_USER('username', 'password_hash') FROM DUAL;
  -- Возвращает USER_ID при успешной аутентификации, NULL при ошибке
  ```

## Примеры использования

### Регистрация нового пользователя
```sql
BEGIN
    REGISTER_USER('alexey_kz', 'abc123def456...');
END;
/
```

### Аутентификация пользователя
```sql
DECLARE
    v_user_id NUMBER;
BEGIN
    v_user_id := AUTHENTICATE_USER('alexey_kz', 'abc123def456...');
    IF v_user_id IS NOT NULL THEN
        DBMS_OUTPUT.PUT_LINE('Вход успешен! USER_ID: ' || v_user_id);
    ELSE
        DBMS_OUTPUT.PUT_LINE('Ошибка входа: неверный логин или пароль');
    END IF;
END;
/
```

## Безопасность

⚠️ **Важно:** 
- Пароли должны хешироваться на стороне приложения перед передачей в базу данных
- Рекомендуется использовать алгоритмы хеширования: SHA-256, bcrypt, Argon2
- Никогда не храните пароли в открытом виде

## Примечания

- Все объекты создаются в схеме текущего пользователя
- Привилегии на выполнение процедур и функций предоставлены PUBLIC
- Для production окружения рекомендуется ограничить привилегии

