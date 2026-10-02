/* ============================================
   冒头大作战 v3 - Simplified & Robust
   ============================================ */

// ---- Global State ----
var G = {
    pn: null,
    name: '',
    id: '',
    room: '',
    ch: '',
    players: {},
    isHost: false,
    phase: 'login',
    round: 0,
    timeLeft: 0,
    timerId: null,
    active: false,
    popped: false,
    shot: false,
    molerId: '',
    molerSlot: 0,
    popDeadline: 0,
};

// ---- Helpers ----
function uid() {
    return 'p' + Math.random().toString(36).substr(2, 8) + Date.now().toString(36);
}

function roomCode() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
    return r;
}

function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

function show(id) {
    $$('.screen').forEach(function(s) { s.classList.remove('active'); });
    var el = $( '#' + id );
    if (el) el.classList.add('active');
}

function esc(t) {
    var d = document.createElement('span');
    d.textContent = String(t || '');
    return d.innerHTML;
}

function showError(msg) {
    $('#error-message').textContent = msg;
    $('#error-overlay').classList.remove('hidden');
    console.error('[ERROR]', msg);
}

function pCount() { return Object.keys(G.players).length; }

function myP() { return G.players[G.id] || null; }

// ---- PubNub Init ----
function initPN() {
    if (typeof PubNub === 'undefined') {
        showError('PubNub SDK 未加载，请刷新页面重试。');
        return false;
    }

    try {
        G.pn = new PubNub({
            publishKey: CONFIG.PUBNUB.publishKey,
            subscribeKey: CONFIG.PUBNUB.subscribeKey,
            uuid: G.id,
        });
        console.log('[PN] Client created, uuid:', G.id);
    } catch(e) {
        showError('PubNub 初始化失败: ' + e.message);
        return false;
    }

    G.pn.addListener({
        status: function(status) {
            if (status.category === 'PNConnectedCategory') {
                console.log('[PN] Connected ✅');
            }
        },
        message: function(m) {
            try { onMsg(m.message); } catch(e) { console.error('[onMsg err]', e); }
        }
    });

    return true;
}

function pub(msg) {
    if (!G.pn) { console.error('[pub] No client'); return; }
    msg.ts = Date.now();
    G.pn.publish({ channel: G.ch, message: msg });
    console.log('[pub]', msg.type);
}

// ---- Message Router ----
function onMsg(m) {
    if (!m || !m.type) return;
    var self = (m.pid === G.id);
    console.log('[msg]', m.type, self ? '(self)' : '');

    switch(m.type) {
        case 'join':      if (!self) onJoin(m); break;
        case 'sync':      if (!self) onSync(m); break;
        case 'pickphase': if (!self) onPickPhase(m); break;
        case 'pick':      if (!self) onPick(m); break;
        case 'start':     if (!self) onStart(m); break;
        case 'ready':     if (!self) onReady(m); break;
        case 'go':        if (!self) onGo(m); break;
        case 'pop':       if (!self) onPop(m); break;
        case 'fire':      if (!self) onFire(m); break;
        case 'rndend':    if (!self) onRndEnd(m); break;
        case 'rndstart':  if (!self) onRndStart(m); break;
    }
}

// ===========================
// JOIN
// ===========================
function onJoin(m) {
    G.players[m.pid] = { id: m.pid, name: m.name, role: '', score: 0, slot: 0, ready: false };
    renderLobby();

    // Send sync back to joiner
    pub({ type: 'sync', pid: G.id, plist: G.players, host: G.isHost, phase: G.phase });
}

function onSync(m) {
    if (m.plist) {
        var keep = G.players[G.id]; // preserve self
        G.players = {};
        for (var k in m.plist) {
            if (k !== G.id) G.players[k] = m.plist[k];
        }
        if (keep) G.players[G.id] = keep;
    }
    if (m.host && !G.isHost) G.isHost = false;
    if (m.phase) G.phase = m.phase;
    renderLobby();
}

