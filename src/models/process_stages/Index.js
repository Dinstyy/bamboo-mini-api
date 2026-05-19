import ProcessStagesGroup from './ProcessStagesGroup.js';
import ProcessStagesDetail from './ProcessStagesDetail.js';

ProcessStagesGroup.hasMany(ProcessStagesDetail, { foreignKey: 'group_id', as: 'details' });
ProcessStagesDetail.belongsTo(ProcessStagesGroup, { foreignKey: 'group_id', as: 'group' });

export {
    ProcessStagesGroup,
    ProcessStagesDetail
};