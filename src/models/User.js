import { DataTypes } from 'sequelize';
import sequelize from '../../config/db.config.js'; 

const User = sequelize.define('user', {
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['username'] 
        }
    ]
});

export default User;