// Entry point
function enterGame() {
    var name = ($('#player-name').value || '').trim();
    var room = ($('#room-code-input').value || '').trim();

    if (!name) { alert('请输入你的名字'); $('#player-name').focus(); return; }

    console.log('[enter]', name, room || '(auto)');

    G.name = name;
    G.id = uid();
    G.room = room ? room.toUpperCase() : roomCode();
    G.ch = 'room-' + G.room + '-main';

    if (!initPN()) return;

    // Subscribe (fire-and-forget, don't await)
    G.pn.subscribe({ channels: [G.ch] });

    // Add self immediately
    G.players[G.id] = { id: G.id, name: G.name, role: '', score: 0, slot: 0, ready: false };
    if (pCount() === 1) G.isHost = true;

    // Publish join
    pub({ type: 'join', pid: G.id, name: G.name });

    G.phase = 'lobby';
    renderLobby();
    show('screen-lobby');

    // Show room code on login screen too
    $('#display-room-code').textContent = G.room;
    $('#room-info-display').classList.remove('hidden');
}

// ===========================
// LOBBY
// ===========================
function renderLobby() {
    var codeEl = $('#lobby-room-code');
    if (codeEl) codeEl.textContent = G.room;

    var list = $('#players-list');
    if (!list) return;
    list.innerHTML = '';

    var avatars = ['🧑','👩','👨','🧒'];
    var ids = Object.keys(G.players);

    for (var i = 0; i < 4; i++) {
        var card = document.createElement('div');
        card.className = 'player-card';
        if (i < ids.length) {
            var p = G.players[ids[i]];
            card.classList.add('filled');
            var me = (p.id === G.id) ? '<br><small style="color:#ffd700">(你)</small>' : '';
            var roleTag = '';
            if (p.role === 'shooter') roleTag = '<span class="role-tag shooter">🎯 射击者</span>';
            else if (p.role === 'moler') roleTag = '<span class="role-tag moler">🐹 冒头者 #' + p.slot + '</span>';
            card.innerHTML = '<div class="avatar">' + avatars[i] + '</div>' +
                             '<div class="name">' + esc(p.name) + me + '</div>' + roleTag;
        } else {
            card.innerHTML = '<div class="avatar">❓</div><div class="name">等待加入...</div>';
        }
        list.appendChild(card);
    }

    // Host button — allow start with 2+ players for debug
    var hc = $('#host-controls');
    if (hc) {
        if (G.isHost) {
            hc.classList.remove('hidden');
            var btn = $('#btn-start-game');
            if (btn) {
                var ok = ids.length >= 2;
                btn.disabled = !ok;
                btn.textContent = ok ? '🎮 开始游戏！' : '至少需要2人 (' + ids.length + '/2)';
            }
        } else {
            hc.classList.add('hidden');
        }
    }

    var hint = $('#lobby-hint');
    if (hint && !G.isHost) {
        hint.textContent = '等待房主开始游戏...';
    }
}

// ===========================
// START GAME (role picking)
// ===========================
var ROLE_SLOTS = ['shooter', 'moler1', 'moler2', 'moler3'];
var roleTakenBy = {}; // roleKey -> playerId

function doStart() {
    if (!G.isHost) return;
    if (pCount() < 2) { alert('至少需要2人才能开始'); return; }

    // Reset role assignments
    roleTakenBy = {};

    // Fill empty slots with bots (no roles yet — humans pick first)
    var ids = Object.keys(G.players);
    while (ids.length < 4) {
        var botId = 'bot_' + ids.length;
        G.players[botId] = { id: botId, name: '机器人' + (ids.length + 1), role: '', score: 0, slot: 0, ready: false };
        ids = Object.keys(G.players);
    }

    G.phase = 'picking';

    // Broadcast pick phase to all
    pub({ type: 'pickphase', pid: G.id });

    showPickScreen();
}

function onPickPhase(m) {
    G.phase = 'picking';
    roleTakenBy = {};
    showPickScreen();
}

