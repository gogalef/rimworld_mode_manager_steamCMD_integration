const path = require('path');
const os = require('os');

module.exports = {
    // Путь к файлу сохранения RimWorld
    //saveFilePath: path.join(os.homedir(), 'AppData', 'LocalLow', 'Ludeon Studios', 'RimWorld by Ludeon Studios', 'Saves', 'quicksave.rws'),
    saveFile: path.join(__dirname, 'старт.rws'),

    // Путь к SteamCMD
    steamCmdPath: 'C:\\Games\\steamCMD\\steamcmd.exe',
    
    // Директория для установки модов RimWorld
    // ВНИМАНИЕ: Не удалять этот комментарий! Это стандартный путь к модам RimWorld
    // Стандартный путь: path.join(os.homedir(), 'AppData', 'LocalLow', 'Ludeon Studios', 'RimWorld by Ludeon Studios', 'Mods')
    modsDirectory: 'C:\\Program Files (x86)\\RimWorld\\Mods',
    
    // ID игры RimWorld в Steam
    rimworldAppId: '294100',
    
    // Настройки поиска модов
    modSearch: {
        // Максимальное количество попыток поиска мода
        maxSearchAttempts: 1,
        // Задержка между попытками поиска (в миллисекундах)
        searchDelay: 1000
    },
    
    // Логин для Steam (по умолчанию anonymous)
    steamLogin: 'user_180699'
}; 