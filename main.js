const RimworldSaveReader = require('./rimworld_save_reader');
const SteamCmdManager = require('./steam_cmd_manager');
const config = require('./config');

async function main() {
    try {
        // Создаем экземпляр читателя сохранения
        const saveReader = new RimworldSaveReader(config.saveFile);
        
        // Извлекаем список модов
        console.log('Чтение файла сохранения...');
        const mods = await saveReader.extractModList();
        console.log(`Найдено модов: ${mods.length}`);
        
        // Создаем экземпляр менеджера SteamCMD
        const steamManager = new SteamCmdManager();
        
        // Проверяем установку SteamCMD
        console.log('Проверка установки SteamCMD...');
        const isInstalled = await steamManager.isSteamCmdInstalled();
        if (!isInstalled) {
            throw new Error('SteamCMD не установлен! Пожалуйста, установите SteamCMD.');
        }
        
        // Загружаем моды
        console.log('Загрузка модов...');
        const result = await steamManager.downloadMods(mods, config.modsDirectory);
        
        // Выводим результаты
        console.log('\nРезультаты загрузки:');
        console.log('===================');
        
        const successfulMods = result.results.filter(r => r.success);
        const failedMods = result.results.filter(r => !r.success);
        
        console.log(`\nУспешно загружено: ${successfulMods.length} из ${mods.length} модов`);
        
        if (failedMods.length > 0) {
            console.log('\nНе удалось загрузить следующие моды:');
            failedMods.forEach(mod => {
                console.log(`- Мод ${mod.name || mod.id}: ${mod.error}`);
            });
        }
        
        if (result.success) {
            console.log('\nВсе моды успешно загружены!');
        } else {
            console.log('\nЗагрузка завершена с ошибками.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Ошибка:', error.message);
        process.exit(1);
    }
}

main(); 