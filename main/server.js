require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const { check, validationResult } = require('express-validator');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Environment variables
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'G8kH6c9nFzTqZ7mP2bXxL3oR4aYvB1uJ6eQw8vPz';

// MySQL connection with Sequelize
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false // Disable SQL logging for cleaner console output
});

const app = express();

// Middleware
app.use(helmet()); // Add helmet for security headers
app.use(cors());
app.use(express.json()); // Built-in middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Built-in middleware to parse URL-encoded bodies
app.use(express.static(__dirname)); // Serve static files from the root directory

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
});
app.use(limiter); // Apply rate limiting to all requests

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Models
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
});

const Expense = sequelize.define('Expense', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false }
});

// Establish model relationships
User.hasMany(Expense, { foreignKey: 'userId' });
Expense.belongsTo(User, { foreignKey: 'userId' });

// Sync database
sequelize.sync()
    .then(() => console.log('Database synced'))
    .catch(err => logger.error('Error syncing database:', err));

// Helper function to authenticate users
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Serve index.html for root requests
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Register new user with validation
app.post('/register', [
    check('username').not().isEmpty().withMessage('Username is required'),
    check('email').isEmail().withMessage('Enter a valid email'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, email, password: hashedPassword });
        res.status(201).json({ success: true, user: newUser });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed. Error: ' + error.message });
    }
});

// Login user
app.post('/login', [
    check('email').isEmail().withMessage('Enter a valid email'),
    check('password').not().isEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ message: 'Login failed. Error: ' + error.message });
    }
});

// Add new expense
app.post('/add-expense', authenticateToken, [
    check('title').not().isEmpty().withMessage('Title is required'),
    check('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    check('date').isISO8601().withMessage('Date must be a valid date'),
    check('description').not().isEmpty().withMessage('Description is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, amount, date, description } = req.body;

    try {
        const newExpense = await Expense.create({
            userId: req.user.userId,
            title,
            amount,
            date,
            description // Store description instead of category
        });
        res.status(201).json({ success: true, expense: newExpense });
    } catch (error) {
        logger.error('Add expense error:', error);
        res.status(500).json({ success: false, message: 'Failed to add expense. Error: ' + error.message });
    }
});

// Get all expenses for the logged-in user
app.get('/expenses', authenticateToken, async (req, res) => {
    try {
        const expenses = await Expense.findAll({ where: { userId: req.user.userId } });
        res.json(expenses);
    } catch (error) {
        logger.error('Get expenses error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve expenses. Error: ' + error.message });
    }
});

// Edit an expense
app.put('/expenses/:id', authenticateToken, [
    check('title').not().isEmpty().withMessage('Title is required'),
    check('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    check('date').isISO8601().withMessage('Date must be a valid date'),
    check('description').not().isEmpty().withMessage('Description is required')
], async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, amount, date, description } = req.body;

    try {
        const expense = await Expense.findOne({ where: { id, userId: req.user.userId } });
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        expense.title = title;
        expense.amount = amount;
        expense.date = date;
        expense.description = description; // Update description instead of category
        await expense.save();

        res.json({ success: true, expense });
    } catch (error) {
        logger.error('Edit expense error:', error);
        res.status(500).json({ success: false, message: 'Failed to update expense. Error: ' + error.message });
    }
});

// Delete an expense
app.delete('/expenses/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const expense = await Expense.findOne({ where: { id, userId: req.user.userId } });
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        await expense.destroy();
        res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
        logger.error('Delete expense error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete expense. Error: ' + error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
