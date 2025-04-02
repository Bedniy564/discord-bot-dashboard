const express = require('express');
const router = express.Router();
const { sendCommandToBot } = require('../websocket');
const config = require('../../../config.json');
const { guildId } = config;

let members = [];

function updateMembers(newMembers) {
    members = newMembers;
}

router.get('/', (req, res) => {
    sendCommandToBot('getMembers', { guildId });

    setTimeout(() => {
        res.json(members);
    }, 1000);
});

function handleBotMessage(data) {
    if (data.command === 'members') {
        updateMembers(data.data);
    }
}

module.exports = { router, handleBotMessage };