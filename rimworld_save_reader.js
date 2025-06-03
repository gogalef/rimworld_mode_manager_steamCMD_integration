const fs = require('fs');
const path = require('path');
const config = require('./config');

class RimworldSaveReader {
    constructor() {
        this.saveFilePath = config.saveFilePath;
        // ID официальных дополнений RimWorld
        this.officialDlcIds = [
            '1130216446', // Royalty
            '2106325227', // Ideology
            '2895290905', // Biotech
            '294100'      // Anomaly
        ];
        // Названия ядра игры и DLC
        this.coreModNames = ['Core', 'RimWorld', 'RimWorldCore', 'GameCore', 'Royalty', 'Ideology', 'Biotech', 'Anomaly'];
    }

    /**
     * Проверяет, является ли мод официальным дополнением или ядром игры
     * @param {string} steamId - Steam ID мода
     * @param {string} modName - Название мода
     * @returns {boolean}
     */
    isOfficialMod(steamId, modName) {
        return this.officialDlcIds.includes(steamId) || 
               this.coreModNames.some(name => modName?.toLowerCase() === name.toLowerCase());
    }

    /**
     * Читает файл сохранения и извлекает список модов
     * @returns {Promise<Array<[string, string, string]>>} Массив модов в формате [modId, steamId, modName]
     */
    async extractModList() {
        try {
            const saveContent = await fs.promises.readFile(this.saveFilePath, 'utf8');
            const mods = [];

            // Ищем секцию с ID модов
            const modIdsMatch = saveContent.match(/<modIds>(.*?)<\/modIds>/s);
            if (modIdsMatch) {
                const modIdsContent = modIdsMatch[1];
                const modIds = modIdsContent.match(/<li>([^<]+)<\/li>/g)?.map(id => id.replace(/<\/?li>/g, '')) || [];
                
                // Ищем секцию с Steam ID модов
                const modSteamIdsMatch = saveContent.match(/<modSteamIds>(.*?)<\/modSteamIds>/s);
                const modSteamIds = modSteamIdsMatch ? 
                    modSteamIdsMatch[1].match(/<li>(\d+)<\/li>/g)?.map(id => id.replace(/<\/?li>/g, '')) || [] : 
                    [];

                // Ищем секцию с названиями модов
                const modNamesMatch = saveContent.match(/<modNames>(.*?)<\/modNames>/s);
                const modNames = modNamesMatch ? 
                    modNamesMatch[1].match(/<li>([^<]+)<\/li>/g)?.map(name => name.replace(/<\/?li>/g, '')) || [] : 
                    [];
                // Собираем все моды в единый массив
                for (let i = 0; i < modIds.length; i++) {
                    const modId = modIds[i];
                    const steamId = modSteamIds[i] || '0';
                    const modName = modNames[i] || modId;

                    // Пропускаем официальные DLC и ядро игры
                    if (this.isOfficialMod(steamId, modName)) {
                        console.log(`Пропускаем ${modName} (${steamId}) - это официальный DLC или ядро игры`);
                        continue;
                    }
                    mods.push([modId, steamId, modName]);
                    // Пропускаем дубликаты
                   // if (!mods.some(m => m[0] === modId || m[1] === steamId)) {
                    //    mods.push([modId, steamId, modName]);
                    //}
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