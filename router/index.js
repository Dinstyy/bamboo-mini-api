import express from 'express';
import { 
    register, 
    login, 
    getCompanies, 
    addCompany, 
    switchCompany,
    getPublicCompanies,
    updateCompany,
    deleteCompany,
    verify,
    authenticateToken
} from '../src/controllers/register_company/index.js';
import { 
    getProcessStagesList, 
    getProcessStageDetail,
    fetchProcessStagesByDate,
    getProcessStagesGroups,
    getProcessStagesGroupDetail,
    deleteProcessStagesDetail,
    deleteProcessStagesGroup,
    exportToAccurate,      
    getExportStatus  
} from '../src/controllers/process_stages/index.js';

const router = express.Router();

router.post('/api/register', register);
router.post('/api/login', login);
router.get('/api/verify', verify);
router.get('/api/companies', authenticateToken, getCompanies);
router.post('/api/companies/add', authenticateToken, addCompany);
router.post('/api/companies/switch/:companyId', authenticateToken, switchCompany);
router.get('/api/public/companies', getPublicCompanies);
router.put('/api/companies/:id', authenticateToken, updateCompany);
router.delete('/api/companies/:id', authenticateToken, deleteCompany);

router.get('/api/process-stages/list', authenticateToken, getProcessStagesList);
router.post('/api/process-stages/list', authenticateToken, getProcessStagesList);
router.get('/api/process-stages/detail', authenticateToken, getProcessStageDetail);

router.post('/api/process-stages/fetch', authenticateToken, fetchProcessStagesByDate);
router.get('/api/process-stages/groups', authenticateToken, getProcessStagesGroups);
router.get('/api/process-stages/groups/:id', authenticateToken, getProcessStagesGroupDetail);
router.delete('/api/process-stages/groups/:id', authenticateToken, deleteProcessStagesGroup);
router.delete('/api/process-stages/details/:id', authenticateToken, deleteProcessStagesDetail);
router.post('/api/process-stages/export/:id', authenticateToken, exportToAccurate);
router.get('/api/process-stages/export/:id/status', authenticateToken, getExportStatus);

export default router;