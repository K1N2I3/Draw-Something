// Socket连接
const socket = io();

// 游戏状态
let gameState = {
    playerName: '',
    roomCode: '',
    isHost: false,
    isDrawing: false,
    currentColor: '#000000',
    brushSize: 3,
    currentTool: 'brush',
    currentShape: 'round'
};

// 动画和特效相关
let particles = []; // 粒子系统
let fireworks = []; // 烟花系统
let trailPoints = []; // 画笔轨迹点
let animationFrameId = null;

// 页面元素
const pages = {
    home: document.getElementById('homePage'),
    joinRoom: document.getElementById('joinRoomPage'),
    waitingRoom: document.getElementById('waitingRoomPage'),
    game: document.getElementById('gamePage')
};

// 画布相关
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// 特效画布（覆盖在主画布上方）
let effectsCanvas, effectsCtx;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setupCanvas();
});

// 事件监听器初始化
function initializeEventListeners() {
    // 主页面事件
    document.getElementById('createRoomBtn').onclick = createRoom;
    document.getElementById('joinRoomBtn').onclick = showJoinRoomPage;
    document.getElementById('backToHomeBtn').onclick = showHomePage;
    document.getElementById('joinRoomSubmitBtn').onclick = joinRoom;
    
    // 房间事件
    document.getElementById('startGameBtn').onclick = startGame;
    document.getElementById('leaveRoomBtn').onclick = leaveRoom;
    
    // 游戏事件
    document.getElementById('sendChatBtn').onclick = sendChat;
    document.getElementById('chatInput').onkeypress = function(e) {
        if (e.key === 'Enter') sendChat();
    };
    
    // 绘画工具事件
    document.getElementById('clearCanvasBtn').onclick = clearCanvas;
    document.getElementById('brushSize').oninput = function(e) {
        gameState.brushSize = e.target.value;
        document.getElementById('brushSizeDisplay').textContent = e.target.value;
    };
    
    // 工具选择事件
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelector('.tool-btn.active').classList.remove('active');
            this.classList.add('active');
            gameState.currentTool = this.dataset.tool;
        };
    });
    
    // 笔刷形状选择事件
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelector('.shape-btn.active').classList.remove('active');
            this.classList.add('active');
            gameState.currentShape = this.dataset.shape;
        };
    });
    
    // 颜色选择事件
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelector('.color-btn.active').classList.remove('active');
            this.classList.add('active');
            gameState.currentColor = this.dataset.color;
        };
    });
    
    // 输入框大写转换
    document.getElementById('roomCodeInput').oninput = function(e) {
        e.target.value = e.target.value.toUpperCase();
    };
    
    // 游戏设置事件
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.onclick = function() {
            if (!gameState.isHost) return;
            
            document.querySelector('.difficulty-btn.active').classList.remove('active');
            this.classList.add('active');
            socket.emit('setDifficulty', this.dataset.difficulty);
        };
    });
    
    document.getElementById('addCustomTopicBtn').onclick = addCustomTopic;
    document.getElementById('customTopicInput').onkeypress = function(e) {
        if (e.key === 'Enter') addCustomTopic();
    };
}

// 画布设置
function setupCanvas() {
    // 设置画布尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = 800;
    canvas.height = 600;
    
    // 画布事件监听
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 触摸事件（移动端支持）
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
    
    // 初始化画布
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 初始化特效系统
    initEffectsSystem();
}

