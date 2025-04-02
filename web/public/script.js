// web\public/script.js
let allMembers = [];
let roleIds = null;
let adminRoles = null;
let config = null; // Добавляем переменную для конфигурации

// Глобальные переменные для хранения ролей
let allServerRoles = [];
let memberRoles = new Map(); // userId -> roles

console.log('Скрипт начал выполнение');

// Функция для проверки подключения бота
async function waitForBotConnection(maxAttempts = 5) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Попытка ${attempt}/${maxAttempts} проверки подключения бота...`);
            const response = await fetch('/api/roles/ids');
            if (response.ok) {
                console.log('Бот подключен и готов к работе');
                const data = await response.json();
                
                // Сразу обрабатываем полученные роли
                if (!data || !data.Admin || !Array.isArray(data.Admin)) {
                    throw new Error('Некорректный формат данных ID ролей');
                }
                
                // Преобразуем все ID в строки
                roleIds = {
                    Moderator: data.Moderator.map(id => id.toString()),
                    Admin: data.Admin.map(id => id.toString()),
                    Streamer: data.Streamer.map(id => id.toString())
                };
                
                console.log('Role IDs получены:', JSON.stringify(roleIds, null, 2));
                return true;
            }
            console.log('Бот еще не подключен, ожидаем...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
        } catch (err) {
            console.log('Ошибка при проверке подключения:', err);
            if (attempt === maxAttempts) {
                throw new Error('Не удалось подключиться к боту после нескольких попыток');
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return false;
}

async function loadRoleIds() {
    try {
        console.log('Начинаем загрузку ID ролей...');
        const response = await fetch('/api/roles/ids');
        console.log('Получен ответ от /api/roles/ids:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Получены сырые данные ID ролей:', JSON.stringify(data, null, 2));
        
        // Проверяем формат данных
        if (!data || !data.Admin || !Array.isArray(data.Admin)) {
            throw new Error('Некорректный формат данных ID ролей');
        }
        
        // Преобразуем все ID в строки
        roleIds = {
            Moderator: data.Moderator.map(id => id.toString()),
            Admin: data.Admin.map(id => id.toString()),
            Streamer: data.Streamer.map(id => id.toString())
        };
        
        console.log('Role IDs после преобразования:', JSON.stringify(roleIds, null, 2));
        console.log('ID ролей администраторов:', roleIds.Admin);
        
        // Проверяем наличие админских ролей
        if (roleIds.Admin.length === 0) {
            console.warn('Список админских ролей пуст!');
        } else {
            console.log(`Найдено ${roleIds.Admin.length} админских ролей`);
        }
        
        return roleIds;
    } catch (err) {
        console.error('Ошибка загрузки roleIds:', err);
        roleIds = null;
        throw err;
    }
}

async function loadAdminRoles() {
    try {
        const response = await fetch('/api/roles/admin');
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
        }
        adminRoles = await response.json();
        console.log('Admin Roles загружены:', adminRoles);
    } catch (err) {
        console.error('Ошибка загрузки adminRoles:', err);
        adminRoles = null;
    }
}

async function loadMembers() {
  try {
    console.log('Загрузка участников...');
    const response = await fetch('/api/members/admins');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Валидация данных
    if (!Array.isArray(data)) {
      throw new Error('Ожидался массив участников');
    }

    // Обработка каждого участника
    allMembers = data.map(member => {
      if (!member?.id) {
        console.warn('Участник без ID:', member);
        return null;
      }

      return {
        id: member.id.toString(),
        name: member.name || 'Unknown',
        roles: (Array.isArray(member.roles) ? member.roles : []).map(role => ({
          id: role?.id?.toString() || '',
          name: role?.name || ''
        }))
      };
    }).filter(Boolean);

    console.log(`Успешно загружено ${allMembers.length} участников`);
    return allMembers;
  } catch (err) {
    console.error('Ошибка загрузки участников:', err);
    showNotification('Не удалось загрузить участников', 'error');
    return [];
  }
}

// Функции для управления ролями
async function addRole(userId) {
    const button = event.target;
    try {
        button.classList.add('loading');
        button.disabled = true;

        const response = await fetch('/api/roles/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при добавлении роли');
        }
        
        showNotification('Роль успешно добавлена', 'success');
        await updateData(); // Обновляем данные после действия
    } catch (error) {
        console.error('Ошибка при добавлении роли:', error);
        showNotification('Ошибка при добавлении роли', 'error');
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

async function removeRole(userId) {
    const button = event.target;
    try {
        button.classList.add('loading');
        button.disabled = true;

        const response = await fetch('/api/roles/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId,
                role: 'Мод.состав'
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Ошибка при снятии роли');
        }
        
        showNotification('Роль успешно снята', 'success');
        await updateData();
    } catch (error) {
        console.error('Ошибка при снятии роли:', error);
        showNotification(error.message || 'Ошибка при снятии роли', 'error');
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Функция отображения участников (общая для админов и модераторов)
function displayMembers(members, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Элемент ${containerId} не найден`);
        return;
    }

    container.innerHTML = '';
    
    if (!members || members.length === 0) {
        container.innerHTML = '<div class="member-item">Список участников пуст</div>';
        return;
    }

    members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-item';
        
        const nameSpan = document.createElement('span');
        const currentRole = member.roles.find(role => 
            roleIds.Admin.includes(role.id.toString()) || 
            roleIds.Moderator.includes(role.id.toString())
        );
        nameSpan.textContent = `${member.name}${currentRole ? ` - ${currentRole.name}` : ''}`;
        memberDiv.appendChild(nameSpan);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';

        // Кнопка "Назначить" с выпадающим списком
        const assignButton = document.createElement('button');
        assignButton.textContent = 'Назначить';
        assignButton.className = 'assign-button';
        assignButton.onclick = () => showRoleAssignDialog(member.id);

        // Кнопка "Снять"
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Снять';
        removeButton.className = 'remove-button';
        removeButton.onclick = () => removeRole(member.id);

        // Кнопка "Убрать" с выпадающим списком
        const removeSpecificButton = document.createElement('button');
        removeSpecificButton.textContent = 'Убрать';
        removeSpecificButton.className = 'demote-button';
        removeSpecificButton.onclick = () => showRoleRemoveDialog(member.id, member.roles);

        buttonContainer.appendChild(assignButton);
        buttonContainer.appendChild(removeButton);
        buttonContainer.appendChild(removeSpecificButton);

        memberDiv.appendChild(buttonContainer);
        container.appendChild(memberDiv);
    });
}

