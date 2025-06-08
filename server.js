const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 游戏数据存储
const rooms = new Map();
const players = new Map();

// 题目库 - 按难度分类
const topicsByDifficulty = {
    easy: [
        // 基础物品
        '苹果', '香蕉', '杯子', '书', '笔', '花', '树', '太阳', '月亮', '星星',
        '猫', '狗', '鱼', '鸟', '房子', '车', '船', '门', '窗', '桌子',
        '椅子', '床', '灯', '球', '帽子', '鞋', '袜子', '衣服', '雨伞', '包',
        // 食物
        '蛋糕', '面包', '牛奶', '鸡蛋', '米饭', '面条', '汤', '糖果', '巧克力', '水果',
        // 动物
        '兔子', '熊', '老虎', '大象', '猴子', '狮子', '熊猫', '马', '牛', '羊',
        // 抽象
        '一方水土养一方人', '毋庸置疑', '大冰箱吃爷爷', '冰冻奶奶', '冰冻爷爷', '凌驾', '举手不是抱歉而是老弟你还得练', '头顶尖尖', '独攀', '吴映德'
    ],
    medium: [
        // 复杂物品
        '电脑', '手机', '相机', '电视', '冰箱', '洗衣机', '空调', '钢琴', '吉他', '小提琴',
        '自行车', '摩托车', '飞机', '火车', '轮船', '汽车', '卡车', '公交车', '救护车', '消防车',
        // 自然现象
        '彩虹', '闪电', '雷雨', '雪花', '云朵', '大海', '河流', '湖泊', '瀑布', '山峰',
        // 建筑
        '城堡', '教堂', '桥梁', '塔', '摩天大楼', '学校', '医院', '银行', '商店', '餐厅',
        // 运动
        '足球', '篮球', '乒乓球', '羽毛球', '网球', '游泳', '跑步', '骑车', '滑雪', '滑板',
        // 职业
        '医生', '老师', '警察', '消防员', '飞行员', '厨师', '画家', '音乐家', '运动员', '程序员',
        // 抽象
        '大碗宽面', 'GGBOND', '蔡徐坤', '来财', '夹死脑', '少萝', '贝利亚', '小丑身份证', '月半猫', '自己吓自己'
    ],
    hard: [
        // 抽象概念
        '友谊', '爱情', '梦想', '希望', '自由', '和平', '快乐', '悲伤', '愤怒', '恐惧',
        '时间', '空间', '无限', '永恒', '记忆', '思考', '创造', '想象', '灵感', '智慧',
        // 复杂事物
        '原子', '分子', 'DNA', '重力', '磁场', '电流', '光波', '声波', '频率', '能量',
        '民主', '法律', '经济', '政治', '文化', '历史', '哲学', '心理', '社会', '环境',
        // 抽象动作
        '思考', '冥想', '祈祷', '庆祝', '哀悼', '反思', '创新', '合作', '竞争', '领导',
        // 抽象
        '咖啡不断加加加加到厌倦', 'city不city', '浇给', '因为他善', '奶茶刺客', '遥遥领先', '牛马', '拉拉又扯扯', '松弛感‌', 'i人'
    ]
};

// 自定义题目存储
const customTopics = new Map(); // roomCode -> [topics]

// 获取所有题目
function getAllTopics() {
    return [
        ...topicsByDifficulty.easy,
        ...topicsByDifficulty.medium,
        ...topicsByDifficulty.hard
    ];
}

// 获取难度名称
function getDifficultyName(difficulty) {
    const names = {
        'easy': '简单',
        'medium': '中等', 
        'hard': '困难',
        'mixed': '混合'
    };
    return names[difficulty] || '混合';
}

// 生成房间码
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 随机选择三个题目
function getRandomTopics(difficulty = 'mixed', roomCode = null) {
    let availableTopics = [];
    
    // 获取自定义题目
    const roomCustomTopics = customTopics.get(roomCode) || [];
    
    if (difficulty === 'mixed') {
        // 混合难度：从各个难度等级中选择
        availableTopics = [
            ...topicsByDifficulty.easy,
            ...topicsByDifficulty.medium,
            ...topicsByDifficulty.hard,
            ...roomCustomTopics
        ];
    } else if (topicsByDifficulty[difficulty]) {
        // 指定难度
        availableTopics = [
            ...topicsByDifficulty[difficulty],
            ...roomCustomTopics
        ];
    } else {
        // 默认混合
        availableTopics = getAllTopics().concat(roomCustomTopics);
    }
    
    // 确保有足够的题目
    if (availableTopics.length < 3) {
        availableTopics = availableTopics.concat(getAllTopics());
    }
    
    const shuffled = [...availableTopics].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}

