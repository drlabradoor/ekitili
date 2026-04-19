// Серверная логика батла — socket.io game loop
// Все карточки передаются с клиента при join_battle (из userFlashcards).
// Сервер управляет состоянием, таймерами и валидацией.

const { Server } = require('socket.io');

const INITIAL_HP = 100;
const MAX_DAMAGE = 25;        // урон за ошибку / таймаут
const MAX_TIMER = 6;          // макс время ответа
const MIN_TIMER = 3;          // мин время ответа
const MAX_PARRY_WINDOW = 2;   // окно парирования на макс времени
const MIN_PARRY_WINDOW = 1;   // окно парирования на мин времени
const COMBO_THRESHOLD = 3;    // 3 подряд = комбо
const COMBO_MULTIPLIER = 1.5;
const NUM_OPTIONS = 4;        // вариантов ответа

// Ступенчатая система урона по времени реакции (адаптируется к timerSeconds)
function getDamageTiers(timerSeconds) {
    // Вычисляем окно парирования процентно
    const parryWindow = MAX_PARRY_WINDOW - (MAX_PARRY_WINDOW - MIN_PARRY_WINDOW) * ((MAX_TIMER - timerSeconds) / (MAX_TIMER - MIN_TIMER));

    return [
        { maxTime: parryWindow, damage: 0 },    // парирование = 0 урона
        { maxTime: parryWindow + 1, damage: 10 },
        { maxTime: parryWindow + 2, damage: 15 },
        { maxTime: Infinity, damage: 25 }       // макс урон
    ];
}

// Таймер: начало 6 сек, уменьшается линейно за 5 ходов до 3 сек
function getTimerForTurn(turn) {
    if (turn <= 5) {
        // Ход 1: 6 сек, Ход 5: 3 сек
        const timer = MAX_TIMER - (turn - 1) * ((MAX_TIMER - MIN_TIMER) / 4);
        return Math.max(MIN_TIMER, timer);
    }
    return MIN_TIMER;
}

let waitingPlayer = null;
const activeGames = new Map();

function initBattleSocket(httpServer) {
    // Парсим ALLOWED_ORIGINS из .env (разделены запятыми)
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : '*';

    const io = new Server(httpServer, {
        cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
    });

    io.on('connection', (socket) => {
        console.log(`[Battle] connected: ${socket.id}`);

        socket.on('join_battle', (data) => handleJoinBattle(io, socket, data));
        socket.on('attack_card', (data) => handleAttackCard(io, socket, data));
        socket.on('defend_answer', (data) => handleDefendAnswer(io, socket, data));
        socket.on('use_special', (data) => handleUseSpecial(io, socket, data));
        socket.on('disconnect', () => handleDisconnect(io, socket));
    });

    return io;
}

// =====================================================
// Подбор соперника
// =====================================================
function handleJoinBattle(io, socket, data) {
    const { username, userId, cards } = data;
    if (!username || !Array.isArray(cards) || cards.length < 6) {
        socket.emit('battle_error', { message: 'Недостаточно карточек для батла (минимум 6)' });
        return;
    }

    // Очистить из очереди если уже ждёт
    if (waitingPlayer && waitingPlayer.socketId === socket.id) return;

    const playerInfo = { socketId: socket.id, username, userId, cards };

    if (!waitingPlayer) {
        waitingPlayer = playerInfo;
        socket.emit('battle_waiting', {});
        return;
    }

    // Матч найден!
    const player1 = waitingPlayer;
    const player2 = playerInfo;
    waitingPlayer = null;

    const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const game = createGame(gameId, player1, player2);
    activeGames.set(gameId, game);

    // Сообщаем обоим
    const sock1 = io.sockets.sockets.get(player1.socketId);
    const sock2 = io.sockets.sockets.get(player2.socketId);

    if (sock1) {
        sock1.join(gameId);
        sock1.data.gameId = gameId;
        sock1.data.playerIdx = 0;
    }
    if (sock2) {
        sock2.join(gameId);
        sock2.data.gameId = gameId;
        sock2.data.playerIdx = 1;
    }

    emitGameStart(io, game);
}

