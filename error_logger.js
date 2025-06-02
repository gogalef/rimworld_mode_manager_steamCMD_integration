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
     */
    logError(modId, modName, error, details = '') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] Мод: ${modName} (ID: ${modId})\nОшибка: ${error}\n${details ? 'Детали: ' + details + '\n' : ''}${'-'.repeat(80)}\n`;

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