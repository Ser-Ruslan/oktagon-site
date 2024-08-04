const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const port = 3000;

// Создайте объект TelegramBot с вашим токеном
const telegramBotToken = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(telegramBotToken);

// Конфигурация multer для загрузки изображений и материалов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

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

// Настройка Express
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Обработчик главной страницы
app.get('/', (req, res) => {
    res.render('index');
});

// Обработчик страницы новостей
app.get('/news', (req, res) => {
    db.query('SELECT * FROM news', (err, news) => {
        if (err) throw err;
        let newsWithFiles = [];
        let count = 0;

        if (news.length === 0) {
            res.render('news', { news: [] });
        } else {
            news.forEach(item => {
                db.query('SELECT * FROM files WHERE news_id = ?', [item.id], (err, files) => {
                    if (err) throw err;
                    item.files = files;
                    newsWithFiles.push(item);
                    count++;
                    if (count === news.length) {
                        res.render('news', { news: newsWithFiles });
                    }
                });
            });
        }
    });
});

// Обработчик создания новости
app.get('/news/create', (req, res) => {
    res.render('create-news');
});

app.post('/news', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'materials', maxCount: 10 }]), (req, res) => {
    const { title, content } = req.body;
    const image = req.files['image'] ? req.files['image'][0].filename : null;
    const materials = req.files['materials'] ? req.files['materials'].map(file => file.filename) : [];

    db.query('INSERT INTO news (title, content, image_path) VALUES (?, ?, ?)', [title, content, image], (err, results) => {
        if (err) throw err;
        const newsId = results.insertId;
        if (materials.length > 0) {
            materials.forEach(file => {
                db.query('INSERT INTO files (news_id, file_name) VALUES (?, ?)', [newsId, file], (err) => {
                    if (err) throw err;
                });
            });
        }
        res.redirect('/news');
        
        // Notify subscribers
        db.query('SELECT chat_id FROM subscriptions WHERE type = "news"', (err, users) => {
            if (err) {
                console.error('Error fetching subscribers for news:', err);
                return;
            }

            const chatIds = users.map(user => user.chat_id);
            const message = `📢 Новая новость добавлена: ${title}\n${content}`;

            chatIds.forEach(chatId => {
                bot.sendMessage(chatId, message)
                    .then(() => {
                        console.log(`Notification sent to chat ID: ${chatId}`);
                    })
                    .catch(error => {
                        console.error('Error sending notification:', error);
                    });
            });
        });
    });
});

// Обработчик редактирования новости
app.get('/news/edit/:id', (req, res) => {
    const newsId = req.params.id;
    db.query('SELECT * FROM news WHERE id = ?', [newsId], (err, news) => {
        if (err) throw err;
        if (news.length > 0) {
            db.query('SELECT * FROM files WHERE news_id = ?', [newsId], (err, files) => {
                if (err) throw err;
                res.render('edit-news', { news: news[0], files });
            });
        } else {
            res.status(404).send('Новость не найдена');
        }
    });
});

app.post('/news/edit/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'materials', maxCount: 10 }]), (req, res) => {
    const newsId = req.params.id;
    const { title, content } = req.body;
    const newImage = req.files['image'] ? req.files['image'][0].filename : null;
    const newMaterials = req.files['materials'] ? req.files['materials'].map(file => file.filename) : [];

    db.query('SELECT image_path FROM news WHERE id = ?', [newsId], (err, rows) => {
        if (err) throw err;
        const oldImage = rows[0] ? rows[0].image_path : null;

        const updatedImagePath = newImage || oldImage;

        db.query('UPDATE news SET title = ?, content = ?, image_path = ? WHERE id = ?', [title, content, updatedImagePath, newsId], (err) => {
            if (err) throw err;

            if (newImage && oldImage) {
                const oldImagePath = path.join(__dirname, 'uploads', oldImage);
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error('Error removing old image:', err);
                });
            }

            db.query('DELETE FROM files WHERE news_id = ?', [newsId], (err) => {
                if (err) throw err;

                if (newMaterials.length > 0) {
                    newMaterials.forEach(file => {
                        db.query('INSERT INTO files (news_id, file_name) VALUES (?, ?)', [newsId, file], (err) => {
                            if (err) throw err;
                        });
                    });
                }
                res.redirect('/news');
            });
        });
    });
});

// Обработчик удаления файла
app.post('/news/delete-file/:id', (req, res) => {
    const fileId = req.params.id;
    db.query('SELECT file_name FROM files WHERE id = ?', [fileId], (err, files) => {
        if (err) throw err;
        if (files.length > 0) {
            const fileName = files[0].file_name;
            const filePath = path.join(__dirname, 'uploads', fileName);
            fs.unlink(filePath, (err) => {
                if (err) throw err;
                db.query('DELETE FROM files WHERE id = ?', [fileId], (err) => {
                    if (err) throw err;
                    res.redirect('back');
                });
            });
        } else {
            res.status(404).send('Файл не найден');
        }
    });
});