// =====================================================
// Создание игры
// =====================================================
function createGame(gameId, p1, p2) {
    return {
        id: gameId,
        status: 'attacking',     // attacking | defending | over
        turn: 1,
        timerSeconds: getTimerForTurn(1),
        attackerIdx: 0,          // кто сейчас атакует (индекс в players[])
        players: [
            {
                socketId: p1.socketId,
                username: p1.username,
                userId: p1.userId,
                hp: INITIAL_HP,
                combo: 0,
                maxCombo: 0,
                correctAnswers: 0,
                crits: 0,
                specialCharges: 3,
                activeShield: false,
                activeFrost: false,
                activeDouble: false,
                cards: shuffleArray([...p1.cards])
            },
            {
                socketId: p2.socketId,
                username: p2.username,
                userId: p2.userId,
                hp: INITIAL_HP,
                combo: 0,
                maxCombo: 0,
                correctAnswers: 0,
                crits: 0,
                specialCharges: 3,
                activeShield: false,
                activeFrost: false,
                activeDouble: false,
                cards: shuffleArray([...p2.cards])
            }
        ],
        currentCard: null,
        correctAnswer: null,
        options: null,
        defenseStartTime: null,
        defenseTimeout: null,
        hand: null
    };
}

// =====================================================
// Начало игры — отправить game_start обоим
// =====================================================
function emitGameStart(io, game) {
    for (let i = 0; i < 2; i++) {
        const sock = io.sockets.sockets.get(game.players[i].socketId);
        if (!sock) continue;
        sock.emit('game_start', {
            gameId: game.id,
            playerIdx: i,
            playerSide: i === 0 ? 'left' : 'right',
            players: game.players.map(p => ({
                username: p.username,
                hp: p.hp,
                specialCharges: p.specialCharges
            })),
            attackerIdx: game.attackerIdx
        });
    }

    // Начинаем первый ход — атакующий получает руку
    dealHand(io, game);
}

// =====================================================
// Раздать руку (3 карты) атакующему
// =====================================================
function dealHand(io, game) {
    const attacker = game.players[game.attackerIdx];
    const hand = pickRandom(attacker.cards, 3);
    game.hand = hand;
    game.status = 'attacking';

    const attackerSock = io.sockets.sockets.get(attacker.socketId);
    if (attackerSock) {
        attackerSock.emit('your_turn_attack', { hand });
    }

    // Защитнику — ожидание
    const defIdx = 1 - game.attackerIdx;
    const defSock = io.sockets.sockets.get(game.players[defIdx].socketId);
    if (defSock) {
        defSock.emit('opponent_attacking', {});
    }
}

// =====================================================
// Атакующий выбрал карту
// =====================================================
function handleAttackCard(io, socket, data) {
    const game = getGameForSocket(socket);
    if (!game || game.status !== 'attacking') return;
    if (socket.data.playerIdx !== game.attackerIdx) return;

    const cardIndex = data.index;
    if (cardIndex < 0 || cardIndex >= game.hand.length) return;

    const card = game.hand[cardIndex];
    game.currentCard = card;
    game.correctAnswer = card.front; // правильный ответ — казахское слово
    game.status = 'defending';

    // Генерируем варианты ответа (казахские слова — front)
    const attacker = game.players[game.attackerIdx];
    const options = generateOptions(card.front, attacker.cards);
    game.options = options;

    // DRAFT: Спецприёмы (пока отключены, переделываем механику)
    // const defIdx = 1 - game.attackerIdx;
    // const defender = game.players[defIdx];
    // let timerForThisTurn = game.timerSeconds;
    // if (defender.activeFrost) {
    //     timerForThisTurn = Math.max(MIN_TIMER, timerForThisTurn - 3);
    //     defender.activeFrost = false;
    // }
    const defIdx = 1 - game.attackerIdx;
    const defender = game.players[defIdx];
    let timerForThisTurn = game.timerSeconds;

    game.defenseStartTime = Date.now();
    game.defenseTimerSeconds = timerForThisTurn;

    // Отправляем защитнику картинку + варианты (казахские слова) + подсказку (русское название)
    const defSock = io.sockets.sockets.get(defender.socketId);
    if (defSock) {
        defSock.emit('your_turn_defend', {
            card: { svgShape: card.svgShape, back: card.back },
            options,
            timerSeconds: timerForThisTurn
        });
    }

    // Атакующему — ожидание
    const atkSock = io.sockets.sockets.get(attacker.socketId);
    if (atkSock) {
        atkSock.emit('opponent_defending', { card: { svgShape: card.svgShape } });
    }

    // Таймаут
    game.defenseTimeout = setTimeout(() => {
        handleDefenseTimeout(io, game);
    }, timerForThisTurn * 1000);
}