// ---- Player picks a role ----
function doPick(roleKey) {
    var p = myP();
    if (!p || G.phase !== 'picking') return;
    if (p.role) return; // already picked
    if (roleTakenBy[roleKey]) return; // taken

    // Claim it locally
    roleTakenBy[roleKey] = G.id;
    p.role = (roleKey === 'shooter') ? 'shooter' : 'moler';
    p.slot = parseInt(roleKey.replace('moler', '')) || 0;

    pub({ type: 'pick', pid: G.id, role: p.role, slot: p.slot, rkey: roleKey });
    renderPickScreen();

    // If host, check if all human players have picked
    if (G.isHost) {
        checkAllPicked();
    }
}

function onPick(m) {
    roleTakenBy[m.rkey] = m.pid;
    if (G.players[m.pid]) {
        G.players[m.pid].role = m.role;
        G.players[m.pid].slot = m.slot;
    }
    renderPickScreen();

    if (G.isHost) {
        checkAllPicked();
    }
}

function checkAllPicked() {
    // Check if all real (non-bot) players have a role
    var allHumansPicked = true;
    for (var k in G.players) {
        var pl = G.players[k];
        if (pl.id.indexOf('bot_') !== 0 && !pl.role) {
            allHumansPicked = false;
            break;
        }
    }

    if (!allHumansPicked) return;

    // All humans picked — assign remaining roles to bots
    var takenRoles = {};
    for (var rk in roleTakenBy) {
        var tid = roleTakenBy[rk];
        if (tid.indexOf('bot_') !== 0) {
            takenRoles[rk] = true;
        }
    }
    var remainingRoles = [];
    for (var ri = 0; ri < ROLE_SLOTS.length; ri++) {
        if (!takenRoles[ROLE_SLOTS[ri]]) remainingRoles.push(ROLE_SLOTS[ri]);
    }

    // Shuffle remaining roles for bots
    for (var si = remainingRoles.length - 1; si > 0; si--) {
        var sj = Math.floor(Math.random() * (si + 1));
        var stmp = remainingRoles[si]; remainingRoles[si] = remainingRoles[sj]; remainingRoles[sj] = stmp;
    }

    var botIdx = 0;
    for (var bk in G.players) {
        var bp = G.players[bk];
        if (bp.id.indexOf('bot_') === 0 && !bp.role && botIdx < remainingRoles.length) {
            var rKey = remainingRoles[botIdx++];
            roleTakenBy[rKey] = bp.id;
            bp.role = (rKey === 'shooter') ? 'shooter' : 'moler';
            bp.slot = parseInt(rKey.replace('moler', '')) || 0;
            bp.ready = true;
        }
    }

    renderPickScreen();

    // Transition to role confirmation
    setTimeout(function() {
        G.phase = 'role';
        pub({ type: 'start', pid: G.id, plist: G.players });
        showAssignedRole();
    }, 400);
}

function showPickScreen() {
    var picker = $('#role-picker');
    var display = $('#role-display');
    var readyBtn = $('#btn-ready');
    var hint = $('#role-hint');

    if (picker) picker.classList.remove('hidden');
    if (display) display.classList.add('hidden');
    if (readyBtn) readyBtn.classList.add('hidden');
    if (hint) hint.textContent = '选择一个位置，先到先得';

    show('screen-role');
    renderPickScreen();
}

function renderPickScreen() {
    if (G.phase !== 'picking' && G.phase !== 'role') return;

    var buttons = $$('.role-btn');
    var p = myP();

    buttons.forEach(function(btn) {
        var rk = btn.dataset.role;
        var statusEl = btn.querySelector('.role-btn-status');
        var takenBy = roleTakenBy[rk];

        btn.disabled = !!takenBy;
        btn.classList.remove('taken', 'my-pick');

        if (takenBy) {
            var taker = G.players[takenBy];
            var takerName = taker ? taker.name : '?';
            btn.classList.add('taken');
            if (statusEl) statusEl.textContent = '👤 ' + takerName;
            if (takenBy === G.id) {
                btn.classList.add('my-pick');
            }
        } else {
            if (statusEl) statusEl.textContent = '';
        }
    });

    // Update player chips
    renderRoleChips();
}

