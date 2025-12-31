const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public/images/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/uploads/');
    },
    filename: (req, file, cb) => {
        // Create unique filename: user-[timestamp]-[originalName]
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    }
});

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
});

// Database Setup (SQLite)
const db = new sqlite3.Database('./database/linkup.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            profile_pic TEXT DEFAULT 'images/profile-pic.png',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`UPDATE users SET profile_pic = 'images/profile-pic.png' WHERE profile_pic = 'images/profile-pic.jpg'`, (err) => {
            if (err) console.error("Error updating profile pics:", err);
        });

        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            UNIQUE(user_id, post_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )`);
        console.log('Database tables initialized.');
    });
}

// Helper for DB queries (Promisify-like)
// SQLite methods: run (INSERT/UPDATE), all (SELECT many), get (SELECT one)

// Routes

// Register
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    const profilePic = 'images/profile-pic.jpg';

    const query = 'INSERT INTO users (name, email, password, profile_pic) VALUES (?, ?, ?, ?)';
    db.run(query, [name, email, password, profilePic], function (err) {
        if (err) {
            console.error(err);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ message: 'User already exists' });
            }
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }
        res.status(201).json({ message: 'User registered successfully', id: this.lastID });
    });
});

// Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT * FROM users WHERE email = ?';

    db.get(query, [email], (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!user) return res.status(401).json({ message: 'Invalid email or password' });

        if (user.password !== password) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const { password: _, ...userData } = user;
        res.status(200).json({ message: 'Login successful', user: userData });
    });
});

// Get User
app.get('/user/:email', (req, res) => {
    const email = req.params.email;
    const query = 'SELECT id, name, email, profile_pic FROM users WHERE email = ?';
    db.get(query, [email], (err, row) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!row) return res.status(404).json({ message: 'User not found' });
        res.json(row);
    });
});

// Upload Profile Picture
app.post('/upload-profile-pic', upload.single('profile_pic'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const userId = req.body.user_id;

    if (!userId) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'User ID required' });
    }

    const filePath = 'images/uploads/' + req.file.filename;

    const query = 'UPDATE users SET profile_pic = ? WHERE id = ?';
    db.run(query, [filePath, userId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Profile picture updated', profile_pic: filePath });
    });
});

// Get All Posts
app.get('/posts', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const userId = req.query.userId;

    let query = `
        SELECT posts.*, users.name as user_name, users.profile_pic as user_pic,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comment_count
        FROM posts
        JOIN users ON posts.user_id = users.id
    `;

    const params = [];
    if (userId) {
        query += ` WHERE posts.user_id = ?`;
        params.push(userId);
    }

    query += ` ORDER BY posts.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(rows);
    });
});

// Delete Post
app.delete('/posts/:id', (req, res) => {
    const postId = req.params.id;
    const userId = req.body.userId;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // First check if post belongs to user
    const checkQuery = "SELECT * FROM posts WHERE id = ? AND user_id = ?";
    db.get(checkQuery, [postId, userId], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }
        if (!row) {
            return res.status(403).json({ message: "Unauthorized or post not found" });
        }

        // Delete the post
        const deleteQuery = "DELETE FROM posts WHERE id = ?";
        db.run(deleteQuery, [postId], function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error" });
            }
            res.json({ message: "Post deleted" });
        });
    });
});

// Create Post
app.post('/posts', (req, res) => {
    const { user_id, content, image_url } = req.body;
    if (!user_id || (!content && !image_url)) {
        return res.status(400).json({ message: 'Content or image required' });
    }
    const query = 'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)';
    db.run(query, [user_id, content, image_url], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.status(201).json({ message: 'Post created', id: this.lastID });
    });
});

// Toggle Like
app.post('/posts/:postId/like', (req, res) => {
    const { user_id } = req.body;
    const postId = req.params.postId;

    const checkQuery = 'SELECT * FROM likes WHERE user_id = ? AND post_id = ?';
    db.get(checkQuery, [user_id, postId], (err, row) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (row) {
            db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [user_id, postId], (err) => {
                if (err) return res.status(500).json({ message: 'Database error' });
                res.json({ message: 'Unliked' });
            });
        } else {
            db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [user_id, postId], (err) => {
                if (err) return res.status(500).json({ message: 'Database error' });
                res.json({ message: 'Liked' });
            });
        }
    });
});

// Add Comment
app.post('/posts/:postId/comments', (req, res) => {
    const { user_id, content } = req.body;
    const postId = req.params.postId;

    const query = 'INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)';
    db.run(query, [user_id, postId, content], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(201).json({ message: 'Comment added' });
    });
});

// Get Comments
app.get('/posts/:postId/comments', (req, res) => {
    const postId = req.params.postId;
    const query = `
        SELECT comments.*, users.name as user_name, users.profile_pic as user_pic
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.post_id = ?
        ORDER BY comments.created_at ASC
    `;
    db.all(query, [postId], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(rows);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
