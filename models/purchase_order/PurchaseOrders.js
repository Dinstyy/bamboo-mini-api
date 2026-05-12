import { DataTypes } from "sequelize";
import sequelize from "../../config/db.config.js";

const PurchaseOrders = sequelize.define('purchase_order', {
    number: {
        type: DataTypes.INTEGER
    },
    branch_id: {
        type: DataTypes.INTEGER
    },
    branch_name: {
        type: DataTypes.STRING
    },
    vendor_no: {
        type: DataTypes.STRING
    },
    vendor_name: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.INTEGER
    },
}, {
    freezeTableName: true,
    timestamps: true
});

export default PurchaseOrders;
