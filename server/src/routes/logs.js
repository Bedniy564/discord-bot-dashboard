const express = require('express');
const router = express.Router();

const logs = [
    { action: 'Бан', user: 'User1#1234', moderator: 'Mod1#5678', duration: '1d' },
    { action: 'Мут', user: 'User2#2345', moderator: 'Mod2#6789', duration: '2h' }
];

router.get('/', (req, res) => {
    res.json(logs);
});

module.exports = router;