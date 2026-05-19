import { DataTypes } from "sequelize";
import sequelize from '../../../config/db.config.js';

const ProcessStagesGroup = sequelize.define('process_stages_group', {
    no_setting: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tanggal_mulai: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    tanggal_akhir: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'),
        defaultValue: 'PENDING'
    },
    total_data: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

export default ProcessStagesGroup;