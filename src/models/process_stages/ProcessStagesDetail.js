import { DataTypes } from "sequelize";
import sequelize from '../../../config/db.config.js';

const ProcessStagesDetail = sequelize.define('process_stages_detail', {
    group_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    accurate_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    number: {
        type: DataTypes.STRING
    },
    workOrderNumber: {
        type: DataTypes.STRING
    },
    quantity: {
        type: DataTypes.DECIMAL(15, 2)
    },
    transDate: {
        type: DataTypes.DATEONLY
    },
    instruction: {
        type: DataTypes.TEXT
    },
    processStagesType: {
        type: DataTypes.STRING
    },
    itemName: {
        type: DataTypes.STRING
    },
    itemNo: {
        type: DataTypes.STRING
    },
    raw_data: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    export_status: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'),
        defaultValue: 'PENDING'
    },
    export_error_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    export_response: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    exported_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    freezeTableName: true,
    timestamps: true
});

export default ProcessStagesDetail;