function renderRoleChips() {
    var container = $('#role-players');
    if (!container) return;
    container.innerHTML = '';

    for (var k in G.players) {
        var pl = G.players[k];
        if (!pl.role) continue;
        var chip = document.createElement('div');
        chip.className = 'role-player-chip';
        var meTag = (pl.id === G.id) ? ' <em>(你)</em>' : '';
        var rl = (pl.role === 'shooter') ? '🎯 射击者' : '🐹 ' + pl.slot + '号位';
        chip.innerHTML = esc(pl.name) + meTag + ': <span class="chip-role">' + rl + '</span>';
        container.appendChild(chip);
    }
}

function showAssignedRole() {
    var picker = $('#role-picker');
    var display = $('#role-display');
    var readyBtn = $('#btn-ready');
    var hint = $('#role-hint');

    if (picker) picker.classList.add('hidden');
    if (readyBtn) readyBtn.classList.remove('hidden');
    if (hint) hint.textContent = '等待所有玩家准备...';

    var p = myP();
    if (display && p) {
        display.classList.remove('hidden');
        if (p.role === 'shooter') {
            display.innerHTML = '<div class="role-icon">🎯</div>' +
                                '<p>你是 <strong style="color:#ff4444">射击者</strong>！</p>' +
                                '<p>点击冒头的格子击中对手</p>';
        } else {
            display.innerHTML = '<div class="role-icon">🐹</div>' +
                                '<p>你是 <strong style="color:#ffa500">' + esc(p.name) + '</strong></p>' +
                                '<p>你的位置是 <strong>' + p.slot + '</strong> 号位</p>';
        }
    }
    renderPickScreen();
}

// ===========================
// START (from host sync)
// ===========================
function onStart(m) {
    if (m.plist) {
        var keep = G.players[G.id];
        G.players = {};
        for (var k in m.plist) {
            G.players[k] = {
                id: k,
                name: m.plist[k].name || '?',
                role: m.plist[k].role || '',
                score: m.plist[k].score || 0,
                slot: m.plist[k].slot || 0,
                ready: false,
            };
        }
        if (keep) G.players[G.id] = keep;
        G.players[G.id].id = G.id;
    }
    G.phase = 'role';
    showAssignedRole();
}

// ===========================
// READY
// ===========================
function sendReady() {
    var p = myP();
    if (!p) return;
    p.ready = true;
    pub({ type: 'ready', pid: G.id });

    if (G.isHost) {
        var all = true;
        for (var k in G.players) {
            var pl = G.players[k];
            // Bots are always ready, only check humans
            if (pl.id.indexOf('bot_') !== 0 && !pl.ready) { all = false; break; }
        }
        if (all) {
            setTimeout(function() {
                pub({ type: 'go', pid: G.id });
                beginPlay();
            }, 600);
        }
    }
}

function onReady(m) {
    if (G.players[m.pid]) G.players[m.pid].ready = true;
}

function onGo(m) {
    beginPlay();
}

// ===========================
// PLAYING
// ===========================
function beginPlay() {
    G.phase = 'playing';
    G.round = 0;
    G.timeLeft = CONFIG.GAME.totalGameTime;

    show('screen-game');
    setupView();
    nextRound();
    startTimer();
}

function setupView() {
    var p = myP();
    if (!p) return;

    if (p.role === 'shooter') {
        $('#view-shooter').classList.remove('hidden');
        $('#view-moler').classList.add('hidden');
        // Set moler names
        for (var k in G.players) {
            var pl = G.players[k];
            if (pl.role === 'moler' && pl.slot) {
                var el = $('#player-' + pl.slot + '-name');
                if (el) el.textContent = pl.name;
            }
        }
    } else {
        $('#view-moler').classList.remove('hidden');
        $('#view-shooter').classList.add('hidden');
        setMolerState('waiting', p.slot + '号位 — 等待开始');
    }

    var rc = $('#game-room-code');
    if (rc) rc.textContent = '房间: ' + G.room;
    updateScores();
}

