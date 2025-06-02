const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const config = require('./config');
const errorLogger = require('./error_logger');

class SteamCmdManager {
    constructor() {
        this.steamCmdPath = config.steamCmdPath;
        this.rimworldAppId = config.rimworldAppId;
        this.modsDirectory = config.modsDirectory;
        this.steamCmdDir = path.dirname(this.steamCmdPath);
        this.workshopDir = path.join(this.steamCmdDir, 'steamapps', 'workshop', 'content', this.rimworldAppId);
        this.steamLogin = config.steamLogin;
    }

    /**
     * Проверяет установлен ли SteamCMD
     * @returns {Promise<boolean>}
     */
    async isSteamCmdInstalled() {
        return new Promise((resolve) => {
            fs.access(this.steamCmdPath, fs.constants.F_OK, (err) => {
                resolve(!err);
            });
        });
    }

    /**
     * Выполняет команду SteamCMD
     * @param {string} command - Команда для выполнения
     * @returns {Promise<string>}
     */
    async executeSteamCmdCommand(command) {
        return new Promise((resolve, reject) => {
            exec(`"${this.steamCmdPath}" ${command}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    /**
     * Ищет мод по названию в Steam Workshop
     * @param {string} modName - Название мода
     * @returns {Promise<string|null>} ID мода или null если не найден
     */
    async findModByName(modName) {
        return new Promise((resolve, reject) => {
            const searchUrl = `https://steamcommunity.com/workshop/browse/?appid=${this.rimworldAppId}&searchtext=${encodeURIComponent(modName)}`;
            
            https.get(searchUrl, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        // Ищем блок с модом по названию
                        const modNameRegex = new RegExp(`<div class="workshopItemTitle ellipsis">${modName}</div>`);
                        const modBlockMatch = data.match(new RegExp(`<div[^>]*class="workshopItem"[^>]*>.*?${modNameRegex.source}.*?</div>`, 's'));
                        
                        if (modBlockMatch) {
                            // Ищем ID мода в URL ссылки
                            const urlMatch = modBlockMatch[0].match(/filedetails\/\?id=(\d+)/);
                            if (urlMatch && urlMatch[1]) {
                                console.log(`Найден мод "${modName}" с ID ${urlMatch[1]}`);
                                resolve(urlMatch[1]);
                            } else {
                                const error = `Не удалось извлечь ID мода "${modName}" из URL`;
                                console.log(error);
                                errorLogger.logError('0', modName, error);
                                resolve(null);
                            }
                        } else {
                            const error = `Мод "${modName}" не найден в результатах поиска`;
                            console.log(error);
                            errorLogger.logError('0', modName, error);
                            resolve(null);
                        }
                    } catch (error) {
                        const errorMsg = `Ошибка при поиске мода "${modName}": ${error.message}`;
                        console.error(errorMsg);
                        errorLogger.logError('0', modName, errorMsg);
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                const errorMsg = `Ошибка при запросе к Steam Workshop: ${error.message}`;
                console.error(errorMsg);
                errorLogger.logError('0', modName, errorMsg);
                reject(error);
            });
        });
    }

    /**
     * Проверяет, существует ли мод в директории модов
     * @param {string} modId - ID мода
     * @returns {boolean}
     */
    isModInstalled(modId) {
        try {
            const modPath = path.join(this.modsDirectory, modId);
            const stats = fs.statSync(modPath);
            return stats.isDirectory();
        } catch (error) {
            // Если файл не существует или произошла другая ошибка
            return false;
        }
    }

    /**
     * Проверяет, существует ли мод в директории SteamCMD
     * @param {string} modId - ID мода
     * @returns {boolean}
     */
    isModInSteamCmd(modId) {
        try {
            const workshopModPath = path.join(this.workshopDir, modId);
            return fs.existsSync(workshopModPath);
        } catch (error) {
            console.error(`Ошибка при проверке мода ${modId} в SteamCMD:`, error);
            return false;
        }
    }

