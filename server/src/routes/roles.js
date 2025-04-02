// server\src/routes/roles.js
const express = require('express');
const router = express.Router();
const { sendCommandToBot } = require('../websocket');
const config = require('../../../config.json');
const { guildId } = config;

if (!config || !config.guildId) {
  throw new Error('Конфигурация сервера не загружена или неверна');
}

router.get('/ids', async (req, res) => {
  try {
    // Проверяем подключение бота
    if (!botWs) {
      return res.status(503).json({ error: 'Бот не подключен' });
    }

    // Добавляем валидацию данных
    const roleIds = {
      Moderator: config.roleIds.Moderator?.map(id => id.toString()) || [],
      Admin: config.roleIds.Admin?.map(id => id.toString()) || [],
      Streamer: config.roleIds.Streamer?.map(id => id.toString()) || []
    };

    if (roleIds.Admin.length === 0) {
      console.warn('В конфиге нет админских ролей');
    }

    res.json(roleIds);
  } catch (err) {
    console.error('Ошибка получения ID ролей:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/add', (req, res) => {
    const { userId, role } = req.body;
    sendCommandToBot('addRole', { guildId, userId, role });

    setTimeout(() => {
        res.send(`Роль ${role} добавлена пользователю ${userId}`);
    }, 1000);
});

router.post('/remove', (req, res) => {
    const { userId, role } = req.body;
    sendCommandToBot('removeRole', { guildId, userId, role });

    setTimeout(() => {
        res.send(`Роль ${role} удалена у пользователя ${userId}`);
    }, 1000);
});

module.exports = router;