const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2');
const fs = require('fs');

const token = ''; 
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
    { command: '/review', description: 'Написать отзыв' },
    { command: '/creator', description: 'Узнать автора бота' },
    { command: '/site', description: 'Получить ссылку на сайт' },
    { command: '/stats', description: 'Получить статистику подписок' }
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
        '/unsubscribe - Отписаться от подписки\n' +
        '/news - Получить новости\n' +
        '/courses - Получить список курсов\n' +
        '/products - Получить список товаров\n' +
        '/creator - Узнать автора бота\n' +
        '/review - Написать отзыв\n' +
        '/site - Получить ссылку на сайт\n' +
        '/stats - Получить статистику подписок');
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
        const authorName = packageJson.author.name || 'Неизвестно';
        const authorLastName = packageJson.author['last name'] || '';
        const authorFullName = `${authorName} ${authorLastName}`.trim();
        bot.sendMessage(chatId, `Автор бота: ${authorFullName}`);
    });
});

bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Выберите, на что вы хотите подписаться:', {
        reply_markup: {
            keyboard: [
                ['Новости', 'Курсы', 'Товары'],
                ['Отмена']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });

    bot.once('message', (msg) => {
        const text = msg.text;

        switch (text) {
            case 'Новости':
                type = 'news';
                break;
            case 'Курсы':
                type = 'course';
                break;
            case 'Товары':
                type = 'product';
                break;
            default:
                type = null;
                break;
        }


        if (text === 'news' || text === 'course' || text === 'product') {
            const type = text.toLowerCase();
            db.query('INSERT IGNORE INTO subscriptions (chat_id, type) VALUES (?, ?)', [chatId, type], (err) => {
                if (err) {
                    console.error('Error adding subscription:', err);
                    bot.sendMessage(chatId, `Ошибка при добавлении подписки на ${text.toLowerCase()}.`);
                } else {
                    bot.sendMessage(chatId, `Вы подписаны на ${text.toLowerCase()}.`, {
                        reply_markup: {
                            remove_keyboard: true
                        }
                    });
                }
            });
        } else if (text === 'Отмена') {
            bot.sendMessage(chatId, 'Операция отменена.', {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        }
    });
});bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Выберите, на что вы хотите подписаться:', {
        reply_markup: {
            keyboard: [
                ['Новости', 'Курсы', 'Товары'],
                ['Отмена']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });

    bot.once('message', (msg) => {
        const text = msg.text;

        let type;
        switch (text) {
            case 'Новости':
                type = 'news';
                break;
            case 'Курсы':
                type = 'course';
                break;
            case 'Товары':
                type = 'product';
                break;
            default:
                type = null;
                break;
        }

        if (type) {
            db.query('INSERT IGNORE INTO subscriptions (chat_id, type) VALUES (?, ?)', [chatId, type], (err) => {
                if (err) {
                    console.error('Error adding subscription:', err);
                    bot.sendMessage(chatId, `Ошибка при добавлении подписки на ${type}.`);
                } else {
                    bot.sendMessage(chatId, `Вы подписаны на ${text.toLowerCase()}.`, {
                        reply_markup: {
                            remove_keyboard: true
                        }
                    });
                }
            });
        } else if (text === 'Отмена') {
            bot.sendMessage(chatId, 'Операция отменена.', {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        }
    });
});


bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Выберите, от чего вы хотите отписаться:', {
        reply_markup: {
            keyboard: [
                ['Новости', 'Курсы', 'Товары'],
                ['Отмена']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });

    bot.once('message', (msg) => {
        const text = msg.text;
        let type;

        switch (text) {
            case 'Новости':
                type = 'news';
                break;
            case 'Курсы':
                type = 'course';
                break;
            case 'Товары':
                type = 'product';
                break;
            default:
                type = null;
                break;
        }

        if (type) {
            db.query('DELETE FROM subscriptions WHERE chat_id = ? AND type = ?', [chatId, type], (err) => {
                if (err) {
                    console.error('Error removing subscription:', err);
                    bot.sendMessage(chatId, `Ошибка при удалении подписки на ${text.toLowerCase()}.`);
                } else {
                    bot.sendMessage(chatId, `Вы отписались от ${text.toLowerCase()}.`, {
                        reply_markup: {
                            remove_keyboard: true
                        }
                    });
                }
            });
        } else if (text === 'Отмена') {
            bot.sendMessage(chatId, 'Операция отменена.', {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        }
    });
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
            store.forEach(storeItem => {
                let message = `*${storeItem.item_name}*\nОписание: ${storeItem.item_description}\nЦена: ${storeItem.item_price}\n\n`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            });
        }
    });
});

bot.onText(/\/review/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Пожалуйста, напишите ваш отзыв.');
    bot.once('message', (msg) => {
        const reviewContent = msg.text;
        const reviewerName = msg.from.username || 'Аноним';
        const createdAt = new Date();
        const query = 'INSERT INTO reviews (reviewer_name, review_content, created_at) VALUES (?, ?, ?)';
        db.query(query, [reviewerName, reviewContent, createdAt], (err) => {
            if (err) {
                console.error('Ошибка при сохранении отзыва:', err);
                bot.sendMessage(chatId, 'Произошла ошибка при сохранении вашего отзыва. Пожалуйста, попробуйте снова.');
                return;
            }
            bot.sendMessage(chatId, 'Ваш отзыв успешно сохранен. Спасибо!');
        });
    });
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const [newsSubscriptions] = await db.promise().query('SELECT COUNT(*) AS count FROM subscriptions WHERE type = ?', ['news']);
        const [coursesSubscriptions] = await db.promise().query('SELECT COUNT(*) AS count FROM subscriptions WHERE type = ?', ['course']);
        const [productsSubscriptions] = await db.promise().query('SELECT COUNT(*) AS count FROM subscriptions WHERE type = ?', ['product']);

        const newsCount = newsSubscriptions[0].count;
        const coursesCount = coursesSubscriptions[0].count;
        const productsCount = productsSubscriptions[0].count;

        bot.sendMessage(chatId, `Статистика подписок:\n\n` +
            `Новости: ${newsCount} пользователей\n` +
            `Курсы: ${coursesCount} пользователей\n` +
            `Товары: ${productsCount} пользователей`);
    } catch (err) {
        console.error('Error fetching statistics:', err);
        bot.sendMessage(chatId, 'Ошибка при получении статистики.');
    }
});
