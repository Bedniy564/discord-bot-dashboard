const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const config = require('../../config.json');
const { guildId } = config;

const app = express();

// Настройка Express
const publicPath = path.join(__dirname, '../../web/public');
console.log('Путь к статическим файлам:', publicPath);
app.use(express.static(publicPath));
app.use(express.json());

// Добавляем middleware для логирования запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Создаём WebSocket-сервер на порту 3001
const wss = new WebSocketServer({ port: 3001 });
console.log('WebSocket-сервер запущен на порту 3001');

// Храним подключённого бота
let botWs = null;

// Храним ожидающие запросы (для маршрутов API)
const pendingRequests = new Map();

wss.on('connection', (ws) => {
    console.log('Клиент подключился к WebSocket-серверу');

    // Определяем, является ли клиент ботом
    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message.toString());
        const { type, command, data, requestId } = parsedMessage;

        if (type === 'bot') {
            console.log('Бот подключился к WebSocket-серверу');
            botWs = ws; // Сохраняем подключение бота
        } else if (command === 'members') {
            // Обрабатываем ответ с участниками
            console.log(`Получен список ${data.length} участников от бота`);
            const firstMember = data[0];
            console.log('Пример участника с ролями:', JSON.stringify(firstMember, null, 2));
            
            if (requestId && pendingRequests.has(requestId)) {
                const { resolve } = pendingRequests.get(requestId);
                // Убеждаемся, что все данные правильно сериализованы
                const serializedData = data.map(member => {
                    // Проверяем наличие ролей и их формат
                    const roles = Array.isArray(member.roles) ? member.roles : [];
                    console.log(`\nОбработка ролей для ${member.name}:`);
                    console.log('Исходные роли:', JSON.stringify(roles, null, 2));
                    
                    const processedRoles = roles.map(role => {
                        const processedRole = {
                            id: role.id.toString(),
                            name: role.name || '',
                            color: role.color || 0,
                            position: role.position || 0
                        };
                        console.log(`Обработанная роль: ${JSON.stringify(processedRole)}`);
                        return processedRole;
                    });
                    
                    const result = {
                        ...member,
                        roles: processedRoles
                    };
                    
                    console.log(`Результат обработки для ${member.name}:`, JSON.stringify(result, null, 2));
                    return result;
                });
                
                console.log('Отправляем обработанные данные клиенту');
                resolve(serializedData);
                pendingRequests.delete(requestId);
            }
        } else if (command === 'roleIds') {
            // Обрабатываем ответ с ID ролей
            console.log('Получены ID ролей от бота:', JSON.stringify(data, null, 2));
            
            // Преобразуем все ID в строки
            const processedRoleIds = {
                Moderator: data.Moderator.map(id => id.toString()),
                Admin: data.Admin.map(id => id.toString()),
                Streamer: data.Streamer.map(id => id.toString())
            };
            
            console.log('Обработанные ID ролей:', JSON.stringify(processedRoleIds, null, 2));
            
            if (requestId && pendingRequests.has(requestId)) {
                const { resolve } = pendingRequests.get(requestId);
                resolve(processedRoleIds);
                pendingRequests.delete(requestId);
            }
        } else if (command === 'error') {
            if (requestId && pendingRequests.has(requestId)) {
                const { reject } = pendingRequests.get(requestId);
                reject(new Error(data));
                pendingRequests.delete(requestId);
            }
        } else if (requestId && pendingRequests.has(requestId)) {
            // Обрабатываем другие ответы от бота
            const { resolve } = pendingRequests.get(requestId);
            resolve(data);
            pendingRequests.delete(requestId);
        }
    });

    ws.on('close', () => {
        console.log('Клиент отключился от WebSocket-сервера');
        if (ws === botWs) {
            botWs = null;
            console.log('Бот отключился от WebSocket-сервера');
            // Отклоняем все ожидающие запросы
            pendingRequests.forEach(({ reject }) => reject(new Error('Бот отключён')));
            pendingRequests.clear();
        }
    });

    ws.on('error', (err) => {
        console.error('Ошибка WebSocket:', err);
    });
});

