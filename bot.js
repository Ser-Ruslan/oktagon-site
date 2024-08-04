const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2');

// Создание бота
const token = '7363437148:AAHecv5tqcoTEvhMuFS1swyj1BfatGmHpGs';
const bot = new TelegramBot(token, { polling: true });

// Подключение к базе данных
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'oktagon'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Добро пожаловать! Для получения списка доступных команд используйте /help.');
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Вот доступные команды:\n\n' +
        '/start - Приветственное сообщение\n' +
        '/help - Список доступных команд\n' +
        '/subscribe - Подписаться на новости, курсы или товары\n' +
        '/unsubscribe [type] - Отписаться от [news, course, product]\n' +
        '/news - Получить новости\n' +
        '/courses - Получить список курсов\n' +
        '/products - Получить список товаров');
});

// Обработка команды /subscribe
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

// Обработка команды /news
bot.onText(/\/news/, (msg) => {
    const chatId = msg.chat.id;
    db.query('SELECT * FROM news', (err, news) => {
        if (err) {
            console.error('Error fetching news:', err);
            bot.sendMessage(chatId, 'Ошибка при получении новостей.');
            return;
        }

        if (news.length === 0) {
            bot.sendMessage(chatId, 'Нет новостей для отображения.');
        } else {
            news.forEach(item => {
                let message = `*${item.title}*\n${item.content}\n\n`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

                if (item.image_path) {
                    bot.sendPhoto(chatId, `http://localhost:3000/uploads/${item.image_path}`);
                }
            });
        }
    });
});

// Обработка команды /courses
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

// Обработка команды /products
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