// Функция отображения администраторов
function displayAdmins() {
    if (!roleIds || !roleIds.Admin) {
        console.error('Не загружены ID ролей администраторов');
        return;
    }

    const admins = allMembers.filter(member => {
        if (!member.roles || !Array.isArray(member.roles)) {
            return false;
        }
        return member.roles.some(role => roleIds.Admin.includes(role.id.toString()));
    });

    displayMembers(admins, 'adminList');
}

// Функция отображения модераторов
function displayModerators() {
    if (!roleIds || !roleIds.Moderator) {
        console.error('Не загружены ID ролей модераторов');
        return;
    }

    const moderators = allMembers.filter(member => {
        if (!member.roles || !Array.isArray(member.roles)) {
            return false;
        }
        return member.roles.some(role => roleIds.Moderator.includes(role.id.toString()));
    });

    displayMembers(moderators, 'moderatorList');
}

// Функция для проверки текущей страницы
function isAdminPage() {
    return window.location.pathname.includes('admins.html');
}

// Функция для проверки текущей страницы
function isModeratorPage() {
    return window.location.pathname.includes('moderators.html');
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
    // Удаляем предыдущее уведомление, если оно есть
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Показываем уведомление
    setTimeout(() => notification.classList.add('show'), 100);

    // Скрываем через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Функция для обновления данных
async function updateData() {
    try {
        await loadMembers();
        displayAdmins();
        displayModerators();
    } catch (error) {
        console.error('Ошибка при обновлении данных:', error);
    }
}

// Модифицируем функции управления ролями
async function assignRole(userId, roleName) {
  try {
    // Валидация входных данных
    if (!userId || !roleName) {
      throw new Error('Не указан ID пользователя или роль');
    }

    // Показываем индикатор загрузки
    const button = event.target;
    button.disabled = true;
    button.classList.add('loading');

    // Подтверждение действия
    const confirmed = confirm(`Назначить роль "${roleName}" пользователю?`);
    if (!confirmed) return;

    const response = await fetch('/api/roles/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: roleName })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка сервера');
    }

    showNotification(`Роль "${roleName}" успешно назначена`, 'success');
    await updateData();
  } catch (err) {
    console.error('Ошибка назначения роли:', err);
    showNotification(err.message, 'error');
  } finally {
    const button = event.target;
    button.disabled = false;
    button.classList.remove('loading');
  }
}

