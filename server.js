const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const axios = require('axios');

const app = express();
const port = 3000;


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


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


app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.get('/', (req, res) => {
    res.render('index');
});


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
    });
});


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


app.get('/courses', (req, res) => {
    db.query('SELECT * FROM courses', (err, courses) => {
        if (err) throw err;
        res.render('courses', { courses }); 
    });
});


app.get('/courses/create', (req, res) => {
    res.render('create-course');
});

app.post('/courses/create', (req, res) => {
    const { name, description, price, discount, discountExpiry } = req.body;

    db.query('INSERT INTO courses (name, description, price, discount, discount_expiry) VALUES (?, ?, ?, ?, ?)', [name, description, price, discount, discountExpiry || null], (err) => {
        if (err) throw err;
        res.redirect('/courses');
    });
});


app.get('/courses/edit/:id', (req, res) => {
    const courseId = req.params.id;
    db.query('SELECT * FROM courses WHERE id = ?', [courseId], (err, course) => {
        if (err) throw err;
        if (course.length > 0) {
            res.render('edit-course', { course: course[0] });
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


app.post('/courses/delete/:id', (req, res) => {
    const courseId = req.params.id;
    db.query('DELETE FROM courses WHERE id = ?', [courseId], (err) => {
        if (err) throw err;
        res.redirect('/courses');
    });
});


app.get('/store', (req, res) => {
    db.query('SELECT * FROM store', (err, items) => {
        if (err) throw err;
        
        if (!items) {
            items = [];
        }

        
        const itemsWithImages = items.map(item => {
            return new Promise((resolve, reject) => {
                db.query('SELECT image_url FROM item_images WHERE item_id = ?', [item.id], (err, images) => {
                    if (err) reject(err);
                    item.images = images.map(img => img.image_url);
                    resolve(item);
                });
            });
        });

        Promise.all(itemsWithImages).then(items => {
            res.render('store', { items });
        }).catch(err => {
            res.status(500).send('Ошибка при загрузке товаров');
        });
    });
});




app.get('/store/create', (req, res) => {
    res.render('create_item');
});

app.post('/store/create', upload.array('item_images', 5), (req, res) => {
    const { item_name, item_description, item_price } = req.body;
    db.query('INSERT INTO store (item_name, item_description, item_price) VALUES (?, ?, ?)', 
    [item_name, item_description, item_price], (err, results) => {
        if (err) throw err;
        const storeId = results.insertId;
        const images = req.files.map(file => [storeId, file.filename]);
        if (images.length > 0) {
            db.query('INSERT INTO item_images (item_id, image_url) VALUES ?', [images], (err) => {
                if (err) throw err;
                res.redirect('/store');
            });
        } else {
            res.redirect('/store');
        }
    });
});



app.get('/store/edit/:id', (req, res) => {
    const itemId = req.params.id;
    db.query('SELECT * FROM store WHERE id = ?', [itemId], (err, item) => {
        if (err) throw err;
        if (item.length > 0) {
            db.query('SELECT image_url FROM item_images WHERE item_id = ?', [itemId], (err, images) => {
                if (err) throw err;
                res.render('edit_item', { item: item[0], images });
            });
        } else {
            res.status(404).send('Товар не найден');
        }
    });
});

app.post('/store/edit/:id', upload.array('item_images', 5), (req, res) => {
    const itemId = req.params.id;
    const { item_name, item_description, item_price } = req.body;

    db.query('UPDATE store SET item_name = ?, item_description = ?, item_price = ? WHERE id = ?', 
    [item_name, item_description, item_price, itemId], (err) => {
        if (err) throw err;

        if (req.files.length > 0) {
            db.query('SELECT image_url FROM item_images WHERE item_id = ?', [itemId], (err, images) => {
                if (err) throw err;

              
                images.forEach(image => {
                    const filePath = path.join(__dirname, 'uploads', image.image_url);
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error removing old image:', err);
                    });
                });

                db.query('DELETE FROM item_images WHERE item_id = ?', [itemId], (err) => {
                    if (err) throw err;
                    const newImages = req.files.map(file => [itemId, file.filename]);
                    db.query('INSERT INTO item_images (item_id, image_url) VALUES ?', [newImages], (err) => {
                        if (err) throw err;
                        res.redirect('/store');
                    });
                });
            });
        } else {
            res.redirect('/store');
        }
    });
});



app.post('/store/delete/:id', (req, res) => {
    const itemId = req.params.id;
    db.query('SELECT image_url FROM item_images WHERE item_id = ?', [itemId], (err, images) => {
        if (err) throw err;

      
        images.forEach(image => {
            const filePath = path.join(__dirname, 'uploads', image.image_url);
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error removing image:', err);
            });
        });

        db.query('DELETE FROM item_images WHERE item_id = ?', [itemId], (err) => {
            if (err) throw err;
            db.query('DELETE FROM store WHERE id = ?', [itemId], (err) => {
                if (err) throw err;
                res.redirect('/store');
            });
        });
    });
});

const sendNotification = (category, message) => {
    db.query('SELECT user_id FROM subscriptions WHERE category = ?', [category], (err, results) => {
        if (err) throw err;
        results.forEach(row => {
            const userId = row.user_id;
            axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: userId,
                text: message
            }).catch(err => console.error('Error sending message:', err));
        });
    });
};


app.get('/reviews', (req, res) => {
    db.query('SELECT * FROM reviews', (err, reviews) => {
        if (err) throw err;
        res.render('reviews', { reviews });
    });
});

app.get('/api/courses', (req, res) => {
    db.query('SELECT * FROM courses ORDER BY id DESC LIMIT 10', (err, courses) => {
        if (err) throw err;
        res.json(courses);
    });
});


app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC LIMIT 10', (err, products) => {
        if (err) throw err;
        res.json(products);
    });
});


app.get('/api/news', (req, res) => {
    db.query('SELECT * FROM news ORDER BY id DESC LIMIT 10', (err, news) => {
        if (err) throw err;
        res.json(news);
    });
});


app.listen(port, () => {
    console.log(`Сервер запущен на ${port}`);
});