// =====================================================
// Защитник ответил
// =====================================================
function handleDefendAnswer(io, socket, data) {
    const game = getGameForSocket(socket);
    if (!game || game.status !== 'defending') return;
    const defIdx = 1 - game.attackerIdx;
    if (socket.data.playerIdx !== defIdx) return;

    clearTimeout(game.defenseTimeout);

    const elapsed = (Date.now() - game.defenseStartTime) / 1000;
    const chosen = data.answer;
    const correct = chosen === game.correctAnswer;

    const attacker = game.players[game.attackerIdx];
    const defender = game.players[defIdx];

    if (correct) {
        defender.combo++;
        defender.correctAnswers++;
        if (defender.combo > defender.maxCombo) defender.maxCombo = defender.combo;

        // Ступенчатая система урона по времени реакции (адаптирована к текущему таймеру)
        let damage = 0;
        const damageTiers = getDamageTiers(game.defenseTimerSeconds);
        const isParry = elapsed <= damageTiers[0].maxTime;
        if (!isParry) {
            // Найти уровень урона по времени
            for (const tier of damageTiers) {
                if (elapsed <= tier.maxTime) {
                    damage = tier.damage;
                    break;
                }
            }
        }

        // Комбо атакующего усиливает даже правильный ответ с уроном
        if (damage > 0 && attacker.combo >= COMBO_THRESHOLD) {
            damage = Math.round(damage * COMBO_MULTIPLIER);
        }
        // DRAFT: Спецприёмы отключены
        // if (damage > 0 && attacker.activeDouble) {
        //     damage *= 2;
        //     attacker.activeDouble = false;
        // }
        // if (damage > 0 && defender.activeShield) {
        //     damage = 0;
        //     defender.activeShield = false;
        // }

        defender.hp = Math.max(0, defender.hp - damage);
        const targetSide = damage > 0 ? (defIdx === 0 ? 'left' : 'right') : null;

        emitTurnResult(io, game, {
            correct: true,
            isCrit: isParry,
            damage,
            defenderCombo: defender.combo,
            targetSide
        });

        if (defender.hp <= 0) {
            endGame(io, game, game.attackerIdx);
            return;
        }
    } else {
        // Неправильный ответ — максимальный урон
        defender.combo = 0;
        let damage = MAX_DAMAGE;

        if (attacker.combo >= COMBO_THRESHOLD) {
            damage = Math.round(damage * COMBO_MULTIPLIER);
        }
        // DRAFT: Спецприёмы отключены
        // if (attacker.activeDouble) {
        //     damage *= 2;
        //     attacker.activeDouble = false;
        // }
        // if (defender.activeShield) {
        //     damage = 0;
        //     defender.activeShield = false;
        // }

        defender.hp = Math.max(0, defender.hp - damage);
        const targetSide = defIdx === 0 ? 'left' : 'right';

        emitTurnResult(io, game, {
            correct: false,
            isCrit: false,
            damage,
            defenderCombo: 0,
            targetSide,
            correctAnswer: game.correctAnswer
        });

        attacker.combo++;
        if (attacker.combo > attacker.maxCombo) attacker.maxCombo = attacker.combo;

        if (defender.hp <= 0) {
            endGame(io, game, game.attackerIdx);
            return;
        }
    }

    // Правильный ответ — ход переходит защитнику; неправильный — атакующий атакует снова
    nextTurn(io, game, correct);
}

// =====================================================
// Таймаут защиты — автоматический проигрыш хода
// =====================================================
function handleDefenseTimeout(io, game) {
    if (game.status !== 'defending') return;

    const defIdx = 1 - game.attackerIdx;
    const attacker = game.players[game.attackerIdx];
    const defender = game.players[defIdx];

    defender.combo = 0;
    let damage = MAX_DAMAGE;
    if (attacker.combo >= COMBO_THRESHOLD) damage = Math.round(damage * COMBO_MULTIPLIER);
    // DRAFT: Спецприёмы отключены
    // if (attacker.activeDouble) { damage *= 2; attacker.activeDouble = false; }
    // if (defender.activeShield) { damage = 0; defender.activeShield = false; }

    defender.hp = Math.max(0, defender.hp - damage);
    const targetSide = defIdx === 0 ? 'left' : 'right';

    attacker.combo++;
    if (attacker.combo > attacker.maxCombo) attacker.maxCombo = attacker.combo;

    emitTurnResult(io, game, {
        correct: false,
        isCrit: false,
        damage,
        defenderCombo: 0,
        targetSide,
        timeout: true,
        correctAnswer: game.correctAnswer
    });

    if (defender.hp <= 0) {
        endGame(io, game, game.attackerIdx);
        return;
    }

    // Таймаут = ошибка — атакующий атакует снова
    nextTurn(io, game, false);
}

