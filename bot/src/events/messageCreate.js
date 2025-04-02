// bot\src\events\messageCreate.js
export default {
    name: 'messageCreate',
    execute(message, client) {
        console.log(`Получено сообщение: ${message.content} от ${message.author.tag}`);
        const prefix = '!';
        console.log(`Проверка префикса: ${message.content.startsWith(prefix)}, Автор бот: ${message.author.bot}`);
        if (!message.content.startsWith(prefix) || message.author.bot) {
            console.log('Сообщение не начинается с префикса или отправлено ботом');
            return;
        }
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        console.log(`Команда: ${commandName}, Аргументы: ${args}`);
        const command = client.commands.get(commandName);
        if (command) {
            console.log(`Выполняется команда: ${commandName}`);
            command.execute(message, args, client);
        } else {
            console.log(`Команда ${commandName} не найдена`);
        }
    }
};