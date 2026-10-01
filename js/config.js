/* ============================================
   游戏配置
   ⚠️ 你需要替换为自己的 PubNub Keys
   ============================================ */

const CONFIG = {
    // ---- PubNub 配置 (免费注册: https://www.pubnub.com/pricing/) ----
    // 免费套餐: 100万条消息/月, 100并发连接 — 对你的4人游戏绰绰有余
    PUBNUB: {
        publishKey: 'pub-c-8f6fe818-ef2e-4122-9993-e790f721c8ea',
        subscribeKey: 'sub-c-632c8bc5-da75-4b54-af01-a18aae16138a',
    },

    // ---- 游戏参数 ----
    GAME: {
        // 每轮冒头持续时间（秒）— 冒头者需要在这个时间内决定冒不冒头
        popUpDuration: 5,

        // 射击者反应时间（秒）— 冒头持续1秒，射击者需在此时间内出手
        shootWindow: 1,

        // 总游戏时间（秒）
        totalGameTime: 300,

        // 一轮冷却时间（秒）— 一轮结束后到下一轮开始
        roundCooldown: 2,

        // 最大玩家数
        maxPlayers: 4,
    },

    // ---- 频道命名 ----
    CHANNELS: {
        // 房间主频道: room-{code}-main
        main: (roomCode) => `room-${roomCode}-main`,
        // 状态同步频道: room-{code}-state
        state: (roomCode) => `room-${roomCode}-state`,
    },
};

// ---- 检查配置是否已设置 ----
if (CONFIG.PUBNUB.publishKey === 'YOUR_PUBLISH_KEY_HERE') {
    console.warn('⚠️ 请先在 js/config.js 中配置你的 PubNub API Keys');
}