    /**
     * Скачивает мод через SteamCMD с повторными попытками
     * @param {string} modId - ID мода из Steam Workshop
     * @param {string} modName - Название мода
     * @param {number} retryCount - Количество оставшихся попыток
     * @returns {Promise<void>}
     */
    async downloadMod(modId, modName, retryCount = 3) {
        return new Promise((resolve, reject) => {
            // Проверяем, не установлен ли уже мод в директории RimWorld
            if (this.isModInstalled(modId)) {
                console.log(`Мод ${modId} уже установлен в RimWorld, пропускаем`);
                resolve();
                return;
            }

            // Проверяем, есть ли мод в директории SteamCMD
            if (this.isModInSteamCmd(modId)) {
                console.log(`Мод ${modId} найден в директории SteamCMD, копируем...`);
                const workshopModPath = path.join(this.workshopDir, modId);
                const targetModPath = path.join(this.modsDirectory, modId);

                try {
                    // Убедимся, что директория существует
                    if (!fs.existsSync(this.modsDirectory)) {
                        console.log(`Создаем директорию для модов: ${this.modsDirectory}`);
                        fs.mkdirSync(this.modsDirectory, { recursive: true });
                    }

                    console.log(`Копируем мод из ${workshopModPath} в ${targetModPath}`);
                    fs.cpSync(workshopModPath, targetModPath, { recursive: true });
                    console.log(`Мод ${modId} успешно скопирован в ${targetModPath}`);
                    resolve();
                    return;
                } catch (copyError) {
                    const error = `Ошибка при копировании мода ${modId}: ${copyError.message}`;
                    console.error(error);
                    errorLogger.logError(modId, modName, error);
                    reject(copyError);
                    return;
                }
            }

            // Если мода нет нигде, скачиваем его
            console.log(`Мод ${modId} не найден, начинаем скачивание... (попытка ${4 - retryCount} из 3)`);
            
            // Убедимся, что директория существует
            if (!fs.existsSync(this.modsDirectory)) {
                console.log(`Создаем директорию для модов: ${this.modsDirectory}`);
                fs.mkdirSync(this.modsDirectory, { recursive: true });
            }

            console.log(`Директория для установки модов: ${this.modsDirectory}`);
            const command = `"${this.steamCmdPath}" +login ${this.steamLogin} +force_install_dir "${this.modsDirectory}" +workshop_download_item ${this.rimworldAppId} ${modId} +quit`;
            console.log(`Выполняем команду: ${command}`);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    const errorMsg = `Ошибка при скачивании мода ${modId}: ${error.message}`;
                    console.error(errorMsg);
                    console.error('Вывод stderr:', stderr);
                    errorLogger.logError(modId, modName, errorMsg, stderr);
                    
                    // Если есть еще попытки, пробуем снова
                    if (retryCount > 1) {
                        console.log(`Повторная попытка скачивания мода ${modId}...`);
                        setTimeout(() => {
                            this.downloadMod(modId, modName, retryCount - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                        return;
                    }
                    
                    reject(error);
                    return;
                }

                console.log('Вывод SteamCMD:', stdout);

                // Проверяем, успешно ли скачался мод
                if (stdout.includes('Success')) {
                    // Получаем путь к скачанному моду в директории RimWorld
                    const workshopModPath = path.join(this.modsDirectory, 'steamapps', 'workshop', 'content', this.rimworldAppId, modId);
                    const targetModPath = path.join(this.modsDirectory, modId);

                    // Копируем мод из директории SteamCMD в целевую директорию
                    try {
                        if (fs.existsSync(workshopModPath)) {
                            console.log(`Копируем мод из ${workshopModPath} в ${targetModPath}`);
                            fs.cpSync(workshopModPath, targetModPath, { recursive: true });
                            console.log(`Мод ${modId} успешно скопирован в ${targetModPath}`);
                            resolve();
                        } else {
                            const error = `Мод ${modId} не найден в директории после скачивания`;
                            console.error(error);
                            errorLogger.logError(modId, modName, error, stdout);
                            
                            // Если есть еще попытки, пробуем снова
                            if (retryCount > 1) {
                                console.log(`Повторная попытка скачивания мода ${modId}...`);
                                setTimeout(() => {
                                    this.downloadMod(modId, modName, retryCount - 1)
                                        .then(resolve)
                                        .catch(reject);
                                }, 2000);
                                return;
                            }
                            
                            reject(new Error(error));
                        }
                    } catch (copyError) {
                        const error = `Ошибка при копировании мода ${modId}: ${copyError.message}`;
                        console.error(error);
                        errorLogger.logError(modId, modName, error);
                        reject(copyError);
                    }
                } else {
                    const error = `Не удалось скачать мод ${modId}`;
                    console.error(error);
                    console.error('Вывод stderr:', stderr);
                    errorLogger.logError(modId, modName, error, stderr);
                    
                    // Если есть еще попытки, пробуем снова
                    if (retryCount > 1) {
                        console.log(`Повторная попытка скачивания мода ${modId}...`);
                        setTimeout(() => {
                            this.downloadMod(modId, modName, retryCount - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                        return;
                    }
                    
                    reject(new Error(error));
                }
            });
        });
    }

    /**
     * Ищет ID мода по названию через Steam Workshop
     * @param {string} modName - Название мода
     * @returns {Promise<string|null>} ID мода или null, если не найден
     */
    async findModIdByName(modName) {
        return new Promise((resolve, reject) => {
            const command = `"${this.steamCmdPath}" +login anonymous +workshop_search 294100 "${modName}" +quit`;
            console.log(`Ищем мод "${modName}"...`);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Ошибка при поиске мода "${modName}":`, error);
                    reject(error);
                    return;
                }

                // Ищем ID мода в выводе SteamCMD
                const match = stdout.match(/PublishedFileId: (\d+)/);
                if (match) {
                    console.log(`Найден мод "${modName}" с ID ${match[1]}`);
                    resolve(match[1]);
                } else {
                    console.log(`Мод "${modName}" не найден`);
                    resolve(null);
                }
            });
        });
    }

    /**
     * Загрузка модов по их ID или названию
     * @param {Array<{id: string, name?: string}>} mods - Массив объектов с ID и/или названием модов
     * @returns {Promise<{success: boolean, results: Array<{id: string, name?: string, success: boolean, error?: string}>}>}
     */
    async downloadMods(mods) {
        try {
            const results = [];
            const coreModNames = ['Core', 'RimWorld', 'RimWorldCore', 'GameCore'];

            // Обрабатываем каждый мод
            for (const mod of mods) {
                try {
                    let modId = mod.id;
                    
                    // Если ID равен 0 или не указан, ищем мод по названию
                    if (modId === '0' || !modId) {
                        if (!mod.name) {
                            throw new Error('Не указано ни ID, ни название мода');
                        }
                        
                        console.log(`Поиск мода "${mod.name}" в Steam Workshop...`);
                        modId = await this.findModByName(mod.name);
                        
                        if (!modId) {
                            throw new Error(`Мод "${mod.name}" не найден в Steam Workshop`);
                        }
                        
                        console.log(`Найден ID мода "${mod.name}": ${modId}`);
                    }

                    // Пропускаем Core мод и связанные с ним
                    if (coreModNames.some(name => mod.name?.toLowerCase() === name.toLowerCase())) {
                        console.log(`Пропускаем ${mod.name} - это ядро игры RimWorld`);
                        results.push({
                            id: modId,
                            name: mod.name,
                            success: true,
                            skipped: true,
                            reason: 'Ядро игры'
                        });
                        continue;
                    }

                    console.log(`Загрузка мода ${modId}...`);
                    await this.downloadMod(modId, mod.name);
                    
                    results.push({
                        id: modId,
                        name: mod.name,
                        success: true
                    });
                } catch (error) {
                    console.error(`Ошибка при загрузке мода ${mod.name || mod.id}:`, error.message);
                    results.push({
                        id: mod.id,
                        name: mod.name,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Проверяем общий результат
            const allSuccessful = results.every(result => result.success);
            
            return {
                success: allSuccessful,
                results: results
            };
        } catch (error) {
            console.error('Общая ошибка при загрузке модов:', error);
            return {
                success: false,
                results: mods.map(mod => ({
                    id: mod.id,
                    name: mod.name,
                    success: false,
                    error: 'Общая ошибка загрузки'
                }))
            };
        }
    }
}

module.exports = SteamCmdManager; 