const fs = require('fs');

const userDataFile = './userData.json';
let userData = {};

if (fs.existsSync(userDataFile)) {
    userData = JSON.parse(fs.readFileSync(userDataFile));
}

function saveUserData() {
    fs.writeFileSync(userDataFile, JSON.stringify(userData, null, 2));
}

module.exports = {
    getUserData: (userId) => userData[userId] || { status: 'Активен', notes: 'Активен, отвечает за ивенты' },
    setUserStatus: (userId, status) => {
        if (!userData[userId]) userData[userId] = {};
        userData[userId].status = status;
        saveUserData();
    },
    setUserNotes: (userId, notes) => {
        if (!userData[userId]) userData[userId] = {};
        userData[userId].notes = notes;
        saveUserData();
    }
};