// ---- Rounds ----
function nextRound() {
    G.round++;
    G.active = true;
    G.popped = false;
    G.shot = false;
    G.popDeadline = 0;

    var re = $('#game-round');
    if (re) re.textContent = '第 ' + G.round + ' 轮';

    resetSlots();
    enablePopBtn();
    startBotTimer();

    pub({ type: 'rndstart', pid: G.id, rnd: G.round });
}

function onRndStart(m) {
    G.round = m.rnd;
    G.active = true;
    G.popped = false;
    G.shot = false;
    G.popDeadline = 0;

    var re = $('#game-round');
    if (re) re.textContent = '第 ' + G.round + ' 轮';

    resetSlots();
    enablePopBtn();
    startBotTimer();

    // If I'm a bot shooter, arm my shoot timer for this round
    var mp = myP();
    if (mp && mp.role === 'shooter' && mp.id.indexOf('bot_') === 0) {
        startBotShootTimer();
    }
}

// ---- Bot Moler Auto-Pop & Bot Shooter ----
var botTimerId = null;
var popCountdownId = null;
var botShootTimerId = null;

function startPopCountdown(remainingMs) {
    if (popCountdownId) clearInterval(popCountdownId);
    var res = $('#shooter-result');
    if (!res) return;
    var ms = remainingMs || POP_DURATION;
    popCountdownId = setInterval(function() {
        ms -= 100;
        if (ms <= 0) {
            clearInterval(popCountdownId);
            if (res && !G.shot) res.innerHTML = '<span class="result-miss">⏰ 时间到！</span>';
            return;
        }
        if (res && G.popped && !G.shot) {
            res.innerHTML = '<span style="color:#ffd700;font-size:1.2em;">🎯 ' + (ms / 1000).toFixed(1) + 's 快开枪！</span>';
        } else {
            clearInterval(popCountdownId);
        }
    }, 100);
}

function startBotTimer() {
    if (botTimerId) clearTimeout(botTimerId);
    // Schedule multiple competing bot pops per round for excitement
    scheduleNextBotPop();
    // If there's a bot shooter, arm its timer too
    if (hasBotShooter()) startBotShootTimer();
}

function hasBotShooter() {
    for (var k in G.players) {
        if (G.players[k].role === 'shooter' && G.players[k].id.indexOf('bot_') === 0) return true;
    }
    return false;
}

// Schedule the next bot pop with random delay
function scheduleNextBotPop() {
    if (botTimerId) clearTimeout(botTimerId);
    var delay = 800 + Math.random() * 2200; // 0.8-3s
    botTimerId = setTimeout(function() {
        if (G.active && !G.popped) triggerBotPop();
        // Schedule another pop after this one resolves (if game still active)
        setTimeout(function() {
            if (G.active && G.phase === 'playing') scheduleNextBotPop();
        }, POP_DURATION + 1000);
    }, delay);
}

// Trigger a bot pop — publishes over PubNub so ALL clients see it
function triggerBotPop() {
    // Find all bot molers that haven't popped this round
    var bots = [];
    for (var k in G.players) {
        if (G.players[k].role === 'moler' && G.players[k].id.indexOf('bot_') === 0) {
            bots.push(G.players[k]);
        }
    }
    if (bots.length === 0) return;

    // Pick a random bot mole to pop
    var bot = bots[Math.floor(Math.random() * bots.length)];

    // Set local state
    G.popped = true;
    G.molerId = bot.id;
    G.molerSlot = bot.slot;
    G.popDeadline = Date.now() + POP_DURATION;

    // Publish pop event so ALL clients (including shooter) receive it
    pub({
        type: 'pop',
        pid: bot.id,
        sid: bot.id,
        slot: bot.slot,
        name: bot.name,
        rnd: G.round,
        deadline: G.popDeadline
    });

    // Auto-end round if not shot within POP_DURATION
    setTimeout(function() {
        if (G.active && G.popped && !G.shot) endRound('timeout');
    }, POP_DURATION);
}

