const express = require('express');
const router = express.Router();
const { sendCommandToBot } = require('../websocket');
const config = require('../../../config.json');
const { guildId } = config;

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