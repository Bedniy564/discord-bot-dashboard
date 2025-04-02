// bot\src\commands\mute.js
export default {
    name: 'mute',
    execute(message, args, client) {
        console.log('Команда mute выполняется');
        console.log('Аргументы:', args);

        // Извлекаем ID пользователя
        let userId = args[0];
        if (!userId) {
            console.log('Пользователь не указан');
            return message.reply('Укажи пользователя! (Пример: !mute @user 5m)');
        }

        // Извлекаем длительность (например, 5m, 1h)
        const duration = args[1];
        if (!duration) {
            console.log('Длительность не указана');
            return message.reply('Укажи длительность! (Пример: !mute @user 5m)');
        }

        // Парсим длительность
        const timeUnit = duration.slice(-1); // Последний символ: m, h, d
        const timeValue = parseInt(duration.slice(0, -1)); // Числовое значение
        let milliseconds;
        if (timeUnit === 'm') milliseconds = timeValue * 60 * 1000; // Минуты
        else if (timeUnit === 'h') milliseconds = timeValue * 60 * 60 * 1000; // Часы
        else if (timeUnit === 'd') milliseconds = timeValue * 24 * 60 * 60 * 1000; // Дни
        else {
            return message.reply('Неправильный формат времени! Используй m (минуты), h (часы) или d (дни).');
        }

        // Извлекаем ID из упоминания
        if (userId.startsWith('<@') && userId.endsWith('>')) {
            userId = userId.slice(2, -1);
            if (userId.startsWith('!')) {
                userId = userId.slice(1);
            }
        }

        // Пробуем найти пользователя
        let user = message.mentions.users.first();
        if (!user) {
            console.log('Пользователь не найден через упоминание, пробуем по ID:', userId);
            client.users.fetch(userId)
                .then(fetchedUser => {
                    user = fetchedUser;
                    proceedWithMute(user, userId, message, client, milliseconds, duration);
                })
                .catch(err => {
                    console.error('Ошибка получения пользователя по ID:', err);
                    message.reply('Не удалось найти пользователя!');
                });
        } else {
            proceedWithMute(user, userId, message, client, milliseconds, duration);
        }
    }
};

function proceedWithMute(user, userId, message, client, milliseconds, duration) {
    if (!user) {
        console.log('Пользователь не найден');
        return message.reply('Пользователь не найден!');
    }

    const member = message.guild.members.cache.get(user.id);
    if (!member) {
        console.log('Участник не найден');
        return message.reply('Участник не найден на сервере!');
    }

    // Применяем мьют (тайм-аут)
    member.timeout(milliseconds)
        .then(() => {
            console.log(`Пользователь ${user.tag} замьючен на ${duration}`);
            message.reply(`${user.tag} замьючен на ${duration}!`);
            fetch('http://localhost:3000/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mute', user: user.tag, moderator: message.author.tag, duration })
            })
                .then(res => res.text())
                .then(result => console.log('Лог отправлен:', result))
                .catch(err => console.error('Ошибка при отправке лога:', err));
        })
        .catch(err => {
            console.error('Ошибка мьюта:', err);
            message.reply('Не удалось замьютить: ' + err);
        });
}