// 初始化特效系统
function initEffectsSystem() {
    // 创建特效画布
    effectsCanvas = document.createElement('canvas');
    effectsCtx = effectsCanvas.getContext('2d');
    
    // 获取画布的实际显示尺寸
    const canvasRect = canvas.getBoundingClientRect();
    const canvasStyles = window.getComputedStyle(canvas);
    
    // 设置特效画布尺寸（与主画布的实际尺寸完全一致）
    effectsCanvas.width = canvas.width;
    effectsCanvas.height = canvas.height;
    
    // 设置特效画布样式，完全匹配主画布
    effectsCanvas.style.position = 'absolute';
    effectsCanvas.style.top = '0';
    effectsCanvas.style.left = '0';
    effectsCanvas.style.width = canvasStyles.width;
    effectsCanvas.style.height = canvasStyles.height;
    effectsCanvas.style.maxWidth = canvasStyles.maxWidth;
    effectsCanvas.style.border = canvasStyles.border;
    effectsCanvas.style.borderRadius = canvasStyles.borderRadius;
    effectsCanvas.style.pointerEvents = 'none';
    effectsCanvas.style.zIndex = '10';
    effectsCanvas.style.display = 'block';
    
    // 确保画布容器是相对定位
    const canvasContainer = canvas.parentNode;
    canvasContainer.style.position = 'relative';
    canvasContainer.appendChild(effectsCanvas);
    
    // 计算缩放比例
    const scaleX = parseFloat(canvasStyles.width) / canvas.width;
    const scaleY = parseFloat(canvasStyles.height) / canvas.height;
    
    console.log('特效系统初始化完成:', {
        mainCanvas: { width: canvas.width, height: canvas.height },
        effectsCanvas: { width: effectsCanvas.width, height: effectsCanvas.height },
        displaySize: { width: canvasStyles.width, height: canvasStyles.height },
        scaleRatio: { x: scaleX, y: scaleY },
        devicePixelRatio: window.devicePixelRatio
    });
    
    // 启动动画循环
    startAnimationLoop();
    
    // 初始同步特效画布
    setTimeout(() => syncEffectsCanvas(), 100);
    
    // 监听窗口大小变化，重新调整特效画布
    window.addEventListener('resize', () => {
        if (effectsCanvas && canvas) {
            syncEffectsCanvas();
        }
    });
}

// 同步特效画布位置和样式
function syncEffectsCanvas() {
    if (!effectsCanvas || !canvas) return;
    
    const canvasStyles = window.getComputedStyle(canvas);
    const canvasRect = canvas.getBoundingClientRect();
    
    // 更新特效画布样式
    effectsCanvas.style.width = canvasStyles.width;
    effectsCanvas.style.height = canvasStyles.height;
    effectsCanvas.style.maxWidth = canvasStyles.maxWidth;
    
    console.log('特效画布已同步:', {
        canvasDisplaySize: { width: canvasStyles.width, height: canvasStyles.height },
        canvasActualSize: { width: canvas.width, height: canvas.height },
        canvasRect: { 
            top: canvasRect.top, 
            left: canvasRect.left, 
            width: canvasRect.width, 
            height: canvasRect.height 
        }
    });
}

// 粒子类
class Particle {
    constructor(x, y, color, size, velocity, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.velocity = velocity;
        this.life = life;
        this.maxLife = life;
        this.gravity = 0.1;
    }
    
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.velocity.y += this.gravity;
        this.life--;
        
        // 渐变透明度
        const alpha = this.life / this.maxLife;
        this.color = this.color.replace(/,[\d\.]+\)/, `,${alpha})`);
        
        return this.life > 0;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 烟花类
class Firework {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.colors = [
            'rgba(255, 69, 0, 1)',
            'rgba(255, 215, 0, 1)', 
            'rgba(0, 255, 127, 1)',
            'rgba(30, 144, 255, 1)',
            'rgba(255, 20, 147, 1)',
            'rgba(148, 0, 211, 1)'
        ];
        
        // 创建烟花粒子
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const speed = Math.random() * 5 + 2;
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];
            
            this.particles.push(new Particle(
                x, y, color,
                Math.random() * 3 + 1,
                {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                },
                60 + Math.random() * 30
            ));
        }
    }
    
    update() {
        this.particles = this.particles.filter(particle => particle.update());
        return this.particles.length > 0;
    }
    
    draw(ctx) {
        this.particles.forEach(particle => particle.draw(ctx));
    }
}

// 轨迹点类
class TrailPoint {
    constructor(x, y, color, size) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = 30; // 增加生命周期
        this.maxLife = 30;
        this.originalSize = size;
    }
    
    update() {
        this.life--;
        const alpha = this.life / this.maxLife;
        // 更平滑的尺寸变化
        this.size = this.originalSize * (0.3 + alpha * 0.7);
        this.color = this.color.replace(/,[\d\.]+\)/, `,${alpha * 0.8})`); // 增加不透明度
        return this.life > 0;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15; // 增加发光效果
        ctx.shadowColor = this.color;
        
        // 绘制内核
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制外层光晕
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// 动画循环
function startAnimationLoop() {
    function animate() {
        // 清除特效画布
        effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
        
        // 更新和绘制轨迹点
        trailPoints = trailPoints.filter(point => {
            const alive = point.update();
            if (alive) point.draw(effectsCtx);
            return alive;
        });
        
        // 更新和绘制烟花
        fireworks = fireworks.filter(firework => {
            const alive = firework.update();
            if (alive) firework.draw(effectsCtx);
            return alive;
        });
        
        // 更新和绘制粒子
        particles = particles.filter(particle => {
            const alive = particle.update();
            if (alive) particle.draw(effectsCtx);
            return alive;
        });
        
        animationFrameId = requestAnimationFrame(animate);
    }
    animate();
}

