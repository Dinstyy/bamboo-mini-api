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
import { 
    fetchSalesQuotationByDate,
    getSalesQuotationGroups,
    getSalesQuotationGroupDetail,
    deleteSalesQuotationDetail,
    deleteSalesQuotationGroup,
    getSalesQuotationList,
    getSalesQuotationDetail,
    bulkExportToAccurate  
} from '../src/controllers/sales_quotation/index.js';
import { 
    fetchAllCustomers,
    getCustomerGroups,
    getCustomerGroupDetail,
    deleteCustomerDetail,
    deleteCustomerGroup
} from '../src/controllers/master_customer/index.js';

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

router.post('/api/sales-quotation/fetch', authenticateToken, fetchSalesQuotationByDate);
router.get('/api/sales-quotation/groups', authenticateToken, getSalesQuotationGroups);
router.get('/api/sales-quotation/groups/:id', authenticateToken, getSalesQuotationGroupDetail);
router.delete('/api/sales-quotation/groups/:id', authenticateToken, deleteSalesQuotationGroup);
router.delete('/api/sales-quotation/details/:id', authenticateToken, deleteSalesQuotationDetail);
router.get('/api/sales-quotation/list', authenticateToken, getSalesQuotationList);
router.get('/api/sales-quotation/detail', authenticateToken, getSalesQuotationDetail);
router.post('/api/sales-quotation/bulk-export', authenticateToken, bulkExportToAccurate);

router.post('/api/master-customer/fetch', authenticateToken, fetchAllCustomers);
router.get('/api/master-customer/groups', authenticateToken, getCustomerGroups);
router.get('/api/master-customer/groups/:id', authenticateToken, getCustomerGroupDetail);
router.delete('/api/master-customer/groups/:id', authenticateToken, deleteCustomerGroup);
router.delete('/api/master-customer/details/:id', authenticateToken, deleteCustomerDetail);

export default router;