async function deleteRole(userId) {
    const button = event.target;
    try {
        button.classList.add('loading');
        button.disabled = true;

        const response = await fetch('/api/roles/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при удалении роли');
        }
        
        showNotification('Роль успешно удалена', 'success');
        await updateData(); // Обновляем данные после действия
    } catch (error) {
        console.error('Ошибка при удалении роли:', error);
        showNotification('Ошибка при удалении роли', 'error');
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Функция для загрузки модераторов
async function loadModerators() {
    try {
        console.log('Отправляем запрос на получение модераторов...');
        console.log('URL запроса:', '/api/members/moderators');
        
        const response = await fetch('/api/members/moderators', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        console.log('Получен ответ:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Получены данные модераторов:', JSON.stringify(data, null, 2));
        
        if (!Array.isArray(data)) {
            throw new Error('Получены некорректные данные: ожидался массив');
        }
        
        allMembers = data.map(member => ({
            ...member,
            id: member.id.toString(),
            roles: Array.isArray(member.roles) ? member.roles.map(role => ({
                ...role,
                id: role.id.toString()
            })) : []
        }));
        
        console.log(`Загружено ${allMembers.length} модераторов`);
        return allMembers;
    } catch (err) {
        console.error('Ошибка загрузки модераторов:', err);
        allMembers = [];
        throw err;
    }
}

// Функция для загрузки конфигурации
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Ошибка при загрузке конфигурации');
        }
        config = await response.json();
    } catch (error) {
        console.error('Ошибка при загрузке конфигурации:', error);
        showNotification('Ошибка при загрузке конфигурации', 'error');
    }
}

// Модифицируем инициализацию
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForBotConnection();
        await loadConfig(); // Загружаем конфигурацию
        showNotification('Подключение к боту установлено', 'success');
        
    await loadAdminRoles();
        
        if (isAdminPage()) {
    await loadMembers();
    displayAdmins();
        } else if (isModeratorPage()) {
            await loadModerators();
            displayModerators();
        }
    } catch (error) {
        console.error('Ошибка при инициализации:', error);
        showNotification('Ошибка при загрузке данных', 'error');
    }
});

// Функция для получения всех ролей сервера
async function loadServerRoles() {
    try {
        const response = await fetch('/api/roles/all');
        if (!response.ok) {
            throw new Error('Ошибка при загрузке ролей');
        }
        allServerRoles = await response.json();
    } catch (error) {
        console.error('Ошибка при загрузке ролей:', error);
        showNotification('Ошибка при загрузке ролей', 'error');
    }
}

// Функция для создания выпадающего списка назначения ролей
function createAssignRoleDropdown(userId) {
    const dropdown = document.createElement('div');
    dropdown.className = 'role-dropdown';

    const button = document.createElement('button');
    button.className = 'assign-button';
    button.textContent = 'Назначить';
    button.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown(dropdown);
    };

    const content = document.createElement('div');
    content.className = 'role-dropdown-content';

    // Добавляем поиск
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'role-search';
    search.placeholder = 'Поиск ролей...';
    search.oninput = (e) => filterRoles(e.target.value, content);

    const roleList = document.createElement('div');
    roleList.className = 'role-list';

    // Создаем элементы для каждой роли
    config.adminRoles.forEach(role => {
        if (role.name === 'Мод.состав') return; // Пропускаем Мод.состав

        const item = document.createElement('div');
        item.className = 'role-item';
        item.textContent = role.name;
        
        if (role.dependencies.length > 0) {
            const deps = document.createElement('span');
            deps.className = 'role-dependencies';
            deps.textContent = `(${role.dependencies.join(', ')})`;
            item.appendChild(deps);
        }

        item.onclick = async () => {
            try {
                await assignRoleWithDependencies(userId, role);
                showNotification(`Роль ${role.name} назначена`, 'success');
                await updateData();
            } catch (error) {
                showNotification(error.message, 'error');
            }
            toggleDropdown(dropdown);
        };

        roleList.appendChild(item);
    });

    content.appendChild(search);
    content.appendChild(roleList);
    dropdown.appendChild(button);
    dropdown.appendChild(content);

    return dropdown;
}

