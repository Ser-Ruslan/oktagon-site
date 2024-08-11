const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2');
const fs = require('fs');


const token = '7363437148:AAHecv5tqcoTEvhMuFS1swyj1BfatGmHpGs';
const bot = new TelegramBot(token, { polling: true });


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'oktagon'
});

db.connect((err) => {
    if (err) throw err;
    console.log('БД подключена успешно');
});

bot.setMyCommands([
    { command: '/start', description: 'Приветственное сообщение' },
    { command: '/help', description: 'Список доступных команд' },
    { command: '/subscribe', description: 'Подписаться на новости, курсы или товары' },
    { command: '/unsubscribe', description: 'Отписаться от подписки' },
    { command: '/news', description: 'Получить список новостей' },
    { command: '/courses', description: 'Получить список курсов' },
    { command: '/products', description: 'Получить список товаров' },
    { command: '/creator', description: 'Узнать автора бота' }
]);


bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Добро пожаловать! Для получения списка доступных команд используйте /help.');
});


bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Вот доступные команды:\n\n' +
        '/start - Приветственное сообщение\n' +
        '/help - Список доступных команд\n' +
        '/subscribe - Подписаться на новости, курсы или товары\n' +
        '/unsubscribe [type] - Отписаться от [news, course, product]\n' +
        '/news - Получить новости\n' +
        '/courses - Получить список курсов\n' +
        '/products - Получить список товаров\n'+
        '/creator - Узнать автора бота\n'+
        '/site - Получить ссылку на сайт');
});

bot.onText(/\/site/, (msg) => {
    const chatId = msg.chat.id;
    const siteUrl = 'http://localhost:3000/'; 
    bot.sendMessage(chatId, `Перейдите на сайт по этой ссылке: ${siteUrl}`);
});

bot.onText(/\/creator/, (msg) => {
    const chatId = msg.chat.id;

    
    fs.readFile('package.json', (err, data) => {
        if (err) {
            bot.sendMessage(chatId, 'Произошла ошибка при чтении данных.');
            return console.error(err);
        }

        const packageJson = JSON.parse(data);
        const authorName = packageJson.author.name;
        const authorLastName = packageJson.author['last name'];
        const authorFullName = `${authorName} ${authorLastName}`;
        
        bot.sendMessage(chatId, `Автор бота: ${authorFullName}`);
    });
});

bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Выберите, на что вы хотите подписаться:', {
        reply_markup: {
            keyboard: [
                ['Новости', 'Курсы'],
                ['Товары']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === 'Новости') {
        db.query('INSERT IGNORE INTO subscriptions (chat_id, type) VALUES (?, ?)', [chatId, 'news'], (err) => {
            if (err) {
                console.error('Error adding subscription:', err);
                bot.sendMessage(chatId, 'Ошибка при добавлении подписки на новости.');
            } else {
                bot.sendMessage(chatId, 'Вы подписаны на новости.');
            }
        });
    } else if (text === 'Курсы') {
        db.query('INSERT IGNORE INTO subscriptions (chat_id, type) VALUES (?, ?)', [chatId, 'course'], (err) => {
            if (err) {
                console.error('Error adding subscription:', err);
                bot.sendMessage(chatId, 'Ошибка при добавлении подписки на курсы.');
            } else {
                bot.sendMessage(chatId, 'Вы подписаны на курсы.');
            }
        });
    } else if (text === 'Товары') {
        db.query('INSERT IGNORE INTO subscriptions (chat_id, type) VALUES (?, ?)', [chatId, 'product'], (err) => {
            if (err) {
                console.error('Error adding subscription:', err);
                bot.sendMessage(chatId, 'Ошибка при добавлении подписки на товары.');
            } else {
                bot.sendMessage(chatId, 'Вы подписаны на товары.');
            }
        });
    } else if (text.startsWith('/unsubscribe')) {
        const type = text.split(' ')[1];
        if (!['news', 'course', 'product'].includes(type)) {
            bot.sendMessage(chatId, 'Неверный тип подписки.');
            return;
        }

        db.query('DELETE FROM subscriptions WHERE chat_id = ? AND type = ?', [chatId, type], (err) => {
            if (err) {
                console.error('Error removing subscription:', err);
                bot.sendMessage(chatId, 'Ошибка при удалении подписки.');
            } else {
                bot.sendMessage(chatId, 'Вы отписались от ' + type + '.');
            }
        });
    }
});



bot.onText(/\/news/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const [rows] = await db.promise().query('SELECT * FROM news');
        for (const item of rows) {
            let newsMessage = `*${item.title}*\n${item.content}\n`;

            
            if (item.image_path) {
                const imageUrl = `http://localhost:3000/uploads/${item.image_path}`;
                try {
                    await bot.sendPhoto(chatId, imageUrl);
                } catch (err) {
                    console.error(`Error sending photo ${imageUrl}:`, err);
                    bot.sendMessage(chatId, 'Ошибка при отправке изображения.');
                }
            }

            
            if (item.file_name) {
                const fileUrl = `http://localhost:3000/uploads/${item.file_name}`;
                newsMessage += `\nМатериалы:\n- [${item.file_name}](${fileUrl})\n`;
            }

            bot.sendMessage(chatId, newsMessage, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Произошла ошибка при получении новостей.');
    }
});


bot.onText(/\/courses/, (msg) => {
    const chatId = msg.chat.id;
    db.query('SELECT * FROM courses', (err, courses) => {
        if (err) {
            console.error('Error fetching courses:', err);
            bot.sendMessage(chatId, 'Ошибка при получении курсов.');
            return;
        }

        if (courses.length === 0) {
            bot.sendMessage(chatId, 'Нет курсов для отображения.');
        } else {
            courses.forEach(course => {
                let message = `*${course.name}*\nОписание: ${course.description}\nЦена: ${course.price}\nСкидка: ${course.discount || 'Нет'}\n\n`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            });
        }
    });
});


bot.onText(/\/products/, (msg) => {
    const chatId = msg.chat.id;
    db.query('SELECT * FROM store', (err, store) => {
        if (err) {
            console.error('Error fetching products:', err);
            bot.sendMessage(chatId, 'Ошибка при получении товаров.');
            return;
        }

        if (store.length === 0) {
            bot.sendMessage(chatId, 'Нет товаров для отображения.');
        } else {
            store.forEach(store => {
                let message = `*${store.item_name}*\nОписание: ${store.item_description}\nЦена: ${store.item_price}\n\n`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            });
        }
    });
});
