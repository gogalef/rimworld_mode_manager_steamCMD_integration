const fs = require('fs');
const path = require('path');

class RimworldSaveReader {
    constructor(saveFilePath) {
        this.saveFilePath = saveFilePath;
        // ID официальных дополнений RimWorld
        this.officialDlcIds = [
            '1149640', // Royalty
            '1392840', // Ideology
            '1826140', // Biotech
            '2380740'  // Anomaly
        ];
    }

    /**
     * Проверяет, является ли мод официальным дополнением
     * @param {string} id - ID мода
     * @returns {boolean}
     */
    isOfficialDlc(id) {
        return this.officialDlcIds.includes(id);
    }

    /**
     * Читает файл сохранения и извлекает список модов
     * @returns {Promise<Array<{id: string, name?: string}>>} Список модов с ID и названиями
     */
    async extractModList() {
        try {
            const saveData = await fs.promises.readFile(this.saveFilePath);
            const saveContent = saveData.toString('utf-8');
            
            const mods = [];

            // Ищем список ID модов из Steam
            const steamIdsMatch = saveContent.match(/<modSteamIds>(.*?)<\/modSteamIds>/s);
            if (steamIdsMatch) {
                const steamIdsSection = steamIdsMatch[1];
                const steamIdMatches = steamIdsSection.match(/<li>(\d+)<\/li>/g);
                if (steamIdMatches) {
                    steamIdMatches.forEach(match => {
                        const id = match.match(/<li>(\d+)<\/li>/)[1];
                        // Пропускаем официальные дополнения
                        if (!this.isOfficialDlc(id)) {
                            mods.push({ id });
                        }
                    });
                }
            }

            // Ищем список названий модов
            const modNamesMatch = saveContent.match(/<modNames>(.*?)<\/modNames>/s);
            if (modNamesMatch) {
                const modNamesSection = modNamesMatch[1];
                const modNameMatches = modNamesSection.match(/<li>([^<]+)<\/li>/g);
                if (modNameMatches) {
                    modNameMatches.forEach(match => {
                        const name = match.match(/<li>([^<]+)<\/li>/)[1];
                        // Пропускаем официальные дополнения по названию
                        if (!['Royalty', 'Ideology', 'Biotech', 'Anomaly'].includes(name)) {
                            // Проверяем, нет ли уже мода с таким названием
                            const existingMod = mods.find(m => m.name === name);
                            if (!existingMod) {
                                mods.push({ id: '0', name });
                            }
                        }
                    });
                }
            }

            return mods;
        } catch (error) {
            console.error('Ошибка при чтении файла сохранения:', error);
            throw error;
        }
    }
}

module.exports = RimworldSaveReader; 