// Bot shooter: waits for a pop then fires after a short delay
function startBotShootTimer() {
    if (botShootTimerId) clearTimeout(botShootTimerId);
    // React quickly once a pop appears (200-600ms reaction time)
    botShootTimerId = setTimeout(function() {
        if (G.active && G.popped && !G.shot) {
            botShoot();
        }
    }, 200 + Math.random() * 400);
}

function botShoot() {
    var p = myP();
    // Only bot shooters should auto-fire
    if (p && p.role === 'shooter' && p.id.indexOf('bot_') === 0) {
        doShoot(G.molerSlot);
        return;
    }
    // If current player is human shooter but a bot is also shooter,
    // pick a random slot (70% chance to pick correctly for fun)
    if (p && p.role === 'shooter') {
        // Bot shooter competes — pick correct slot 60% of the time
        var target = (Math.random() < 0.6) ? G.molerSlot : (1 + Math.floor(Math.random() * 3));
        doShoot(target);
    }
}

function enablePopBtn() {
    var p = myP();
    if (!p || p.role !== 'moler') return;

    var btn = $('#btn-pop-up');
    if (btn) { btn.disabled = false; btn.classList.remove('hidden'); }
    setMolerState('waiting', p.slot + '号位 — 快抢冒头！');
}

// ---- POP UP (1-second auto-duration) ----
var POP_DURATION = 1000; // ms — how long a mole stays up

function doPop() {
    var p = myP();
    if (!p || p.role !== 'moler') return;
    if (G.popped) return;

    G.popped = true;
    G.molerId = G.id;
    G.molerSlot = p.slot;
    G.popDeadline = Date.now() + POP_DURATION;

    var btn = $('#btn-pop-up');
    if (btn) btn.disabled = true;
    setMolerState('popping', '⚡ 已冒头！等射击者出手...');

    pub({ type: 'pop', pid: G.id, sid: G.id, slot: p.slot, name: G.name, rnd: G.round, deadline: G.popDeadline });

    // Pop lasts exactly POP_DURATION ms — then auto-end round if not shot
    setTimeout(function() {
        if (G.active && G.popped && !G.shot) endRound('timeout');
    }, POP_DURATION);
}

function onPop(m) {
    var p = myP();
    if (!p) return;

    // Ignore duplicate pops for the same round
    if (G.popped && G.shot) return;

    G.popped = true;
    G.molerId = m.sid;
    G.molerSlot = m.slot;
    // Always use a fresh POP_DURATION from now to avoid flicker from network delay
    // The original deadline may have already passed by the time this message arrives
    G.popDeadline = Date.now() + POP_DURATION;

    if (p.role === 'moler') {
        setMolerState('waiting', m.name + ' 冒头了，等待结果...');
        // Disable pop button while another moler is up
        var btn = $('#btn-pop-up');
        if (btn) btn.disabled = true;
        return;
    }

    // Shooter — show pop-up visually
    var se = $('#slot-' + m.slot);
    if (se) se.classList.add('pop-up');
    var st = $('#slot-' + m.slot + '-status');
    if (st) st.textContent = m.name + ' 冒头了！';

    // Show countdown for shooter — full POP_DURATION window
    startPopCountdown(POP_DURATION);

    // Auto-end round if not shot within POP_DURATION
    setTimeout(function() {
        if (G.popped && !G.shot && G.molerId === m.sid) {
            resetSlots();
            if (G.active) endRound('timeout');
        }
    }, POP_DURATION);

    // If there's a bot shooter competing, arm its timer
    if (hasBotShooter()) startBotShootTimer();
}

