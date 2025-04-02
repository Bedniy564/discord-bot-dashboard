const { WebSocketServer } = require('ws');

let botClient = null;

function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('WebSocket-клиент подключился');
        botClient = ws;

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            console.log('Получено сообщение от бота:', data);
            // Вызываем обработчик сообщений из members.js
            const { handleBotMessage } = require('./routes/members');
            handleBotMessage(data);
        });

        ws.on('close', () => {
            console.log('WebSocket-клиент отключился');
            botClient = null;
        });
    });
}

function sendCommandToBot(command, data) {
    if (botClient && botClient.readyState === botClient.OPEN) {
        botClient.send(JSON.stringify({ command, data }));
    } else {
        console.error('Бот не подключен к WebSocket');
    }
}

module.exports = { setupWebSocket, sendCommandToBot };