// Функция для создания выпадающего списка управления текущими ролями
function createManageRolesDropdown(userId, currentRoles) {
    const dropdown = document.createElement('div');
    dropdown.className = 'role-dropdown';

    const button = document.createElement('button');
    button.className = 'manage-roles-button';
    button.textContent = 'Управление ролями';
    button.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown(dropdown);
    };

    const content = document.createElement('div');
    content.className = 'role-dropdown-content';

    const roleList = document.createElement('ul');
    roleList.className = 'role-list';

    // Создаем элементы для каждой роли пользователя
    currentRoles.forEach(role => {
        if (role.name === 'Мод.состав') return; // Пропускаем Мод.состав

        const item = createRoleItem(role, userId, false);
        roleList.appendChild(item);
    });

    content.appendChild(roleList);
    dropdown.appendChild(button);
    dropdown.appendChild(content);

    return dropdown;
}

// Функция для создания элемента роли
function createRoleItem(role, userId, isAssign) {
    const item = document.createElement('li');
    item.className = 'role-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'role-checkbox';
    checkbox.checked = memberRoles.get(userId)?.some(r => r.id === role.id) || false;

    const name = document.createElement('span');
    name.className = 'role-name';
    name.textContent = role.name;

    // Добавляем информацию о зависимостях
    if (role.dependencies && role.dependencies.length > 0) {
        const deps = document.createElement('div');
        deps.className = 'role-dependencies';
        deps.textContent = `Зависимости: ${role.dependencies.join(', ')}`;
        name.appendChild(deps);
    }

    // Обработчик изменения
    checkbox.onchange = async () => {
        try {
            if (isAssign && checkbox.checked) {
                await assignRoleWithDependencies(userId, role);
            } else if (!isAssign && !checkbox.checked) {
                await removeRole(userId, role.name);
            }
            await updateMemberRoles(userId);
            showNotification(`Роль ${checkbox.checked ? 'назначена' : 'снята'}`, 'success');
        } catch (error) {
            console.error('Ошибка при управлении ролью:', error);
            checkbox.checked = !checkbox.checked; // Возвращаем состояние
            showNotification(error.message, 'error');
        }
    };

    item.appendChild(checkbox);
    item.appendChild(name);
    return item;
}

// Функция для назначения роли с проверкой зависимостей
async function assignRoleWithDependencies(userId, role) {
    const userRoles = memberRoles.get(userId) || [];
    const missingDeps = role.dependencies.filter(dep => 
        !userRoles.some(userRole => userRole.name === dep)
    );

    if (missingDeps.length > 0) {
        // Сначала назначаем зависимости
        for (const dep of missingDeps) {
            await sendCommandToBot('addRole', {
                guildId: config.guildId,
                userId,
                role: dep
            });
        }
    }

    // Затем назначаем саму роль
    await sendCommandToBot('addRole', {
        guildId: config.guildId,
        userId,
        role: role.name
    });
}

// Функция для фильтрации ролей
function filterRoles(query, dropdownContent) {
    const roleItems = dropdownContent.querySelectorAll('.role-item');
    const searchQuery = query.toLowerCase();

    roleItems.forEach(item => {
        const roleName = item.querySelector('.role-name').textContent.toLowerCase();
        item.style.display = roleName.includes(searchQuery) ? '' : 'none';
    });
}

// Функция для переключения выпадающего списка
function toggleDropdown(dropdown) {
    const content = dropdown.querySelector('.role-dropdown-content');
    const isOpen = content.classList.contains('show');

    // Закрываем все открытые выпадающие списки
    document.querySelectorAll('.role-dropdown-content.show').forEach(d => {
        if (d !== content) {
            d.classList.remove('show');
        }
    });

    content.classList.toggle('show');

    // Добавляем обработчик клика вне выпадающего списка
    if (!isOpen) {
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target)) {
                    content.classList.remove('show');
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 0);
    }
}

