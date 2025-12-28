-- =====================================================
-- Проверка блокировок и активных транзакций
-- =====================================================

-- 1. Проверка активных сессий и блокировок
SELECT 
    s.sid,
    s.serial#,
    s.username,
    s.status,
    s.machine,
    s.program,
    o.object_name,
    l.type,
    l.mode_held,
    l.mode_requested
FROM v$session s
LEFT JOIN v$lock l ON s.sid = l.sid
LEFT JOIN dba_objects o ON l.id1 = o.object_id
WHERE s.username IS NOT NULL
ORDER BY s.sid;

-- 2. Проверка незавершенных транзакций
SELECT 
    s.sid,
    s.serial#,
    s.username,
    t.start_time,
    t.status,
    t.used_ublk,
    t.used_urec
FROM v$transaction t
JOIN v$session s ON t.ses_addr = s.saddr
ORDER BY t.start_time;

-- 3. Блокировки объектов USER_ACCOUNTS
SELECT 
    s.sid,
    s.serial#,
    s.username,
    s.machine,
    s.program,
    o.object_name,
    l.type,
    l.lmode,
    l.request,
    l.block
FROM v$lock l
JOIN v$session s ON l.sid = s.sid
JOIN dba_objects o ON l.id1 = o.object_id
WHERE o.object_name = 'USER_ACCOUNTS'
ORDER BY l.block DESC, l.lmode DESC;

-- 4. Убить заблокированные сессии (ОСТОРОЖНО! Используйте только если нужно)
-- Замените <SID> и <SERIAL#> на значения из запроса выше
-- ALTER SYSTEM KILL SESSION '<SID>,<SERIAL#>';

-- 5. Откатить транзакцию в текущей сессии (если вы в SQL Developer)
ROLLBACK;

