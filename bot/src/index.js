
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { WebSocket } from 'ws';
import config from '../../config.json' with { type: 'json' };
import { readdirSync } from 'fs';

const { botToken, adminRoles, guildId } = config;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();
const commandFiles = readdirSync('./src/commands').filter(file => file.endsWith('.js'));
console.log('Loading commands:', commandFiles);
for (const file of commandFiles) {
    const { default: command } = await import(`./commands/${file}`);
    console.log(`Loaded command: ${command.name}`);
    client.commands.set(command.name, command);
}

const eventFiles = readdirSync('./src/events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const { default: event } = await import(`./events/${file}`);
    client.on(event.name, (...args) => event.execute(...args, client));
}

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
    console.log('Bot connected to WebSocket server');
    ws.send(JSON.stringify({ type: 'bot' }));
});

ws.on('message', async (message) => {
    try {
        const { command, data, requestId } = JSON.parse(message);
        console.log('Received command from server:', command, data);
        let guild;

        switch (command) {
            case 'getRoleIds':
                await handleGetRoleIds(data, requestId);
                break;
            case 'getAdminRoles':
                await handleGetAdminRoles(requestId);
                break;
            case 'getMembers':
                await handleGetMembers(data, requestId);
                break;
            case 'addRole':
                await handleAddRole(data, requestId);
                break;
            case 'removeRole':
                await handleRemoveRole(data, requestId);
                break;
            case 'getRoles':
                await handleGetRoles(data, requestId);
                break;
            default:
                console.error('Unknown command:', command);
                ws.send(JSON.stringify({ command: 'error', data: 'Unknown command', requestId }));
        }
    } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ command: 'error', data: error.message, requestId }));
    }
});

ws.on('close', () => {
    console.log('Bot disconnected from WebSocket server');
});

ws.on('error', (err) => {
    console.error('WebSocket connection error:', err);
});

async function handleGetRoleIds(data, requestId) {
    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) {
        return sendError('Server not found', requestId);
    }

    try {
        const roleIds = {
            Moderator: config.roleIds.Moderator.map(id => id.toString()),
            Admin: config.roleIds.Admin.map(id => id.toString()),
            Streamer: config.roleIds.Streamer.map(id => id.toString())
        };

        console.log('Sending roleIds from config:', JSON.stringify(roleIds, null, 2));
        ws.send(JSON.stringify({ command: 'roleIds', data: roleIds, requestId }));
    } catch (error) {
        sendError('Error retrieving role IDs: ' + error.message, requestId);
    }
}

async function handleGetAdminRoles(requestId) {
    const adminRoles = config.adminRoles.map(role => ({
        id: role.id.toString(),
        name: role.name,
        dependencies: role.dependencies
    }));
    console.log('Sending admin roles:', JSON.stringify(adminRoles, null, 2));
    ws.send(JSON.stringify({ command: 'adminRoles', data: adminRoles, requestId }));
}

async function handleGetMembers(data, requestId) {
    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) {
        return sendError('Server not found', requestId);
    }

    try {
        const members = await guild.members.fetch();
        const memberList = members.map(member => ({
            id: member.id,
            name: member.user.username,
            roles: Array.from(member.roles.cache.values()).map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position
            }))
        }));

        console.log(`Loaded ${memberList.length} members`);
        ws.send(JSON.stringify({ command: 'members', data: memberList, requestId }));
    } catch (error) {
        sendError('Error retrieving members: ' + error.message, requestId);
    }
}

async function handleAddRole(data, requestId) {
    const { guildId: targetGuildId, userId: targetUserId, role: targetRole } = data;
    const guild = client.guilds.cache.get(targetGuildId);
    if (!guild) {
        return sendError('Server not found', requestId);
    }

    try {
        const targetMember = await guild.members.fetch(targetUserId);
        if (!targetMember) {
            return sendError('Member not found', requestId);
        }

        const targetRoleConfig = config.adminRoles.find(r => r.name === targetRole);
        if (!targetRoleConfig) {
            return sendError('Role not found in config', requestId);
        }

        const targetRoleObj = guild.roles.cache.find(r => r.name === targetRole);
        if (!targetRoleObj) {
            return sendError('Role not found on server', requestId);
        }

        await targetMember.roles.add(targetRoleObj);
        for (const depRole of targetRoleConfig.dependencies) {
            const depRoleObj = guild.roles.cache.find(r => r.name === depRole);
            if (depRoleObj) {
                await targetMember.roles.add(depRoleObj);
            }
        }

        ws.send(JSON.stringify({
            command: 'roleAdded',
            data: `Role ${targetRole} and its dependencies added to user ${targetMember.user.tag}`,
            requestId
        }));
    } catch (error) {
        sendError('Error adding role: ' + error.message, requestId);
    }
}

async function handleRemoveRole(data, requestId) {
    const { guildId, userId, role } = data;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        return sendError('Server not found', requestId);
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return sendError('Member not found', requestId);
        }

        const roleToRemove = guild.roles.cache.find(r => r.name === role);
        if (!roleToRemove) {
            return sendError(`Role "${role}" not found`, requestId);
        }

        if (!member.roles.cache.has(roleToRemove.id)) {
            return sendError(`Member does not have role "${role}"`, requestId);
        }

        await member.roles.remove(roleToRemove);

        if (role === 'Мод.состав') {
            const dependentRoles = config.adminRoles
                .filter(r => r.dependencies.includes('Мод.состав'))
                .map(r => guild.roles.cache.find(gr => gr.name === r.name))
                .filter(r => r && member.roles.cache.has(r.id));

            if (dependentRoles.length > 0) {
                await member.roles.remove(dependentRoles);
            }
        }

        ws.send(JSON.stringify({
            command: 'removeRole',
            data: {
                success: true,
                message: `Role "${role}" successfully removed from member ${member.user.tag}`
            },
            requestId
        }));
    } catch (error) {
        sendError(error.message, requestId);
    }
}

async function handleGetRoles(data, requestId) {
    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) {
        return sendError('Server not found', requestId);
    }

    try {
        const roles = guild.roles.cache
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position,
                permissions: role.permissions.toArray()
            }));

        ws.send(JSON.stringify({
            command: 'getRoles',
            requestId: requestId,
            data: roles
        }));
    } catch (error) {
        sendError(error.message, requestId);
    }
}

function sendError(message, requestId) {
    ws.send(JSON.stringify({
        command: 'error',
        data: message,
        requestId
    }));
}

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const guild = newMember.guild;

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    if (oldRoles.size !== newRoles.size || !oldRoles.every((role, id) => newRoles.has(id))) {
        console.log(`Member roles changed for ${newMember.user.tag}, checking dependencies`);
        await checkDependencies(newMember, guild);
    }
});

client.once('ready', async () => {
    console.log('Bot is ready!');
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.error('Server not found in cache. Server ID:', guildId);
            console.error('Available servers:', Array.from(client.guilds.cache.keys()));
            return;
        }
        console.log('Server found:', guild.name);

        const members = await guild.members.fetch();
        console.log(`Successfully loaded ${members.size} members on startup`);
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

client.login(botToken);
