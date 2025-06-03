const fs = require('fs');
const path = require('path');

class ErrorLogger {
    constructor() {
        this.logFile = path.join(__dirname, 'error_log.txt');
    }

    /**
     * Логирует ошибку в файл
     * @param {string} modId - ID мода
     * @param {string} modName - Название мода
     * @param {string} error - Текст ошибки
     * @param {string} details - Дополнительные детали
     * @param {Object} modLists - Списки модов
     * @param {Array<string>} modLists.modIds - Список ID модов
     * @param {Array<string>} modLists.modSteamIds - Список Steam ID модов
     * @param {Array<string>} modLists.modNames - Список названий модов
     */
    logError(modId, modName, error, details = '', modLists = {}) {
        const timestamp = new Date().toISOString();
        let logEntry = `[${timestamp}]\n`;

        // Находим индекс мода в списках
        const modIndex = modLists.modIds?.indexOf(modId) ?? -1;
        
        // Добавляем информацию о моде
        logEntry += `Мод не загружен:\n`;
        logEntry += `ID: ${modId}\n`;
        logEntry += `Steam ID: ${modLists.modSteamIds?.[modIndex] || modId}\n`;
        logEntry += `Название: ${modLists.modNames?.[modIndex] || modName}\n`;
        logEntry += `Ошибка: ${error}\n`;

        // Добавляем детали, если они есть
        if (details) {
            logEntry += `Детали ошибки: ${details}\n`;
        }

        // Добавляем разделитель
        logEntry += `${'-'.repeat(80)}\n`;

        try {
            fs.appendFileSync(this.logFile, logEntry);
        } catch (err) {
            console.error('Ошибка при записи в лог:', err);
        }
    }

    /**
     * Очищает лог ошибок
     */
    clearLog() {
        try {
            fs.writeFileSync(this.logFile, '');
        } catch (err) {
            console.error('Ошибка при очистке лога:', err);
        }
    }
}

module.exports = new ErrorLogger(); 