// Обработчик удаления новости
app.post('/news/delete/:id', (req, res) => {
    const newsId = req.params.id;

    db.query('SELECT image_path FROM news WHERE id = ?', [newsId], (err, news) => {
        if (err) throw err;
        if (news.length > 0) {
            const imagePath = news[0].image_path;
            if (imagePath) {
                const imageFilePath = path.join(__dirname, 'uploads', imagePath);
                fs.unlink(imageFilePath, (err) => {
                    if (err) throw err;
                });
            }
        }

        db.query('DELETE FROM files WHERE news_id = ?', [newsId], (err) => {
            if (err) throw err;

            db.query('DELETE FROM news WHERE id = ?', [newsId], (err) => {
                if (err) throw err;
                res.redirect('/news');
            });
        });
    });
});

// Обработчик страницы курсов
app.get('/courses', (req, res) => {
    db.query('SELECT * FROM courses', (err, courses) => {
        if (err) throw err;
        res.render('courses', { courses });
    });
});

// Обработчик страницы создания курса
app.get('/courses/create', (req, res) => {
    res.render('create-course');
});

app.post('/courses', (req, res) => {
    const { name, description, price, discount, discountExpiry } = req.body;

    db.query('INSERT INTO courses (name, description, price, discount, discount_expiry) VALUES (?, ?, ?, ?, ?)', [name, description, price, discount || null, discountExpiry || null], (err) => {
        if (err) throw err;
        res.redirect('/courses');
        
        // Notify subscribers
        db.query('SELECT chat_id FROM subscriptions WHERE type = "course"', (err, users) => {
            if (err) {
                console.error('Error fetching subscribers for course:', err);
                return;
            }

            const chatIds = users.map(user => user.chat_id);
            const message = `📚 Новый курс добавлен: ${name}\nОписание: ${description}\nЦена: ${price}\nСкидка: ${discount || 'Нет'}`;

            chatIds.forEach(chatId => {
                bot.sendMessage(chatId, message)
                    .then(() => {
                        console.log(`Notification sent to chat ID: ${chatId}`);
                    })
                    .catch(error => {
                        console.error('Error sending notification:', error);
                    });
            });
        });
    });
});

// Обработчик редактирования курса
app.get('/courses/edit/:id', (req, res) => {
    const courseId = req.params.id;
    db.query('SELECT * FROM courses WHERE id = ?', [courseId], (err, courses) => {
        if (err) throw err;
        if (courses.length > 0) {
            res.render('edit-course', { course: courses[0] });
        } else {
            res.status(404).send('Курс не найден');
        }
    });
});

app.post('/courses/edit/:id', (req, res) => {
    const courseId = req.params.id;
    const { name, description, price, discount, discountExpiry } = req.body;

    db.query('UPDATE courses SET name = ?, description = ?, price = ?, discount = ?, discount_expiry = ? WHERE id = ?', [name, description, price, discount, discountExpiry || null, courseId], (err) => {
        if (err) throw err;
        res.redirect('/courses');
    });
});

// Обработчик удаления курса
app.post('/courses/delete/:id', (req, res) => {
    const courseId = req.params.id;

    db.query('DELETE FROM courses WHERE id = ?', [courseId], (err) => {
        if (err) throw err;
        res.redirect('/courses');
    });
});

// Обработчик обновления скидок
app.post('/api/discounts/update', (req, res) => {
    const { courseId, newDiscount } = req.body;

    db.query('UPDATE courses SET discount = ? WHERE id = ?', [newDiscount, courseId], (err) => {
        if (err) {
            console.error('Error updating discount:', err);
            res.status(500).send('Error updating discount');
            return;
        }

        db.query('SELECT chat_id FROM subscriptions WHERE type = "course"', (err, users) => {
            if (err) {
                console.error('Error fetching users for discount notification:', err);
                res.status(500).send('Error fetching users');
                return;
            }

            const chatIds = users.map(user => user.chat_id);
            const message = `🔔 Обновление скидки: Курс ID ${courseId} теперь со скидкой ${newDiscount}.`;

            chatIds.forEach(chatId => {
                bot.sendMessage(chatId, message)
                    .then(() => {
                        console.log(`Notification sent to chat ID: ${chatId}`);
                    })
                    .catch(error => {
                        console.error('Error sending notification:', error);
                    });
            });

            res.send('Discount updated and notifications sent');
        });
    });
});

// Обработчик подписки на новости, курсы и товары
app.post('/subscriptions/add', (req, res) => {
    const { chatId, type } = req.body;

    if (!['news', 'course', 'product'].includes(type)) {
        return res.status(400).send('Invalid subscription type');
    }

    db.query('INSERT IGNORE INTO subscriptions (chat_id, type) VALUES (?, ?)', [chatId, type], (err) => {
        if (err) {
            console.error('Error adding subscription:', err);
            res.status(500).send('Error adding subscription');
            return;
        }

        res.send('Subscription added');
    });
});

app.post('/subscriptions/remove', (req, res) => {
    const { chatId, type } = req.body;

    if (!['news', 'course', 'product'].includes(type)) {
        return res.status(400).send('Invalid subscription type');
    }

    db.query('DELETE FROM subscriptions WHERE chat_id = ? AND type = ?', [chatId, type], (err) => {
        if (err) {
            console.error('Error removing subscription:', err);
            res.status(500).send('Error removing subscription');
            return;
        }

        res.send('Subscription removed');
    });
});

// Команда для списка всех подписок (по типам)
app.get('/subscriptions', (req, res) => {
    db.query('SELECT * FROM subscriptions', (err, subscriptions) => {
        if (err) throw err;
        res.json(subscriptions);
    });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
