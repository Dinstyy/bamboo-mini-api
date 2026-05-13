import { DataTypes } from 'sequelize'
import sequelize from '../../config/db.config.js'
import User from '../User.js'  // ← import User

const CompanyInformation = sequelize.define('company_information', {
  company_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true
});

CompanyInformation.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

export default CompanyInformation;