// 创建烟花特效
function createFireworks(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const offsetX = (Math.random() - 0.5) * 100;
            const offsetY = (Math.random() - 0.5) * 100;
            fireworks.push(new Firework(x + offsetX, y + offsetY));
        }, i * 200);
    }
    
    // 添加屏幕震动效果
    addScreenShake();
}

// 屏幕震动效果
function addScreenShake() {
    const gameContainer = document.querySelector('.game-content');
    if (gameContainer) {
        gameContainer.style.animation = 'screenShake 0.5s ease-in-out';
        setTimeout(() => {
            gameContainer.style.animation = '';
        }, 500);
    }
}

// 获取特效坐标（考虑画布缩放）
function getEffectsCoordinates(x, y) {
    if (!canvas || !effectsCanvas) return [x, y];
    
    // 获取画布样式
    const canvasStyles = window.getComputedStyle(canvas);
    const displayWidth = parseFloat(canvasStyles.width);
    const displayHeight = parseFloat(canvasStyles.height);
    
    // 计算缩放比例
    const scaleX = displayWidth / canvas.width;
    const scaleY = displayHeight / canvas.height;
    
    // 转换坐标（如果画布被缩放，需要相应调整特效坐标）
    const effectsX = x;
    const effectsY = y;
    
    return [effectsX, effectsY];
}

// 添加画笔轨迹特效
function addBrushTrail(x, y, color, size) {
    // 确保特效画布已初始化
    if (!effectsCanvas || !effectsCtx) {
        console.warn('特效系统未初始化');
        return;
    }
    
    // 获取正确的特效坐标
    const [effectsX, effectsY] = getEffectsCoordinates(x, y);
    
    // 将颜色转换为rgba格式
    let rgba = color;
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        rgba = `rgba(${r}, ${g}, ${b}, 1)`;
    }
    
    // 调试信息
    console.log('添加轨迹特效:', { 
        original: { x, y }, 
        effects: { x: effectsX, y: effectsY }, 
        color: rgba, 
        size 
    });
    
    // 添加更多轨迹点，让效果更明显
    const particleCount = 8; // 增加粒子数量
    for (let i = 0; i < particleCount; i++) {
        const offsetX = (Math.random() - 0.5) * size * 3;
        const offsetY = (Math.random() - 0.5) * size * 3;
        trailPoints.push(new TrailPoint(
            effectsX + offsetX, 
            effectsY + offsetY, 
            rgba, 
            Math.max(3, size * 1.2) // 进一步增大粒子尺寸
        ));
    }
    
    // 额外添加一个固定位置的大粒子用于调试
    trailPoints.push(new TrailPoint(
        effectsX, 
        effectsY, 
        rgba, 
        size * 2
    ));
    
    console.log('当前轨迹点数量:', trailPoints.length);
}

// 页面切换函数
function showPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    pages[pageName].classList.add('active');
}

function showHomePage() {
    showPage('home');
}

function showJoinRoomPage() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        showToast('请输入昵称', 'error');
        return;
    }
    gameState.playerName = playerName;
    showPage('joinRoom');
}

// 创建房间
function createRoom() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        showToast('请输入昵称', 'error');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.isHost = true;
    socket.emit('createRoom', playerName);
}

// 加入房间
function joinRoom() {
    const roomCode = document.getElementById('roomCodeInput').value.trim();
    if (!roomCode) {
        showToast('请输入房间码', 'error');
        return;
    }
    
    socket.emit('joinRoom', {
        roomCode: roomCode,
        playerName: gameState.playerName
    });
}

// 开始游戏
function startGame() {
    socket.emit('startGame');
}

// 离开房间
function leaveRoom() {
    resetGameState();
    showPage('home');
    showToast('已离开房间', 'info');
}

