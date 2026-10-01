# 🔨 冒头大作战 (Whack-a-Mole Multiplayer)

一个实时多人网页游戏，4人同时在线：3人抢冒头名额，1人射击击中冒头者。

## 🎮 游戏规则

- **3个冒头者**（位置 1/2/3）：每轮随机一人获得冒头机会，点击"冒头"按钮后暴露自己
- **1个射击者**：看到谁冒头后，快速点击对应位置进行射击
- **计分**：击中 +10分，被击中 -5分
- **限时**：总游戏时间 5分钟，多轮制

## 🏗️ 技术栈

| 组件 | 技术 | 费用 |
|------|------|------|
| 前端托管 | Netlify | **免费** |
| 实时通信 | PubNub | **免费** (100万消息/月, 100并发) |
| 游戏逻辑 | 纯 JavaScript | 免费 |

## 🚀 部署步骤

### Step 1: 获取 PubNub API Keys（免费）

1. 访问 https://www.pubnub.com/pricing/ 
2. 点击 "Start Free" 注册账号
3. 创建一个新 App
4. 复制你的 **Publish Key** 和 **Subscribe Key**

### Step 2: 配置项目

打开 `js/config.js`，替换以下两行：

```javascript
PUBNUB: {
    publishKey: 'YOUR_PUBLISH_KEY_HERE',      // ← 替换
    subscribeKey: 'YOUR_SUBSCRIBE_KEY_HERE',   // ← 替换
},
```

### Step 3: 部署到 Netlify

#### 方式 A: Git 部署（推荐）

1. 将项目推送到 GitHub
2. 登录 https://app.netlify.com/
3. 点击 "Add new site" → "Import an existing project"
4. 连接你的 GitHub 仓库
5. 设置 Build directory 为项目根目录
6. Publish directory 留空（或填 `.`）
7. 点击 Deploy

#### 方式 B: 拖拽部署

1. 登录 https://app.netlify.com/
2. 点击 "Add new site" → "Deploy manually"
3. 将整个 `whack-game` 文件夹拖入浏览器
4. 等待部署完成

#### 方式 C: Netlify CLI

```bash
npm install -g netlify-cli
cd whack-game
netlify deploy --prod
```

### Step 4: 邀请朋友

部署后，Netlify 会给你一个 URL（如 `https://your-site.netlify.app`）。

1. 第一个玩家打开网站，输入名字，点击"进入游戏"（自动创建房间）
2. 将显示的 **6位房间号** 分享给其他3个朋友
3. 朋友们打开同一个网站，输入名字和房间号加入
4. 4人到齐后，房主点击"开始游戏"

## 📁 项目结构

```
whack-game/
├── index.html          # 主页面（5个屏幕切换）
├── netlify.toml        # Netlify 部署配置
├── css/
│   └── style.css       # 全部样式
└── js/
    ├── config.js       # 配置（PubNub Keys, 游戏参数）
    └── game.js         # 核心游戏逻辑
```

## 💰 费用明细

**完全免费：**

- Netlify 免费套餐：无限带宽、无限站点
- PubNub 免费套餐：100万条消息/月、100个并发连接
- 你的游戏只有4个玩家，远远低于限制

## 🔧 自定义

在 `js/config.js` 中可以调整：

```javascript
GAME: {
    popUpDuration: 5,      // 冒头持续时间(秒)
    shootWindow: 3,         // 射击反应时间(秒)
    totalGameTime: 300,     // 总游戏时间(秒)
    roundCooldown: 2,       // 轮次冷却(秒)
    maxPlayers: 4,          // 最大玩家数
}
```