// 获取下一个画画的人
function getNextDrawer(room) {
    const playerIds = Array.from(room.players.keys());
    if (playerIds.length <= 1) return null;
    
    let nextPlayer;
    do {
        const randomIndex = Math.floor(Math.random() * playerIds.length);
        nextPlayer = playerIds[randomIndex];
    } while (nextPlayer === room.currentDrawer && playerIds.length > 1);
    
    return nextPlayer;
}

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 创建房间
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            host: socket.id,
            players: new Map([[socket.id, { name: playerName, score: 0 }]]),
            gameStarted: false,
            currentDrawer: null,
            currentTopic: null,
            topicOptions: [],
            drawingData: [],
            difficulty: 'mixed', // 默认混合难度
            customTopicsEnabled: false
        };
        
        rooms.set(roomCode, room);
        players.set(socket.id, { roomCode, name: playerName });
        
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, playerName });
        socket.emit('playersUpdate', { 
            players: Array.from(room.players.entries()),
            host: room.host 
        });
    });

    // 加入房间
    socket.on('joinRoom', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', '房间不存在');
            return;
        }
        
        if (room.players.size >= 5) {
            socket.emit('error', '房间已满');
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('error', '游戏已开始');
            return;
        }
        
        room.players.set(socket.id, { name: playerName, score: 0 });
        players.set(socket.id, { roomCode, name: playerName });
        
        socket.join(roomCode);
        socket.emit('roomJoined', { roomCode, playerName });
        io.to(roomCode).emit('playersUpdate', { 
            players: Array.from(room.players.entries()),
            host: room.host 
        });
    });

    // 开始游戏
    socket.on('startGame', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.host !== socket.id || room.players.size < 2) return;
        
        room.gameStarted = true;
        room.currentDrawer = getNextDrawer(room);
        room.topicOptions = getRandomTopics(room.difficulty, room.code);
        
        io.to(playerData.roomCode).emit('gameStarted');
        io.to(room.currentDrawer).emit('chooseTopicOptions', room.topicOptions);
        io.to(playerData.roomCode).emit('waitingForTopicChoice', {
            drawer: room.players.get(room.currentDrawer).name
        });
    });

    // 选择题目
    socket.on('chooseTopic', (topic) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.currentDrawer !== socket.id) return;
        
        room.currentTopic = topic;
        room.drawingData = [];
        
        io.to(playerData.roomCode).emit('topicChosen', {
            drawer: room.players.get(socket.id).name,
            topic: topic
        });
        
        socket.to(playerData.roomCode).emit('startGuessing');
        socket.emit('startDrawing', topic);
    });

    // 绘画数据
    socket.on('drawing', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.currentDrawer !== socket.id) return;
        
        room.drawingData.push(data);
        socket.to(playerData.roomCode).emit('drawing', data);
    });

    // 清除画布
    socket.on('clearCanvas', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.currentDrawer !== socket.id) return;
        
        room.drawingData = [];
        socket.to(playerData.roomCode).emit('clearCanvas');
    });

    // 设置游戏难度
    socket.on('setDifficulty', (difficulty) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.host !== socket.id || room.gameStarted) return;
        
        if (['easy', 'medium', 'hard', 'mixed'].includes(difficulty)) {
            room.difficulty = difficulty;
            io.to(playerData.roomCode).emit('difficultyChanged', {
                difficulty: difficulty,
                difficultyName: getDifficultyName(difficulty)
            });
        }
    });
    
    // 添加自定义题目
    socket.on('addCustomTopic', (topic) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.host !== socket.id) return;
        
        const topicText = topic.trim();
        if (!topicText || topicText.length > 10) {
            socket.emit('error', '题目长度应在1-10个字符之间');
            return;
        }
        
        let roomTopics = customTopics.get(room.code) || [];
        if (roomTopics.includes(topicText)) {
            socket.emit('error', '题目已存在');
            return;
        }
        
        if (roomTopics.length >= 20) {
            socket.emit('error', '自定义题目最多20个');
            return;
        }
        
        roomTopics.push(topicText);
        customTopics.set(room.code, roomTopics);
        room.customTopicsEnabled = true;
        
        io.to(playerData.roomCode).emit('customTopicAdded', {
            topic: topicText,
            totalCustom: roomTopics.length
        });
    });
    
    // 删除自定义题目
    socket.on('removeCustomTopic', (topic) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.host !== socket.id) return;
        
        let roomTopics = customTopics.get(room.code) || [];
        const index = roomTopics.indexOf(topic);
        
        if (index > -1) {
            roomTopics.splice(index, 1);
            customTopics.set(room.code, roomTopics);
            
            if (roomTopics.length === 0) {
                room.customTopicsEnabled = false;
            }
            
            io.to(playerData.roomCode).emit('customTopicRemoved', {
                topic: topic,
                totalCustom: roomTopics.length
            });
        }
    });
    
    // 获取房间设置
    socket.on('getRoomSettings', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room) return;
        
        const roomTopics = customTopics.get(room.code) || [];
        
        socket.emit('roomSettings', {
            difficulty: room.difficulty,
            difficultyName: getDifficultyName(room.difficulty),
            customTopics: roomTopics,
            isHost: room.host === socket.id
        });
    });

    // 猜词
    socket.on('guess', (guess) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomCode);
        if (!room || room.currentDrawer === socket.id || !room.currentTopic) return;
        
        const message = {
            player: playerData.name,
            message: guess,
            isCorrect: false
        };
        
        // 检查完全匹配
        if (guess.toLowerCase() === room.currentTopic.toLowerCase()) {
            message.isCorrect = true;
            
            // 加分
            const currentPlayer = room.players.get(socket.id);
            currentPlayer.score += 10;
            
            const drawer = room.players.get(room.currentDrawer);
            drawer.score += 5;
            
            io.to(playerData.roomCode).emit('correctGuess', {
                guesser: playerData.name,
                topic: room.currentTopic,
                nextDrawer: true
            });
            
            // 开始下一轮 - 猜对的人成为下一个画家
            setTimeout(() => {
                room.currentDrawer = socket.id; // 猜对的人成为画家
                room.topicOptions = getRandomTopics(room.difficulty, room.code);
                room.currentTopic = null;
                room.drawingData = [];
                
                io.to(playerData.roomCode).emit('playersUpdate', { 
                    players: Array.from(room.players.entries()),
                    host: room.host 
                });
                io.to(room.currentDrawer).emit('chooseTopicOptions', room.topicOptions);
                io.to(playerData.roomCode).emit('waitingForTopicChoice', {
                    drawer: room.players.get(room.currentDrawer).name
                });
                io.to(playerData.roomCode).emit('clearCanvas');
            }, 2000);
        } else {
            // 检查部分匹配（只有在不完全匹配时才检查）
            const guessText = guess.toLowerCase().trim();
            const topicText = room.currentTopic.toLowerCase().trim();
            
            // 计算匹配的字符数
            let matchCount = 0;
            const guessChars = Array.from(guessText);
            const topicChars = Array.from(topicText);
            
            // 创建副本以避免重复计算
            const topicCharsLeft = [...topicChars];
            
            for (const char of guessChars) {
                const index = topicCharsLeft.indexOf(char);
                if (index !== -1) {
                    matchCount++;
                    topicCharsLeft.splice(index, 1); // 移除已匹配的字符
                }
            }
            
            // 如果有匹配的字符，发送私人提示消息
            if (matchCount > 0) {
                let hintMessage = '';
                if (matchCount === 1) {
                    hintMessage = `💡 你的答案中有 1 个字是对的！`;
                } else {
                    hintMessage = `💡 你的答案中有 ${matchCount} 个字是对的！`;
                }
                
                // 发送只有该玩家能看到的提示消息
                socket.emit('privateHint', {
                    message: hintMessage,
                    matchCount: matchCount,
                    totalChars: topicChars.length
                });
            }
        }
        
        io.to(playerData.roomCode).emit('message', message);
    });

    // 发送消息
    socket.on('sendMessage', (message) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        io.to(playerData.roomCode).emit('message', {
            player: playerData.name,
            message: message,
            isCorrect: false
        });
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
        
        const playerData = players.get(socket.id);
        if (playerData) {
            const room = rooms.get(playerData.roomCode);
            if (room) {
                room.players.delete(socket.id);
                
                if (room.players.size === 0) {
                    rooms.delete(playerData.roomCode);
                    customTopics.delete(playerData.roomCode); // 清理自定义题目
                } else {
                    // 如果离开的是房主，选择新房主并发送通知
                    let wasHost = false;
                    let newHostName = '';
                    if (room.host === socket.id) {
                        wasHost = true;
                        room.host = room.players.keys().next().value;
                        newHostName = room.players.get(room.host).name;
                        
                        // 通知新房主
                        io.to(room.host).emit('message', {
                            message: '🔥 房主已退出！你是新的房主！',
                            isCorrect: false,
                            isSystem: true
                        });
                    }
                    
                    // 游戏中有人退出的处理
                    if (room.gameStarted) {
                        // 通知所有人有玩家退出
                        io.to(playerData.roomCode).emit('message', {
                            message: `😢 ${playerData.name} 退出了游戏`,
                            isCorrect: false,
                            isSystem: true
                        });
                        
                        // 如果只剩一个人，让他返回主页
                        if (room.players.size === 1) {
                            const remainingPlayerId = room.players.keys().next().value;
                            io.to(remainingPlayerId).emit('returnToHome', {
                                message: '有人退出！由于你是唯一一个人，为了防止你尴尬帮你返回到主页了。创作者太善良了！善哉善哉！'
                            });
                            // 删除房间
                            rooms.delete(playerData.roomCode);
                            customTopics.delete(playerData.roomCode);
                            return;
                        }
                        
                        // 如果离开的是当前画画的人，选择新的画画人
                        if (room.currentDrawer === socket.id) {
                            room.currentDrawer = getNextDrawer(room);
                            if (room.currentDrawer) {
                                room.topicOptions = getRandomTopics(room.difficulty, room.code);
                                room.currentTopic = null;
                                room.drawingData = [];
                                
                                io.to(room.currentDrawer).emit('chooseTopicOptions', room.topicOptions);
                                io.to(playerData.roomCode).emit('waitingForTopicChoice', {
                                    drawer: room.players.get(room.currentDrawer).name
                                });
                                io.to(playerData.roomCode).emit('clearCanvas');
                            }
                        }
                    }
                    
                    io.to(playerData.roomCode).emit('playersUpdate', { 
                        players: Array.from(room.players.entries()),
                        host: room.host 
                    });
                }
            }
            players.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 