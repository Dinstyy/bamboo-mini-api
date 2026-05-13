import { Op } from 'sequelize';
import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';

import sequelize from './config/db.config.js';
import User from './models/User.js';
import CompanyInformation from './models/sales_order/CompanyInformation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT_BACKEND || 5001;

app.use(cors({
    origin: process.env.HOST_FRONTEND || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

sequelize.authenticate()
    .then(() => console.log('Database connected...'))
    .catch(err => console.log('Database error:', err));

sequelize.sync({ alter: true })
    .then(() => console.log('Models synced...'))
    .catch(err => console.log('Sync error:', err));

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email, companyOption, companyName, companyAddress, companyPhone, existingCompanyId } = req.body;

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let companyId = null;

        if (companyOption === 'new') {
            const newCompany = await CompanyInformation.create({
                company_name: companyName,
                address: companyAddress,
                phone: companyPhone,
                email: email
            });
            companyId = newCompany.id;
        } else if (companyOption === 'existing' && existingCompanyId) {
            const existingCompany = await CompanyInformation.findByPk(existingCompanyId);
            if (!existingCompany) {
                return res.status(400).json({ error: 'Selected company not found' });
            }
            companyId = existingCompanyId;
        }

        const newUser = await User.create({
            username,
            password: hashedPassword,
            email,
            company_id: companyId
        });

        if (companyOption === 'new' && companyId) {
            await CompanyInformation.update(
                { owner_id: newUser.id },
                { where: { id: companyId } }
            );
        }

        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, email: newUser.email, companyId: companyId },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                company_id: companyId
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, companyId: user.company_id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                company_id: user.company_id
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/companies', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findByPk(userId);
        
        const companies = await CompanyInformation.findAll({
            where: {
                [Op.or]: [
                    { owner_id: userId },        
                    { id: user.company_id }      
                ]
            },
            attributes: ['id', 'company_name', 'address', 'phone', 'email', 'owner_id'],
            include: [{
                model: User,
                as: 'owner',
                attributes: ['username'],
                required: false
            }]
        });
        
        res.json(companies);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/companies/add', authenticateToken, async (req, res) => {
    try {
        const { company_name, phone, address } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;
        
        if (!company_name) {
            return res.status(400).json({ error: 'Company name is required' });
        }
        
        const existingCompany = await CompanyInformation.findOne({
            where: { 
                company_name: company_name,
                owner_id: userId 
            }
        });
        
        if (existingCompany) {
            return res.status(400).json({ error: 'You already have a company with this name' });
        }
        
        const newCompany = await CompanyInformation.create({
            company_name,
            phone: phone || null,
            address: address || null,
            email: userEmail || null,
            owner_id: userId 
        });
        
        res.status(201).json({
            success: true,
            id: newCompany.id,
            message: 'Company added successfully'
        });
    } catch (error) {
        console.error('Error adding company:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/companies/switch/:companyId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { companyId } = req.params;
        
        const company = await CompanyInformation.findByPk(companyId);
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        
        await User.update(
            { company_id: companyId },
            { where: { id: userId } }
        );
        
        const updatedUser = await User.findByPk(userId);
        const newToken = jwt.sign(
            { 
                id: updatedUser.id, 
                username: updatedUser.username, 
                email: updatedUser.email, 
                companyId: updatedUser.company_id 
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            message: 'Switched to company successfully',
            token: newToken,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                company_id: updatedUser.company_id
            }
        });
    } catch (error) {
        console.error('Error switching company:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/public/companies', async (req, res) => {
    try {
        const companies = await CompanyInformation.findAll({
            attributes: ['id', 'company_name', 'address', 'phone', 'email', 'owner_id']
        });
        res.json(companies);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, phone, address } = req.body;
    
    const company = await CompanyInformation.findByPk(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    await company.update({
      company_name: company_name || company.company_name,
      phone: phone || company.phone,
      address: address || company.address
    });
    
    res.json({
      success: true,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await CompanyInformation.findByPk(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    await company.destroy();
    
    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'username', 'email', 'company_id']
        });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});