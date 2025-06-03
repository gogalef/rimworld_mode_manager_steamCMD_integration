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
        this.missingModsFile = path.join(__dirname, 'missing_mods.txt');
        this.notFoundModsFile = path.join(__dirname, 'not_found_mods.txt');
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
     * @param {string} steamId - Steam ID мода
     * @returns {boolean}
     */
    isModInstalled(modId, steamId) {
        try {
            // Проверяем по Steam ID, так как моды из Steam Workshop хранятся по их Steam ID
            const modPath = path.join(this.modsDirectory, steamId);
            const stats = fs.statSync(modPath);
            return stats.isDirectory();
        } catch (error) {
            // Если файл не существует или произошла другая ошибка
            return false;
        }
    }

    /**
     * Проверяет, существует ли мод в директории SteamCMD
     * @param {string} steamId - Steam ID мода
     * @returns {boolean}
     */
    isModInSteamCmd(steamId) {
        try {
            const workshopModPath = path.join(this.workshopDir, steamId);
            return fs.existsSync(workshopModPath);
        } catch (error) {
            console.error(`Ошибка при проверке мода ${steamId} в SteamCMD:`, error);
            return false;
        }
    }

    /**
     * Скачивает мод через SteamCMD с повторными попытками
     * @param {[string, string, string]} mod - Массив с данными мода [modId, steamId, modName]
     * @param {number} retryCount - Количество оставшихся попыток
     * @returns {Promise<void>}
     */
    async downloadMod(mod, retryCount = 3) {
        const [modId, steamId, modName] = mod;
        return new Promise((resolve, reject) => {
            // Проверяем, не установлен ли уже мод в директории RimWorld
            if (this.isModInstalled(modId, steamId)) {
                console.log(`Мод ${modName} (${steamId}) уже установлен в RimWorld, пропускаем`);
                resolve();
                return;
            }

            // Проверяем, есть ли мод в директории SteamCMD
            if (this.isModInSteamCmd(steamId)) {
                console.log(`Мод ${modName} (${steamId}) найден в директории SteamCMD, копируем...`);
                const workshopModPath = path.join(this.workshopDir, steamId);
                const targetModPath = path.join(this.modsDirectory, steamId);

                try {
                    // Убедимся, что директория существует
                    if (!fs.existsSync(this.modsDirectory)) {
                        console.log(`Создаем директорию для модов: ${this.modsDirectory}`);
                        fs.mkdirSync(this.modsDirectory, { recursive: true });
                    }

                    console.log(`Копируем мод из ${workshopModPath} в ${targetModPath}`);
                    fs.cpSync(workshopModPath, targetModPath, { recursive: true });
                    console.log(`Мод ${modName} (${steamId}) успешно скопирован в ${targetModPath}`);
                    resolve();
                    return;
                } catch (copyError) {
                    const error = `Ошибка при копировании мода ${modName} (${steamId}): ${copyError.message}`;
                    console.error(error);
                    errorLogger.logError(modId, modName, error);
                    reject(copyError);
                    return;
                }
            }

            // Если мода нет нигде, скачиваем его
            console.log(`Мод ${modName} (${steamId}) не найден, начинаем скачивание... (попытка ${4 - retryCount} из 3)`);
            
            // Убедимся, что директория существует
            if (!fs.existsSync(this.modsDirectory)) {
                console.log(`Создаем директорию для модов: ${this.modsDirectory}`);
                fs.mkdirSync(this.modsDirectory, { recursive: true });
            }

            console.log(`Директория для установки модов: ${this.modsDirectory}`);
            const command = `"${this.steamCmdPath}" +login ${this.steamLogin} +force_install_dir "${this.modsDirectory}" +workshop_download_item ${this.rimworldAppId} ${steamId} +quit`;
            console.log(`Выполняем команду: ${command}`);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    const errorMsg = `Ошибка при скачивании мода ${modName} (${steamId}): ${error.message}`;
                    console.error(errorMsg);
                    console.error('Вывод stderr:', stderr);
                    errorLogger.logError(modId, modName, errorMsg, stderr);
                    
                    // Если есть еще попытки, пробуем снова
                    if (retryCount > 1) {
                        console.log(`Повторная попытка скачивания мода ${modName} (${steamId})...`);
                        setTimeout(() => {
                            this.downloadMod(mod, retryCount - 1)
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
                    const workshopModPath = path.join(this.modsDirectory, 'steamapps', 'workshop', 'content', this.rimworldAppId, steamId);
                    const targetModPath = path.join(this.modsDirectory, steamId);

                    // Копируем мод из директории SteamCMD в целевую директорию
                    try {
                        if (fs.existsSync(workshopModPath)) {
                            console.log(`Копируем мод из ${workshopModPath} в ${targetModPath}`);
                            fs.cpSync(workshopModPath, targetModPath, { recursive: true });
                            console.log(`Мод ${modName} (${steamId}) успешно скопирован в ${targetModPath}`);
                            resolve();
                        } else {
                            const error = `Мод ${modName} (${steamId}) не найден в директории после скачивания`;
                            console.error(error);
                            errorLogger.logError(modId, modName, error, stdout);
                            
                            // Если есть еще попытки, пробуем снова
                            if (retryCount > 1) {
                                console.log(`Повторная попытка скачивания мода ${modName} (${steamId})...`);
                                setTimeout(() => {
                                    this.downloadMod(mod, retryCount - 1)
                                        .then(resolve)
                                        .catch(reject);
                                }, 2000);
                                return;
                            }
                            
                            reject(new Error(error));
                        }
                    } catch (copyError) {
                        const error = `Ошибка при копировании мода ${modName} (${steamId}): ${copyError.message}`;
                        console.error(error);
                        errorLogger.logError(modId, modName, error);
                        reject(copyError);
                    }
                } else {
                    const error = `Не удалось скачать мод ${modName} (${steamId})`;
                    console.error(error);
                    console.error('Вывод stderr:', stderr);
                    errorLogger.logError(modId, modName, error, stderr);
                    
                    // Если есть еще попытки, пробуем снова
                    if (retryCount > 1) {
                        console.log(`Повторная попытка скачивания мода ${modName} (${steamId})...`);
                        setTimeout(() => {
                            this.downloadMod(mod, retryCount - 1)
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
     * Анализирует список модов и проверяет их наличие
     * @param {Array<[string, string, string]>} mods - Массив модов в формате [modId, steamId, modName]
     * @returns {Promise<{missingMods: Array<[string, string, string]>, notFoundMods: Array<[string, string, string]>}>}
     */
    async analyzeMods(mods) {
        const missingMods = [];
        const notFoundMods = [];
        const coreModNames = ['Core', 'RimWorld', 'RimWorldCore', 'GameCore'];

        // Сначала ищем Steam ID для модов, у которых его нет
        for (const mod of mods) {
            const [modId, steamId, modName] = mod;
            
            // Пропускаем Core моды
            if (coreModNames.some(name => modName?.toLowerCase() === name.toLowerCase())) {
                console.log(`Пропускаем ${modName} - это ядро игры RimWorld`);
                continue;
            }

            // Если нет Steam ID, ищем мод по названию
            if (steamId === '0') {
                console.log(`Поиск мода "${modName}" в Steam Workshop...`);
                const foundSteamId = await this.findModByName(modName);
                
                if (foundSteamId) {
                    console.log(`Найден ID мода "${modName}": ${foundSteamId}`);
                    mod[1] = foundSteamId; // Обновляем Steam ID в массиве
                } else {
                    console.log(`Мод "${modName}" не найден в Steam Workshop`);
                    notFoundMods.push(mod);
                    continue;
                }
            }

            // Проверяем наличие мода в системе
            const isInstalled = this.isModInstalled(modId, mod[1]);
            const isInSteamCmd = this.isModInSteamCmd(mod[1]);

            if (!isInstalled && !isInSteamCmd) {
                console.log(`Мод ${modName} (${mod[1]}) не найден в системе`);
                missingMods.push(mod);
            } else {
                console.log(`Мод ${modName} (${mod[1]}) найден в системе`);
            }
        }

        // Записываем результаты в файлы
        await this.writeModsToFile(this.missingModsFile, missingMods, 'Отсутствующие моды:');
        await this.writeModsToFile(this.notFoundModsFile, notFoundMods, 'Моды, не найденные в Steam Workshop:');

        return { missingMods, notFoundMods };
    }

    /**
     * Записывает список модов в файл
     * @param {string} filePath - Путь к файлу
     * @param {Array<[string, string, string]>} mods - Массив модов
     * @param {string} header - Заголовок для файла
     */
    async writeModsToFile(filePath, mods, header) {
        const content = [
            header,
            '='.repeat(80),
            ...mods.map(([modId, steamId, modName]) => 
                `Мод: ${modName}\nID: ${modId}\nSteam ID: ${steamId}\n${'-'.repeat(40)}`
            ),
            `\nВсего модов: ${mods.length}\n`
        ].join('\n');

        await fs.promises.writeFile(filePath, content, 'utf8');
    }

    /**
     * Загрузка модов
     * @param {Array<[string, string, string]>} mods - Массив модов в формате [modId, steamId, modName]
     * @returns {Promise<{success: boolean, results: Array<{id: string, name: string, success: boolean, error?: string}>}>}
     */
    async downloadMods(mods) {
        try {
            // Анализируем моды
            const { missingMods, notFoundMods } = await this.analyzeMods(mods);

            // Выводим отчет
            console.log('\nОтчет о модах:');
            console.log('='.repeat(80));
            console.log(`Всего модов: ${mods.length}`);
            console.log(`Отсутствующие моды: ${missingMods.length}`);
            console.log(`Не найденные в Steam Workshop: ${notFoundMods.length}`);
            console.log('='.repeat(80));
            console.log(`\nПодробный отчет сохранен в файлах:`);
            console.log(`- ${this.missingModsFile}`);
            console.log(`- ${this.notFoundModsFile}`);

            // Если нет модов для загрузки, возвращаем успешный результат
            if (missingMods.length === 0) {
                return {
                    success: true,
                    results: mods.map(([modId, _, modName]) => ({
                        id: modId,
                        name: modName,
                        success: true,
                        skipped: true,
                        reason: 'Уже установлен'
                    }))
                };
            }

            // Запрашиваем подтверждение у пользователя
            console.log('\nХотите загрузить отсутствующие моды? (y/n)');
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                readline.question('', resolve);
            });
            readline.close();

            if (answer.toLowerCase() !== 'y') {
                console.log('Загрузка модов отменена пользователем');
                return {
                    success: false,
                    results: mods.map(([modId, _, modName]) => ({
                        id: modId,
                        name: modName,
                        success: false,
                        error: 'Загрузка отменена пользователем'
                    }))
                };
            }

            // Загружаем отсутствующие моды
            const results = [];
            for (const mod of missingMods) {
                const [modId, steamId, modName] = mod;
                try {
                    console.log(`\nЗагрузка мода ${modName} (${modId})...`);
                    await this.downloadMod(mod);
                    results.push({
                        id: modId,
                        name: modName,
                        success: true
                    });
                } catch (error) {
                    console.error(`Ошибка при загрузке мода ${modName} (${modId}):`, error.message);
                    errorLogger.logError(modId, modName, error.message);
                    results.push({
                        id: modId,
                        name: modName,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Добавляем результаты для уже установленных модов
            const installedMods = mods.filter(mod => !missingMods.some(m => m[0] === mod[0]));
            results.push(...installedMods.map(([modId, _, modName]) => ({
                id: modId,
                name: modName,
                success: true,
                skipped: true,
                reason: 'Уже установлен'
            })));

            return {
                success: results.every(result => result.success),
                results: results
            };
        } catch (error) {
            console.error('Общая ошибка при загрузке модов:', error);
            return {
                success: false,
                results: mods.map(([modId, _, modName]) => ({
                    id: modId,
                    name: modName,
                    success: false,
                    error: 'Общая ошибка загрузки'
                }))
            };
        }
    }
}

module.exports = SteamCmdManager; 