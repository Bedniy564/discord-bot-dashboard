// bot\src\commands\ban.js
export default {
    name: 'ban',
    execute(message, args, client) {
        console.log('Команда ban выполняется');
        console.log('Аргументы:', args);

        // Извлекаем ID из упоминания или берём напрямую из аргумента
        let userId = args[0];
        if (!userId) {
            console.log('Пользователь не указан');
            return message.reply('Укажи пользователя!');
        }

        // Если аргумент — это упоминание (например, <@123>), извлекаем ID
        if (userId.startsWith('<@') && userId.endsWith('>')) {
            userId = userId.slice(2, -1);
            if (userId.startsWith('!')) {
                userId = userId.slice(1);
            }
        }

        // Пробуем найти пользователя через упоминание
        let user = message.mentions.users.first();
        if (!user) {
            // Если упоминание не найдено, пробуем получить пользователя по ID
            console.log('Пользователь не найден через упоминание, пробуем по ID:', userId);
            client.users.fetch(userId)
                .then(fetchedUser => {
                    user = fetchedUser;
                    proceedWithBan(user, userId, message, client);
                })
                .catch(err => {
                    console.error('Ошибка получения пользователя по ID:', err);
                    message.reply('Не удалось найти пользователя!');
                });
        } else {
            proceedWithBan(user, userId, message, client);
        }
    }
};

// Выносим логику бана в отдельную функцию для удобства
function proceedWithBan(user, userId, message, client) {
    if (!user) {
        console.log('Пользователь не найден');
        return message.reply('Пользователь не найден!');
    }

    const member = message.guild.members.cache.get(user.id);
    console.log('Участник:', member);
    if (!member) {
        // Если участник не найден в кэше, пробуем забанить по ID
        console.log('Участник не найден в кэше, баним по ID');
        message.guild.members.ban(userId)
            .then(() => {
                console.log(`Пользователь ${user.tag || userId} забанен`);
                message.reply(`${user.tag || userId} забанен!`);
                fetch('http://localhost:3000/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'ban', user: user.tag || userId, moderator: message.author.tag })
                })
                    .then(res => res.text())
                    .then(result => console.log('Лог отправлен:', result))
                    .catch(err => console.error('Ошибка при отправке лога:', err));
            })
            .catch(err => {
                console.error('Ошибка бана:', err);
                message.reply('Не удалось забанить: ' + err);
            });
        return;
    }

    member.ban()
        .then(() => {
            console.log(`Пользователь ${user.tag} забанен`);
            message.reply(`${user.tag} забанен!`);
            fetch('http://localhost:3000/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ban', user: user.tag, moderator: message.author.tag })
            })
                .then(res => res.text())
                .then(result => console.log('Лог отправлен:', result))
                .catch(err => console.error('Ошибка при отправке лога:', err));
        })
        .catch(err => {
            console.error('Ошибка бана:', err);
            message.reply('Не удалось забанить: ' + err);
        });
}