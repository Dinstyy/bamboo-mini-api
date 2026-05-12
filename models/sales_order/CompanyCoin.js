import { DataTypes } from 'sequelize'
import sequelize from '../../config/db.config'

const CompanyCoin = sequelize.define('company_coin', {
  total_coin: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  company_information_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true
})

export default CompanyCoin;