// Функция для отправки команды боту и ожидания ответа
function sendCommandToBot(command, data) {
    return new Promise((resolve, reject) => {
        if (!botWs) {
            reject(new Error('Бот не подключён к WebSocket-серверу'));
            return;
        }

        const requestId = Date.now().toString() + Math.random().toString(36).substring(2);
        pendingRequests.set(requestId, { resolve, reject });

        botWs.send(JSON.stringify({ command, data, requestId }));
    });
}

// API для получения списка участников
app.get('/api/members', async (req, res) => {
    try {
        console.log('Получен запрос на получение списка участников');
        const members = await sendCommandToBot('getMembers', { guildId });
        console.log(`Получено ${members.length} участников от бота`);
        
        // Проверяем и преобразуем данные
        const processedMembers = members.map(member => {
            console.log(`\nОбработка участника ${member.name}:`);
            
            // Проверяем наличие ролей
            if (!Array.isArray(member.roles)) {
                console.error(`- Некорректные роли у участника:`, member.roles);
                member.roles = [];
            }
            
            // Преобразуем ID в строки
            const processedMember = {
                ...member,
                id: member.id.toString(),
                roles: member.roles.map(role => ({
                    ...role,
                    id: role.id.toString()
                }))
            };
            
            console.log('- ID:', processedMember.id);
            console.log('- Роли:', processedMember.roles.map(r => `${r.name} (${r.id})`));
            
            return processedMember;
        });
        
        console.log(`\nОтправляем ${processedMembers.length} участников клиенту`);
        console.log('Пример первого участника:', JSON.stringify(processedMembers[0], null, 2));
        
        res.json(processedMembers);
    } catch (err) {
        console.error('Ошибка при получении участников:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// API для получения ID ролей
app.get('/api/roles/ids', async (req, res) => {
    try {
        console.log('Получен запрос на получение ID ролей');
        const roleIds = await sendCommandToBot('getRoleIds', { guildId });
        console.log('Отправляем ID ролей клиенту:', JSON.stringify(roleIds, null, 2));
        res.json(roleIds);
    } catch (err) {
        console.error('Ошибка при получении ID ролей:', err.message);
        res.status(500).send(err.message);
    }
});

// API для получения списка админских ролей
app.get('/api/roles/admin', async (req, res) => {
    try {
        const adminRoles = await sendCommandToBot('getAdminRoles', { guildId });
        res.json(adminRoles);
    } catch (err) {
        console.error('Ошибка при получении админских ролей:', err.message);
        res.status(500).send(err.message);
    }
});

// Эндпоинт для удаления роли
app.post('/api/roles/delete', async (req, res) => {
    const { userId } = req.body;
    try {
        const members = await sendCommandToBot('getMembers', { guildId: config.guildId });
        const member = members.find(m => m.id === userId);
        if (!member) {
            throw new Error('Участник не найден');
        }

        // Находим роль для удаления
        const roleToDelete = member.roles.find(role => 
            config.roleIds.Moderator.includes(role.id.toString()) || 
            config.roleIds.Admin.includes(role.id.toString())
        );

        if (!roleToDelete) {
            throw new Error('У участника нет роли для удаления');
        }

        // Удаляем роль
        const response = await sendCommandToBot('removeRole', { 
            guildId: config.guildId, 
            userId,
            role: roleToDelete.name
        });
        res.json(response);
    } catch (error) {
        console.error('Ошибка при удалении роли:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для добавления роли
app.post('/api/roles/add', async (req, res) => {
    const { userId } = req.body;
    try {
        const members = await sendCommandToBot('getMembers', { guildId: config.guildId });
        const member = members.find(m => m.id === userId);
        if (!member) {
            throw new Error('Участник не найден');
        }

        // Находим следующую роль для добавления
        const currentRole = member.roles.find(role => 
            config.roleIds.Moderator.includes(role.id.toString()) || 
            config.roleIds.Admin.includes(role.id.toString())
        );

        if (!currentRole) {
            // Если нет текущей роли, добавляем начальную
            const response = await sendCommandToBot('addRole', { 
                guildId: config.guildId, 
                userId,
                role: 'Стажёр'
            });
            res.json(response);
            return;
        }

        // Находим текущую роль в иерархии
        const currentRoleIndex = config.adminRoles.findIndex(r => r.name === currentRole.name);
        if (currentRoleIndex >= config.adminRoles.length - 1) {
            throw new Error('Невозможно добавить роль выше');
        }

        // Добавляем следующую роль
        const nextRole = config.adminRoles[currentRoleIndex + 1];
        const response = await sendCommandToBot('addRole', { 
            guildId: config.guildId, 
            userId,
            role: nextRole.name
        });
        res.json(response);
    } catch (error) {
        console.error('Ошибка при добавлении роли:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для получения модераторов
app.get('/api/members/moderators', async (req, res) => {
    try {
        const members = await sendCommandToBot('getMembers', { guildId });
        
        // Фильтруем только модераторов
        const moderators = members.filter(member => {
            if (!Array.isArray(member.roles)) {
                return false;
            }
            return member.roles.some(role => config.roleIds.Moderator.includes(role.id.toString()));
        });
        
        // Преобразуем данные
        const processedModerators = moderators.map(member => ({
            ...member,
            id: member.id.toString(),
            roles: member.roles.map(role => ({
                ...role,
                id: role.id.toString()
            }))
        }));
        
        res.json(processedModerators);
    } catch (err) {
        console.error('Ошибка при получении модераторов:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Эндпоинт для получения администраторов
app.get('/api/members/admins', async (req, res) => {
    try {
        const members = await sendCommandToBot('getMembers', { guildId });
        
        // Фильтруем только администраторов
        const admins = members.filter(member => {
            if (!Array.isArray(member.roles)) {
                return false;
            }
            return member.roles.some(role => config.roleIds.Admin.includes(role.id.toString()));
        });
        
        // Преобразуем данные
        const processedAdmins = admins.map(member => ({
            ...member,
            id: member.id.toString(),
            roles: member.roles.map(role => ({
                ...role,
                id: role.id.toString()
            }))
        }));
        
        res.json(processedAdmins);
    } catch (err) {
        console.error('Ошибка при получении администраторов:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Эндпоинт для назначения роли
app.post('/api/roles/assign', async (req, res) => {
    const { userId } = req.body;
    try {
        const response = await sendCommandToBot('addRole', { 
            guildId: config.guildId, 
            userId,
            role: 'Стажёр' // Начальная роль для новых администраторов
        });
        res.json(response);
    } catch (error) {
        console.error('Ошибка при назначении роли:', error);
        res.status(500).json({ error: 'Ошибка при назначении роли' });
    }
});

// Эндпоинт для понижения роли
app.post('/api/roles/demote', async (req, res) => {
    const { userId } = req.body;
    try {
        const members = await sendCommandToBot('getMembers', { guildId: config.guildId });
        const member = members.find(m => m.id === userId);
        if (!member) {
            throw new Error('Участник не найден');
        }

        const adminRole = member.roles.find(role => config.roleIds.Admin.includes(role.id));
        if (!adminRole) {
            throw new Error('У участника нет административной роли');
        }

        // Находим текущую роль в иерархии
        const currentRoleIndex = config.adminRoles.findIndex(r => r.name === adminRole.name);
        if (currentRoleIndex <= 0) {
            throw new Error('Невозможно понизить роль');
        }

        // Понижаем на одну ступень
        const newRole = config.adminRoles[currentRoleIndex - 1];
        
        // Сначала снимаем текущую роль
        await sendCommandToBot('removeRole', { 
            guildId: config.guildId, 
            userId,
            role: adminRole.name
        });

        // Затем назначаем новую
        const response = await sendCommandToBot('addRole', { 
            guildId: config.guildId, 
            userId,
            role: newRole.name
        });
        res.json(response);
    } catch (error) {
        console.error('Ошибка при понижении роли:', error);
        res.status(500).json({ error: 'Ошибка при понижении роли' });
    }
});

// Эндпоинт для повышения роли
app.post('/api/roles/promote', async (req, res) => {
    const { userId } = req.body;
    try {
        const members = await sendCommandToBot('getMembers', { guildId: config.guildId });
        const member = members.find(m => m.id === userId);
        if (!member) {
            throw new Error('Участник не найден');
        }

        const adminRole = member.roles.find(role => config.roleIds.Admin.includes(role.id));
        if (!adminRole) {
            throw new Error('У участника нет административной роли');
        }

        // Находим текущую роль в иерархии
        const currentRoleIndex = config.adminRoles.findIndex(r => r.name === adminRole.name);
        if (currentRoleIndex >= config.adminRoles.length - 1) {
            throw new Error('Невозможно повысить роль');
        }

        // Повышаем на одну ступень
        const newRole = config.adminRoles[currentRoleIndex + 1];
        
        // Сначала снимаем текущую роль
        await sendCommandToBot('removeRole', { 
            guildId: config.guildId, 
            userId,
            role: adminRole.name
        });

        // Затем назначаем новую
        const response = await sendCommandToBot('addRole', { 
            guildId: config.guildId, 
            userId,
            role: newRole.name
        });
        res.json(response);
    } catch (error) {
        console.error('Ошибка при повышении роли:', error);
        res.status(500).json({ error: 'Ошибка при повышении роли' });
    }
});

// Эндпоинт для получения всех ролей сервера
app.get('/api/roles/all', async (req, res) => {
    try {
        const response = await sendCommandToBot('getRoles', { guildId: config.guildId });
        
        // Добавляем информацию о зависимостях из конфига
        const rolesWithDeps = response.map(role => {
            const configRole = config.adminRoles.find(r => r.id === role.id);
            return {
                ...role,
                id: role.id.toString(),
                dependencies: configRole ? configRole.dependencies : []
            };
        });

        res.json(rolesWithDeps);
    } catch (error) {
        console.error('Ошибка при получении ролей:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для удаления конкретной роли
app.post('/api/roles/remove-specific', async (req, res) => {
    const { userId, roleName } = req.body;
    try {
        const members = await sendCommandToBot('getMembers', { guildId: config.guildId });
        const member = members.find(m => m.id === userId);
        if (!member) {
            throw new Error('Участник не найден');
        }

        // Проверяем, есть ли у пользователя эта роль
        const roleToRemove = member.roles.find(role => role.name === roleName);
        if (!roleToRemove) {
            throw new Error('У участника нет указанной роли');
        }

        // Удаляем только указанную роль
        const response = await sendCommandToBot('removeRole', { 
            guildId: config.guildId, 
            userId,
            role: roleName
        });
        res.json(response);
    } catch (error) {
        console.error('Ошибка при удалении роли:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для получения конфигурации
app.get('/api/config', (req, res) => {
    // Отправляем только необходимые поля конфигурации
    const safeConfig = {
        adminRoles: config.adminRoles,
        roleIds: config.roleIds
    };
    res.json(safeConfig);
});

// Эндпоинт для снятия роли
app.post('/api/roles/remove', async (req, res) => {
    const { userId, role } = req.body;
    try {
        if (!userId) {
            throw new Error('ID пользователя не указан');
        }
        if (!role) {
            throw new Error('Роль не указана');
        }

        const response = await sendCommandToBot('removeRole', { 
            guildId: config.guildId, 
            userId,
            role
        });

        res.json({ message: 'Роль успешно снята', response });
    } catch (error) {
        console.error('Ошибка при снятии роли:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Express-сервер запущен на порту 3000');
});