// 发送聊天/猜测
function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    // 画画的人不能发送消息，应该专注于绘画
    if (gameState.isDrawing) {
        return;
    }
    
    socket.emit('guess', message);
    input.value = '';
}

// 绘画函数
function startDrawing(e) {
    if (!gameState.isDrawing) return;
    
    const [currentX, currentY] = getMousePos(e);
    
    // 填充工具
    if (gameState.currentTool === 'fill') {
        floodFill(currentX, currentY, gameState.currentColor);
        return;
    }
    
    isDrawing = true;
    [lastX, lastY] = [currentX, currentY];
}

function draw(e) {
    if (!isDrawing || !gameState.isDrawing) return;
    
    const [currentX, currentY] = getMousePos(e);
    
    if (gameState.currentTool === 'eraser') {
        drawEraser(lastX, lastY, currentX, currentY);
    } else if (gameState.currentTool === 'brush') {
        drawBrush(lastX, lastY, currentX, currentY);
        // 添加画笔轨迹特效
        addBrushTrail(currentX, currentY, gameState.currentColor, gameState.brushSize);
    }
    
    [lastX, lastY] = [currentX, currentY];
}

function drawBrush(x0, y0, x1, y1) {
    ctx.globalCompositeOperation = 'source-over';
    
    if (gameState.currentShape === 'round') {
        ctx.strokeStyle = gameState.currentColor;
        ctx.lineWidth = gameState.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    } else if (gameState.currentShape === 'square') {
        ctx.fillStyle = gameState.currentColor;
        const size = gameState.brushSize;
        ctx.fillRect(x1 - size/2, y1 - size/2, size, size);
    } else if (gameState.currentShape === 'spray') {
        ctx.fillStyle = gameState.currentColor;
        const radius = gameState.brushSize * 2;
        const density = 20;
        
        for (let i = 0; i < density; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const sprayX = x1 + Math.cos(angle) * distance;
            const sprayY = y1 + Math.sin(angle) * distance;
            
            ctx.beginPath();
            ctx.arc(sprayX, sprayY, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // 发送绘画数据
    socket.emit('drawing', {
        x0: x0,
        y0: y0,
        x1: x1,
        y1: y1,
        color: gameState.currentColor,
        size: gameState.brushSize,
        tool: gameState.currentTool,
        shape: gameState.currentShape
    });
}

function drawEraser(x0, y0, x1, y1) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    
    // 发送橡皮擦数据
    socket.emit('drawing', {
        x0: x0,
        y0: y0,
        x1: x1,
        y1: y1,
        size: gameState.brushSize,
        tool: 'eraser'
    });
}

function floodFill(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const pixelIndex = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    
    // 获取目标颜色
    const targetColor = [
        pixels[pixelIndex],
        pixels[pixelIndex + 1],
        pixels[pixelIndex + 2],
        pixels[pixelIndex + 3]
    ];
    
    // 转换填充颜色
    const fillColorRgb = hexToRgb(fillColor);
    if (!fillColorRgb) return;
    
    const newColor = [fillColorRgb.r, fillColorRgb.g, fillColorRgb.b, 255];
    
    // 如果颜色相同，不需要填充
    if (colorsMatch(targetColor, newColor)) return;
    
    // 洪水填充算法
    const stack = [[Math.floor(x), Math.floor(y)]];
    const visited = new Set();
    
    while (stack.length > 0) {
        const [currentX, currentY] = stack.pop();
        const key = `${currentX},${currentY}`;
        
        if (visited.has(key)) continue;
        if (currentX < 0 || currentX >= canvas.width || currentY < 0 || currentY >= canvas.height) continue;
        
        const currentPixelIndex = (currentY * canvas.width + currentX) * 4;
        const currentPixelColor = [
            pixels[currentPixelIndex],
            pixels[currentPixelIndex + 1],
            pixels[currentPixelIndex + 2],
            pixels[currentPixelIndex + 3]
        ];
        
        if (!colorsMatch(currentPixelColor, targetColor)) continue;
        
        visited.add(key);
        
        // 设置新颜色
        pixels[currentPixelIndex] = newColor[0];
        pixels[currentPixelIndex + 1] = newColor[1];
        pixels[currentPixelIndex + 2] = newColor[2];
        pixels[currentPixelIndex + 3] = newColor[3];
        
        // 添加邻近像素到栈中
        stack.push([currentX + 1, currentY]);
        stack.push([currentX - 1, currentY]);
        stack.push([currentX, currentY + 1]);
        stack.push([currentX, currentY - 1]);
    }
    
    // 应用填充结果
    ctx.putImageData(imageData, 0, 0);
    
    // 发送填充数据
    socket.emit('drawing', {
        x0: x,
        y0: y,
        color: fillColor,
        tool: 'fill'
    });
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function colorsMatch(color1, color2) {
    return color1[0] === color2[0] && color1[1] === color2[1] && 
           color1[2] === color2[2] && color1[3] === color2[3];
}

function stopDrawing() {
    isDrawing = false;
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY
    ];
}

// 触摸事件处理
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    
    if (e.type === 'touchstart') {
        startDrawing(mouseEvent);
    } else if (e.type === 'touchmove') {
        draw(mouseEvent);
    }
}

// 清除画布
function clearCanvas() {
    if (!gameState.isDrawing) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas');
}

// 绘制接收到的线条
function drawLine(data) {
    if (data.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = data.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(data.x0, data.y0);
        ctx.lineTo(data.x1, data.y1);
        ctx.stroke();
        
        ctx.globalCompositeOperation = 'source-over';
    } else if (data.tool === 'fill') {
        const fillColorRgb = hexToRgb(data.color);
        if (fillColorRgb) {
            floodFillReceived(data.x0, data.y0, data.color);
        }
    } else if (data.tool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        
        if (data.shape === 'round') {
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(data.x0, data.y0);
            ctx.lineTo(data.x1, data.y1);
            ctx.stroke();
        } else if (data.shape === 'square') {
            ctx.fillStyle = data.color;
            const size = data.size;
            ctx.fillRect(data.x1 - size/2, data.y1 - size/2, size, size);
        } else if (data.shape === 'spray') {
            ctx.fillStyle = data.color;
            const radius = data.size * 2;
            const density = 20;
            
            for (let i = 0; i < density; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                const sprayX = data.x1 + Math.cos(angle) * distance;
                const sprayY = data.y1 + Math.sin(angle) * distance;
                
                ctx.beginPath();
                ctx.arc(sprayX, sprayY, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function floodFillReceived(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const pixelIndex = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    
    // 获取目标颜色
    const targetColor = [
        pixels[pixelIndex],
        pixels[pixelIndex + 1],
        pixels[pixelIndex + 2],
        pixels[pixelIndex + 3]
    ];
    
    // 转换填充颜色
    const fillColorRgb = hexToRgb(fillColor);
    if (!fillColorRgb) return;
    
    const newColor = [fillColorRgb.r, fillColorRgb.g, fillColorRgb.b, 255];
    
    // 如果颜色相同，不需要填充
    if (colorsMatch(targetColor, newColor)) return;
    
    // 洪水填充算法
    const stack = [[Math.floor(x), Math.floor(y)]];
    const visited = new Set();
    
    while (stack.length > 0) {
        const [currentX, currentY] = stack.pop();
        const key = `${currentX},${currentY}`;
        
        if (visited.has(key)) continue;
        if (currentX < 0 || currentX >= canvas.width || currentY < 0 || currentY >= canvas.height) continue;
        
        const currentPixelIndex = (currentY * canvas.width + currentX) * 4;
        const currentPixelColor = [
            pixels[currentPixelIndex],
            pixels[currentPixelIndex + 1],
            pixels[currentPixelIndex + 2],
            pixels[currentPixelIndex + 3]
        ];
        
        if (!colorsMatch(currentPixelColor, targetColor)) continue;
        
        visited.add(key);
        
        // 设置新颜色
        pixels[currentPixelIndex] = newColor[0];
        pixels[currentPixelIndex + 1] = newColor[1];
        pixels[currentPixelIndex + 2] = newColor[2];
        pixels[currentPixelIndex + 3] = newColor[3];
        
        // 添加邻近像素到栈中
        stack.push([currentX + 1, currentY]);
        stack.push([currentX - 1, currentY]);
        stack.push([currentX, currentY + 1]);
        stack.push([currentX, currentY - 1]);
    }
    
    // 应用填充结果
    ctx.putImageData(imageData, 0, 0);
}

// 添加聊天消息
function addChatMessage(data) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${data.isCorrect ? 'correct' : ''}`;
    
    if (data.isPrivateHint) {
        // 私人提示消息的特殊样式
        messageDiv.innerHTML = `<span class="message-player">🔮</span> ${data.message}`;
        messageDiv.classList.add('system');
        messageDiv.classList.add('private-hint');
    } else if (data.isSystem) {
        messageDiv.innerHTML = `<span class="message-player">📢</span> ${data.message}`;
        messageDiv.classList.add('system');
        messageDiv.classList.add('host-change');
    } else if (data.player) {
        messageDiv.innerHTML = `<span class="message-player">${data.player}:</span> ${data.message}`;
    } else {
        messageDiv.innerHTML = data.message;
        messageDiv.classList.add('system');
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 更新玩家列表
function updatePlayersList(data) {
    // 处理新的数据结构
    const players = data.players || data; // 兼容旧格式
    const hostId = data.host;
    
    const playersList = document.getElementById('playersList');
    const playersScores = document.getElementById('playersScores');
    
    // 更新房主状态
    if (hostId) {
        gameState.isHost = (socket.id === hostId);
    }
    
    // 等待房间的玩家列表
    playersList.innerHTML = '';
    console.log('更新玩家列表:', players, '房主ID:', hostId); // 调试信息
    players.forEach(([id, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        if (hostId && id === hostId) {
            playerDiv.classList.add('host');
            console.log('设置房主样式:', player.name); // 调试信息
        }
        playerDiv.textContent = player.name;
        playersList.appendChild(playerDiv);
        console.log('添加玩家卡片:', player.name); // 调试信息
    });
    
    // 游戏中的分数显示
    if (playersScores) {
        playersScores.innerHTML = '';
        players.forEach(([id, player]) => {
            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'score-card';
            scoreDiv.innerHTML = `${player.name}: ${player.score}分`;
            playersScores.appendChild(scoreDiv);
        });
    }
    
    // 更新开始游戏按钮显示
    const startGameBtn = document.getElementById('startGameBtn');
    if (gameState.isHost && players.length >= 2) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
    }
    
    // 获取房间设置
    socket.emit('getRoomSettings');
}

// 显示题目选择
function showTopicSelection(topics) {
    const topicSelection = document.getElementById('topicSelection');
    const topicOptions = document.getElementById('topicOptions');
    
    topicOptions.innerHTML = '';
    topics.forEach(topic => {
        const button = document.createElement('button');
        button.className = 'topic-option';
        button.textContent = topic;
        button.onclick = () => {
            socket.emit('chooseTopic', topic);
            topicSelection.style.display = 'none';
        };
        topicOptions.appendChild(button);
    });
    
    topicSelection.style.display = 'block';
}

// 控制聊天输入框状态
function updateChatInputState() {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    if (gameState.isDrawing) {
        chatInput.disabled = true;
        chatInput.placeholder = '你正在画画，请专注于绘画...';
        sendChatBtn.disabled = true;
        sendChatBtn.style.opacity = '0.5';
    } else {
        chatInput.disabled = false;
        chatInput.placeholder = '输入你的猜测或聊天信息...';
        sendChatBtn.disabled = false;
        sendChatBtn.style.opacity = '1';
    }
}

// 显示消息提示
function showToast(message, type = 'info') {
    const toast = document.getElementById('messageToast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 重置游戏状态
function resetGameState() {
    gameState.roomCode = '';
    gameState.isHost = false;
    gameState.isDrawing = false;
    gameState.currentTool = 'brush';
    gameState.currentShape = 'round';
    
    // 清理特效系统
    if (effectsCanvas && effectsCtx) {
        effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
    }
    trailPoints = [];
    fireworks = [];
    particles = [];
    console.log('特效系统已清理');
    
    // 清理游戏界面元素
    const topicDisplay = document.getElementById('topicDisplay');
    if (topicDisplay) {
        topicDisplay.style.display = 'none';
        topicDisplay.textContent = '';
    }
    
    const currentPlayerInfo = document.getElementById('currentPlayerInfo');
    if (currentPlayerInfo) {
        currentPlayerInfo.textContent = '';
    }
    
    const topicSelection = document.getElementById('topicSelection');
    if (topicSelection) {
        topicSelection.style.display = 'none';
    }
    
    const drawingTools = document.getElementById('drawingTools');
    if (drawingTools) {
        drawingTools.style.display = 'none';
    }
    
    // 清理画布
    const canvas = document.getElementById('drawingCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // 清理聊天消息
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // 重置工具按钮状态
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tool === 'brush') {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.shape === 'round') {
            btn.classList.add('active');
        }
    });
    
    // 重置画笔大小显示
    const brushSizeDisplay = document.getElementById('brushSizeDisplay');
    if (brushSizeDisplay) {
        brushSizeDisplay.textContent = '3';
    }
}

// 自定义题目功能
function addCustomTopic() {
    const input = document.getElementById('customTopicInput');
    const topic = input.value.trim();
    
    if (!topic) {
        showToast('请输入题目', 'error');
        return;
    }
    
    if (!gameState.isHost) {
        showToast('只有房主可以添加自定义题目', 'error');
        return;
    }
    
    socket.emit('addCustomTopic', topic);
    input.value = '';
}

function removeCustomTopic(topic) {
    if (!gameState.isHost) return;
    socket.emit('removeCustomTopic', topic);
}

function updateCustomTopicsList(topics) {
    const list = document.getElementById('customTopicsList');
    const count = document.getElementById('customTopicCount');
    
    list.innerHTML = '';
    count.textContent = topics.length;
    
    topics.forEach(topic => {
        const tag = document.createElement('div');
        tag.className = 'custom-topic-tag';
        tag.innerHTML = `
            <span>${topic}</span>
            ${gameState.isHost ? `<button class="remove-btn" onclick="removeCustomTopic('${topic}')">×</button>` : ''}
        `;
        list.appendChild(tag);
    });
}

function updateGameSettings(settings) {
    const gameSettings = document.getElementById('gameSettings');
    
    // 显示/隐藏设置面板
    if (settings.isHost && !gameState.gameStarted) {
        gameSettings.style.display = 'block';
    } else {
        gameSettings.style.display = 'none';
    }
    
    // 更新难度按钮
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.difficulty === settings.difficulty) {
            btn.classList.add('active');
        }
    });
    
    // 更新自定义题目列表
    updateCustomTopicsList(settings.customTopics);
}

// 显示特殊的全屏消息
function showSpecialMessage(message) {
    // 创建全屏覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'special-message-overlay';
    
    // 创建消息容器
    const messageContainer = document.createElement('div');
    messageContainer.className = 'special-message-container';
    
    // 创建消息内容
    const messageContent = document.createElement('div');
    messageContent.className = 'special-message-content';
    messageContent.innerHTML = `
        <div class="special-message-emoji">🥺</div>
        <div class="special-message-text">${message}</div>
        <div class="special-message-timer">5秒后返回主页...</div>
    `;
    
    messageContainer.appendChild(messageContent);
    overlay.appendChild(messageContainer);
    document.body.appendChild(overlay);
    
    // 倒计时动画
    let countdown = 5;
    const timer = messageContainer.querySelector('.special-message-timer');
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            timer.textContent = `${countdown}秒后返回主页...`;
        } else {
            timer.textContent = '正在返回主页...';
            clearInterval(countdownInterval);
        }
    }, 1000);
    
    // 2秒后移除覆盖层
    setTimeout(() => {
        overlay.remove();
        clearInterval(countdownInterval);
    }, 2000);
}

// Socket事件监听
socket.on('roomCreated', (data) => {
    gameState.roomCode = data.roomCode;
    document.getElementById('roomCodeDisplay').textContent = data.roomCode;
    showPage('waitingRoom');
    showToast(`房间创建成功！房间码: ${data.roomCode}`, 'success');
});

socket.on('roomJoined', (data) => {
    gameState.roomCode = data.roomCode;
    gameState.isHost = false;
    document.getElementById('roomCodeDisplay').textContent = data.roomCode;
    showPage('waitingRoom');
    showToast('成功加入房间！', 'success');
});

socket.on('playersUpdate', (players) => {
    updatePlayersList(players);
});

socket.on('gameStarted', () => {
    showPage('game');
    showToast('游戏开始！', 'success');
    updateChatInputState(); // 初始化聊天输入框状态
});

socket.on('chooseTopicOptions', (topics) => {
    showTopicSelection(topics);
});

socket.on('waitingForTopicChoice', (data) => {
    document.getElementById('currentPlayerInfo').textContent = `等待 ${data.drawer} 选择题目...`;
});

socket.on('topicChosen', (data) => {
    document.getElementById('currentPlayerInfo').textContent = `${data.drawer} 正在画: `;
    
    // 只有画画的人才能看到题目！！！
    const topicDisplay = document.getElementById('topicDisplay');
    if (gameState.isDrawing) {
        // 画画的人显示题目
        topicDisplay.textContent = data.topic;
        topicDisplay.style.display = 'inline-block';
    } else {
        // 其他人不显示题目
        topicDisplay.style.display = 'none';
    }
    
    addChatMessage({
        message: `${data.drawer} 开始绘画题目！大家快来猜猜看吧~`,
        isCorrect: false
    });
});

socket.on('startDrawing', (topic) => {
    gameState.isDrawing = true;
    document.getElementById('drawingTools').style.display = 'flex';
    document.getElementById('currentPlayerInfo').textContent = `你正在画: `;
    const topicDisplay = document.getElementById('topicDisplay');
    topicDisplay.textContent = topic;
    topicDisplay.style.display = 'inline-block';
    
    updateChatInputState(); // 禁用聊天输入框
    
    addChatMessage({
        message: `你的题目是"${topic}"，开始绘画吧！`,
        isCorrect: false
    });
});

socket.on('startGuessing', () => {
    gameState.isDrawing = false;
    document.getElementById('drawingTools').style.display = 'none';
    
    updateChatInputState(); // 启用聊天输入框
    
    addChatMessage({
        message: '开始猜词吧！在下方输入你的答案。',
        isCorrect: false
    });
});

socket.on('drawing', (data) => {
    drawLine(data);
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('message', (data) => {
    addChatMessage(data);
});

socket.on('correctGuess', (data) => {
    addChatMessage({
        message: `🎉 ${data.guesser} 猜对了！答案是"${data.topic}"`,
        isCorrect: true
    });
    
    // 触发烟花特效
    const canvasRect = canvas.getBoundingClientRect();
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;
    
    // 在画布中心创建烟花
    createFireworks(centerX, centerY, 5);
    
    // 在屏幕多个位置创建烟花
    setTimeout(() => {
        createFireworks(centerX - 100, centerY - 50, 2);
        createFireworks(centerX + 100, centerY - 50, 2);
    }, 300);
    
    setTimeout(() => {
        createFireworks(centerX - 50, centerY + 80, 2);
        createFireworks(centerX + 50, centerY + 80, 2);
    }, 600);
    
    // 显示下一轮提示
    setTimeout(() => {
        addChatMessage({
            message: `🎨 ${data.guesser} 猜对了，下一轮由 ${data.guesser} 来画！`,
            isCorrect: false,
            isSystem: true
        });
    }, 500);
    
    // 隐藏题目显示
    document.getElementById('topicDisplay').style.display = 'none';
    gameState.isDrawing = false;
    document.getElementById('drawingTools').style.display = 'none';
    
    updateChatInputState(); // 更新聊天输入框状态
});

socket.on('error', (message) => {
    showToast(message, 'error');
});

socket.on('returnToHome', (data) => {
    // 显示特殊的全屏消息
    showSpecialMessage(data.message);
    
    // 2秒后返回主页
    setTimeout(() => {
        showPage('home');
        showToast('已为你返回主页', 'info');
        // 重置游戏状态
        resetGameState();
    }, 2000);
});

socket.on('disconnect', () => {
    resetGameState();
    showPage('home');
    showToast('与服务器断开连接', 'error');
});

// 游戏设置相关事件
socket.on('roomSettings', (settings) => {
    updateGameSettings(settings);
});

socket.on('difficultyChanged', (data) => {
    showToast(`难度已设置为：${data.difficultyName}`, 'success');
    
    // 更新难度按钮状态
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.difficulty === data.difficulty) {
            btn.classList.add('active');
        }
    });
});

socket.on('customTopicAdded', (data) => {
    showToast(`已添加自定义题目：${data.topic}`, 'success');
    socket.emit('getRoomSettings'); // 刷新设置
});

socket.on('customTopicRemoved', (data) => {
    showToast(`已删除自定义题目：${data.topic}`, 'info');
    socket.emit('getRoomSettings'); // 刷新设置
});

// 处理私人提示消息
socket.on('privateHint', (data) => {
    addChatMessage({
        message: data.message,
        isCorrect: false,
        isSystem: true,
        isPrivateHint: true
    });
}); 