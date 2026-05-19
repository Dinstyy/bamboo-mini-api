import { DataTypes } from "sequelize";
import sequelize from "../../config/db.config.js";

const SalesOrder = sequelize.define('sales_order', {
    number: {
        type: DataTypes.INTEGER
    },
    branchId: {
        type: DataTypes.INTEGER
    },
    branchName: {
        type: DataTypes.STRING
    },
    customerNo: {
        type: DataTypes.STRING
    },
    customerName: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.INTEGER
    },
}, {
    freezeTableName: true,
    timestamps: true
});

export default SalesOrder;