// Функция для обновления ролей участника
async function updateMemberRoles(userId) {
    try {
        const members = await sendCommandToBot('getMembers', { guildId: config.guildId });
        const member = members.find(m => m.id === userId);
        if (member) {
            memberRoles.set(userId, member.roles);
            // Обновляем отображение
            if (isModeratorPage()) {
                displayModerators();
            } else if (isAdminPage()) {
                displayAdmins();
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении ролей:', error);
        showNotification('Ошибка при обновлении ролей', 'error');
    }
}

// Функция для создания выпадающего списка удаления ролей
function createRemoveRolesDropdown(userId, currentRoles) {
    const dropdown = document.createElement('div');
    dropdown.className = 'role-dropdown';

    const button = document.createElement('button');
    button.className = 'demote-button';
    button.textContent = 'Убрать';
    button.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown(dropdown);
    };

    const content = document.createElement('div');
    content.className = 'role-dropdown-content';

    const roleList = document.createElement('div');
    roleList.className = 'role-list';

    // Фильтруем и отображаем только админские роли
    currentRoles.filter(role => 
        config.roleIds.Admin.includes(role.id.toString()) || 
        config.roleIds.Moderator.includes(role.id.toString())
    ).forEach(role => {
        if (role.name === 'Мод.состав') return; // Пропускаем Мод.состав

        const item = document.createElement('div');
        item.className = 'role-item';
        item.textContent = role.name;

        item.onclick = async () => {
            try {
                await removeSpecificRole(userId, role.name);
                showNotification(`Роль ${role.name} удалена`, 'success');
                await updateData();
            } catch (error) {
                showNotification(error.message, 'error');
            }
            toggleDropdown(dropdown);
        };

        roleList.appendChild(item);
    });

    content.appendChild(roleList);
    dropdown.appendChild(button);
    dropdown.appendChild(content);

    return dropdown;
}

// Функция для удаления конкретной роли
async function removeSpecificRole(userId, roleName) {
    const response = await fetch('/api/roles/remove-specific', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, roleName })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка при удалении роли');
    }

    return response.json();
}

// Функция для отображения диалога назначения роли
function showRoleAssignDialog(userId) {
    if (!config || !config.adminRoles) {
        showNotification('Ошибка: конфигурация не загружена', 'error');
        return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'role-dialog';
    
    const content = document.createElement('div');
    content.className = 'role-dialog-content';
    
    const title = document.createElement('h3');
    title.textContent = 'Выберите роль для назначения';
    
    const roleList = document.createElement('div');
    roleList.className = 'role-list';

    config.adminRoles.forEach(role => {
        if (role.name === 'Мод.состав') return;

        const item = document.createElement('div');
        item.className = 'role-item';
        item.textContent = role.name;
        
        if (role.dependencies.length > 0) {
            const deps = document.createElement('div');
            deps.className = 'role-dependencies';
            deps.textContent = `Зависимости: ${role.dependencies.join(', ')}`;
            item.appendChild(deps);
        }

        item.onclick = async () => {
            try {
                await assignRoleWithDependencies(userId, role);
                showNotification(`Роль ${role.name} назначена`, 'success');
                await updateData();
                dialog.remove();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        };

        roleList.appendChild(item);
    });

    content.appendChild(title);
    content.appendChild(roleList);
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Закрытие диалога при клике вне его
    dialog.onclick = (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    };
}

// Функция для отображения диалога удаления роли
function showRoleRemoveDialog(userId, currentRoles) {
    const dialog = document.createElement('div');
    dialog.className = 'role-dialog';
    
    const content = document.createElement('div');
    content.className = 'role-dialog-content';
    
    const title = document.createElement('h3');
    title.textContent = 'Выберите роль для удаления';
    
    const roleList = document.createElement('div');
    roleList.className = 'role-list';

    currentRoles.filter(role => 
        roleIds.Admin.includes(role.id.toString()) || 
        roleIds.Moderator.includes(role.id.toString())
    ).forEach(role => {
        if (role.name === 'Мод.состав') return;

        const item = document.createElement('div');
        item.className = 'role-item';
        item.textContent = role.name;

        item.onclick = async () => {
            try {
                await removeSpecificRole(userId, role.name);
                showNotification(`Роль ${role.name} удалена`, 'success');
                await updateData();
                dialog.remove();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        };

        roleList.appendChild(item);
    });

    content.appendChild(title);
    content.appendChild(roleList);
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Закрытие диалога при клике вне его
    dialog.onclick = (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    };
}