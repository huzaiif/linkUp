require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

db.connect((err) => {
    if (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to DB. Applying schema...');
    db.query(schema, (err, results) => {
        if (err) {
            console.error('Schema application failed:', err);
            process.exit(1);
        }
        console.log('Schema applied successfully.');
        db.end();
    });
});