// ---- SHOOT ----
function doShoot(slotNum) {
    var p = myP();
    if (!p || p.role !== 'shooter') return;
    if (!G.popped || !G.active) return;
    if (G.shot) return;

    G.shot = true;
    var hit = (slotNum === G.molerSlot);

    // Score
    if (hit) {
        p.score += 10;
        if (G.players[G.molerId]) G.players[G.molerId].score -= 5;
    }

    // UI feedback — always show result regardless of hit/miss
    var se = $('#slot-' + slotNum);
    var res = $('#shooter-result');
    if (hit) {
        if (se) se.classList.add('hit-flash');
        if (res) res.innerHTML = '<span class="result-hit">💥 击中！+10分</span>';
    } else {
        if (se) se.classList.add('miss-flash');
        if (res) res.innerHTML = '<span class="result-miss">😅 打空了！</span>';
    }
    $$('.slot').forEach(function(s) { s.classList.add('disabled'); });

    // Scores snapshot
    var scores = {};
    for (var k in G.players) scores[k] = G.players[k].score;

    pub({ type: 'fire', pid: G.id, slot: slotNum, ms: G.molerSlot, hit: hit, mid: G.molerId, rnd: G.round, scores: scores });

    setTimeout(function() { endRound(hit ? 'hit' : 'miss'); }, 1500);
}

function onFire(m) {
    G.shot = true;

    // Sync scores
    if (m.scores) {
        for (var k in m.scores) {
            if (G.players[k]) G.players[k].score = m.scores[k];
        }
    }

    var p = myP();
    if (p && p.role === 'moler') {
        if (m.mid === G.id) {
            setMolerState(m.hit ? 'hit' : 'safe', m.hit ? '💥 被击中了！-5分' : '✅ 安全！打错了');
        } else {
            setMolerState('waiting', (m.hit ? '击中' : '未击中') + ' — 下一轮');
        }
    }

    // Also show shooter UI feedback when receiving fire from another client (e.g. bot shooter)
    if (p && p.role === 'shooter' && m.pid !== G.id) {
        var se = $('#slot-' + m.slot);
        var res = $('#shooter-result');
        if (m.hit) {
            if (se) se.classList.add('hit-flash');
            if (res) res.innerHTML = '<span class="result-hit">💥 击中！+10分</span>';
        } else {
            if (se) se.classList.add('miss-flash');
            if (res) res.innerHTML = '<span class="result-miss">😅 打空了！</span>';
        }
        $$('.slot').forEach(function(s) { s.classList.add('disabled'); });
    }

    updateScores();
}

// ---- Round End ----
var _roundEnding = false;
function endRound(result) {
    if (!G.active || _roundEnding) return;
    _roundEnding = true;
    G.active = false;

    var scores = {};
    for (var k in G.players) scores[k] = G.players[k].score;

    pub({ type: 'rndend', pid: G.id, result: result, rnd: G.round, scores: scores });
    procRndEnd(result, scores);

    // Reset guard after cooldown so concurrent calls don't re-trigger
    setTimeout(function() { _roundEnding = false; }, CONFIG.GAME.roundCooldown * 1000);
}

function onRndEnd(m) {
    procRndEnd(m.result, m.scores);
}

function procRndEnd(result, scores) {
    if (scores) {
        for (var k in scores) {
            if (G.players[k]) G.players[k].score = scores[k];
        }
    }
    resetSlots();
    updateScores();

    // Clear any pending bot timers
    if (botTimerId) { clearTimeout(botTimerId); botTimerId = null; }
    if (botShootTimerId) { clearTimeout(botShootTimerId); botShootTimerId = null; }

    setTimeout(function() {
        _roundEnding = false;
        if (G.phase === 'playing') nextRound();
    }, CONFIG.GAME.roundCooldown * 1000);
}

function resetSlots() {
    if (popCountdownId) { clearInterval(popCountdownId); popCountdownId = null; }
    $$('.slot').forEach(function(s) {
        s.classList.remove('pop-up','hit-flash','miss-flash','disabled');
    });
    $$('.slot-status').forEach(function(s) { s.textContent = '空'; });
    var r = $('#shooter-result');
    if (r) r.innerHTML = '';
}

// ---- Molere State ----
function setMolerState(cls, txt) {
    var b = $('#moler-state');
    if (!b) return;
    b.className = 'state-badge ' + cls;
    b.textContent = txt;
}

