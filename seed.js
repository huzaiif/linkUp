const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/linkup.db');

const users = [
    { name: "Sarah Wilson", email: "sarah@example.com", pic: "images/member-1.png" },
    { name: "James Anderson", email: "james@example.com", pic: "images/member-2.png" },
    { name: "Emily Clark", email: "emily@example.com", pic: "images/member-3.png" },
    { name: "Michael Wright", email: "michael@example.com", pic: "images/member-4.png" }
];

const posts = [
    { user_index: 0, content: "Enjoying the beautiful sunset! 🌅", image: "images/feed-image-1.png" },
    { user_index: 1, content: "Just finished a marathon code session. 💻 #coding #life", image: "images/feed-image-2.png" },
    { user_index: 2, content: "Check out this amazing view from my hike today!", image: "images/feed-image-3.png" },
    { user_index: 3, content: "Coffee time! ☕", image: "images/feed-image-4.png" },
    { user_index: 0, content: "Loving the new LinkUp features!", image: null },
    { user_index: 1, content: "Can't believe it's already December.", image: null },
    { user_index: 2, content: "New recipe test: Success! 🍝", image: "images/feed-image-5.png" },
    { user_index: 3, content: "Anyone up for a game tonight?", image: null }
];

db.serialize(() => {
    // Clear tables
    db.run("DELETE FROM posts");
    db.run("DELETE FROM users");
    db.run("delete from sqlite_sequence where name='posts'");
    db.run("delete from sqlite_sequence where name='users'");

    console.log("Cleared existing data.");

    // Insert Users
    const userStmt = db.prepare("INSERT INTO users (name, email, password, profile_pic) VALUES (?, ?, 'password123', ?)");
    users.forEach(user => {
        userStmt.run(user.name, user.email, user.pic);
    });
    userStmt.finalize(() => {
        // Insert Posts
        db.all("SELECT id FROM users", (err, rows) => {
            if (err) {
                console.error(err);
                return;
            }
            const userIds = rows.map(r => r.id);
            const postStmt = db.prepare("INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)");

            posts.forEach(post => {
                const userId = userIds[post.user_index];
                if (userId) {
                    postStmt.run(userId, post.content, post.image);
                }
            });
            postStmt.finalize(() => {
                console.log("Seeding complete.");
                db.close();
            });
        });
    });
});