// =====================================================
// Результат хода — обоим
// =====================================================
function emitTurnResult(io, game, result) {
    io.to(game.id).emit('turn_result', {
        ...result,
        players: game.players.map(p => ({
            username: p.username,
            hp: p.hp,
            combo: p.combo,
            specialCharges: p.specialCharges
        }))
    });
}

// =====================================================
// Следующий ход
// =====================================================
function nextTurn(io, game, switchAttacker = true) {
    if (switchAttacker) {
        game.attackerIdx = 1 - game.attackerIdx;
    }
    game.turn++;
    game.timerSeconds = getTimerForTurn(game.turn);
    game.status = 'attacking';

    // Небольшая пауза перед следующим ходом
    setTimeout(() => {
        io.to(game.id).emit('new_turn', {
            attackerIdx: game.attackerIdx,
            turn: game.turn,
            timerSeconds: game.timerSeconds,
            players: game.players.map(p => ({
                username: p.username,
                hp: p.hp,
                combo: p.combo,
                specialCharges: p.specialCharges
            }))
        });
        dealHand(io, game);
    }, 1500);
}

// =====================================================
// Конец игры
// =====================================================
function endGame(io, game, winnerIdx) {
    game.status = 'over';
    clearTimeout(game.defenseTimeout);

    for (let i = 0; i < 2; i++) {
        const sock = io.sockets.sockets.get(game.players[i].socketId);
        if (sock) {
            sock.emit('game_over', {
                winner: i === winnerIdx,
                correctAnswers: game.players[i].correctAnswers,
                maxCombo: game.players[i].maxCombo,
                crits: game.players[i].crits,
                players: game.players.map(p => ({ username: p.username, hp: p.hp }))
            });
            sock.leave(game.id);
            sock.data.gameId = null;
        }
    }

    activeGames.delete(game.id);
}

// =====================================================
// Спецприёмы (DRAFT: отключены, переделываем механику)
// =====================================================
function handleUseSpecial(io, socket, data) {
    // DRAFT MODE: спецприёмы отключены пока переделываем механику
    // const game = getGameForSocket(socket);
    // if (!game || game.status === 'over') return;
    //
    // const playerIdx = socket.data.playerIdx;
    // const player = game.players[playerIdx];
    //
    // if (player.specialCharges <= 0) return;
    //
    // const special = data.special;
    // if (!['shield', 'frost', 'double'].includes(special)) return;
    //
    // // Нельзя использовать уже активный
    // if (special === 'shield' && player.activeShield) return;
    // if (special === 'frost' && player.activeFrost) return;
    // if (special === 'double' && player.activeDouble) return;
    //
    // player.specialCharges--;
    // if (special === 'shield') player.activeShield = true;
    // if (special === 'frost') player.activeFrost = true;
    // if (special === 'double') player.activeDouble = true;
    //
    // io.to(game.id).emit('special_used', {
    //     playerIdx,
    //     special,
    //     specialCharges: player.specialCharges
    // });
}

// =====================================================
// Отключение игрока
// =====================================================
function handleDisconnect(io, socket) {
    console.log(`[Battle] disconnected: ${socket.id}`);

    // Убрать из очереди
    if (waitingPlayer && waitingPlayer.socketId === socket.id) {
        waitingPlayer = null;
    }

    // Завершить активную игру
    const gameId = socket.data && socket.data.gameId;
    if (gameId && activeGames.has(gameId)) {
        const game = activeGames.get(gameId);
        const otherIdx = socket.data.playerIdx === 0 ? 1 : 0;
        const otherSock = io.sockets.sockets.get(game.players[otherIdx].socketId);
        if (otherSock) {
            otherSock.emit('opponent_left', {});
            otherSock.leave(gameId);
            otherSock.data.gameId = null;
        }
        clearTimeout(game.defenseTimeout);
        activeGames.delete(gameId);
    }
}

// =====================================================
// Утилиты
// =====================================================
function getGameForSocket(socket) {
    const gameId = socket.data && socket.data.gameId;
    return gameId ? activeGames.get(gameId) : null;
}

function generateOptions(correctAnswer, allCards) {
    const wrongAnswers = allCards
        .map(c => c.front)
        .filter(b => b !== correctAnswer);
    const unique = [...new Set(wrongAnswers)];
    const shuffled = shuffleArray(unique).slice(0, NUM_OPTIONS - 1);
    const options = shuffleArray([correctAnswer, ...shuffled]);
    return options;
}

function pickRandom(arr, count) {
    const shuffled = shuffleArray([...arr]);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

module.exports = { initBattleSocket };