// ---- Scores ----
function updateScores() {
    ['moler-scores','shooter-scores'].forEach(function(cid) {
        var c = $('#' + cid);
        if (!c) return;
        c.innerHTML = '';
        var arr = [];
        for (var k in G.players) arr.push(G.players[k]);
        arr.forEach(function(p) {
            var d = document.createElement('div');
            d.className = 'score-item';
            var me = (p.id === G.id) ? ' <em>(你)</em>' : '';
            var rl = (p.role === 'shooter') ? '🎯' : '🐹#' + p.slot;
            d.innerHTML = '<span>' + esc(p.name) + me + ' <small style="color:#888">' + rl + '</small></span>' +
                          '<span class="score-value">' + p.score + ' 分</span>';
            c.appendChild(d);
        });
    });
}

// ---- Timer ----
function startTimer() {
    if (G.timerId) clearInterval(G.timerId);
    G.timerId = setInterval(function() {
        if (G.phase !== 'playing') { clearInterval(G.timerId); return; }
        G.timeLeft--;
        var mm = Math.floor(G.timeLeft / 60);
        var ss = G.timeLeft % 60;
        var te = $('#game-timer');
        if (te) te.textContent = '⏱️ ' + mm + ':' + (ss < 10 ? '0' : '') + ss;
        if (G.timeLeft <= 0) {
            clearInterval(G.timerId);
            gameOver();
        }
    }, 1000);
}

// ---- Game Over ----
function gameOver() {
    G.phase = 'ended';
    // Clean up all timers
    if (G.timerId) clearInterval(G.timerId);
    if (botTimerId) clearTimeout(botTimerId);
    if (botShootTimerId) clearTimeout(botShootTimerId);
    if (popCountdownId) clearInterval(popCountdownId);
    var arr = [];
    for (var k in G.players) arr.push(G.players[k]);
    arr.sort(function(a,b) { return b.score - a.score; });
    var w = arr[0];

    var c = $('#final-scores');
    if (!c) return;
    c.innerHTML = '';
    arr.forEach(function(p, i) {
        var d = document.createElement('div');
        var md = (i===0?'🏆':i===1?'🥈':i===2?'🥉':'#');
        var ri = (p.role==='shooter'?'🎯':'🐹');
        d.className = 'final-player' + (p.id===w.id?' winner':'');
        d.innerHTML = '<span>' + md + ' ' + esc(p.name) + ' ' + ri + '</span><strong>' + p.score + ' 分</strong>';
        c.appendChild(d);
    });
    show('screen-result');
}

// ===========================
// EVENT BINDING
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] DOM ready');

    var be = $('#btn-enter');
    if (be) be.addEventListener('click', enterGame);

    // Enter key
    ['#player-name','#room-code-input'].forEach(function(s) {
        var el = $(s);
        if (el) el.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { be && be.click(); }
        });
    });

    var bc = $('#btn-copy-code');
    if (bc) bc.addEventListener('click', function() {
        if (navigator.clipboard && G.room) {
            navigator.clipboard.writeText(G.room).then(function() {
                bc.textContent = '✅ 已复制';
                setTimeout(function(){ bc.textContent = '复制房间号'; }, 2000);
            });
        } else {
            prompt('复制这个房间号:', G.room);
        }
    });

    var bs = $('#btn-start-game');
    if (bs) bs.addEventListener('click', doStart);

    // Role picker buttons
    $$('.role-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            doPick(btn.dataset.role);
        });
    });

    var br = $('#btn-ready');
    if (br) br.addEventListener('click', sendReady);

    var bp = $('#btn-pop-up');
    if (bp) bp.addEventListener('click', doPop);

    $$('.slot').forEach(function(sl) {
        sl.addEventListener('click', function() {
            doShoot(parseInt(sl.dataset.slot));
        });
    });

    var bb = $('#btn-back-lobby');
    if (bb) bb.addEventListener('click', function() {
        G.phase = 'login';
        G.players = {};
        G.isHost = false;
        G.round = 0;
        G.active = false;
        G.popped = false;
        G.shot = false;
        if (G.timerId) clearInterval(G.timerId);
        show('screen-login');
    });

    console.log('[INIT] Events bound OK');
});
