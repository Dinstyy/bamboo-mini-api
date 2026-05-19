import { DataTypes } from "sequelize";
import sequelize from '../config/db.config';

/**
 * NOTE: Statuses Info
 * 0 = pending,
 * 1 = on progress,
 * 2 = successfully,
 * 3 = failed,
 * 4 = partial failed
 */

const PurchaseOrderGroup = sequelize.define('purchase_order_group', {
    no_setting: {
        type: DataTypes.STRING
    },
    modul: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.INTEGER
    },
    error_message: {
        type: DataTypes.TEXT
    }
}, {
    freezeTableName: true,
    timestamps: true
});

export default PurchaseOrderGroup;
