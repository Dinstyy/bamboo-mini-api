import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import sequelize from './config/db.config.js';
import router from './router/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT_BACKEND || 5001;

app.use(cors({
    origin: process.env.HOST_FRONTEND || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

sequelize.authenticate()
    .then(() => console.log('Database connected...'))
    .catch(err => console.log('Database error:', err));

sequelize.sync({ alter: true })
    .then(() => console.log('Models synced...'))
    .catch(err => console.log('Sync error:', err));

app.use('/', router);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});