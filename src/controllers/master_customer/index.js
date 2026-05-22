import axios from 'axios';
import { CustomerGroup, CustomerDetail } from '../../models/customer/index.js';

const ACCURATE_API_URL = process.env.ACCURATE_API_URL;
const ACCURATE_TOKEN = process.env.ACCURATE_TOKEN;
const ACCURATE_SESSION_ID = process.env.ACCURATE_SESSION_ID;

const accurateRequest = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${ACCURATE_API_URL}${endpoint}`, {
            params: params,
            headers: {
                'Authorization': `Bearer ${ACCURATE_TOKEN}`,
                'X-Session-ID': ACCURATE_SESSION_ID
            }
        });
        return response.data;
    } catch (error) {
        console.error('Accurate API Error:', error.response?.data || error.message);
        throw error;
    }
};

export const fetchAllCustomers = async (req, res) => {
    try {
        const group = await CustomerGroup.create({
            no_setting: `CUST_${Date.now()}`,
            status: 'IN_PROGRESS',
            total_data: 0
        });
        
        processFetchAllCustomers(group.id);
        
        res.json({
            success: true,
            message: 'Proses penarikan data customer dimulai',
            data: {
                group_id: group.id,
                status: group.status
            }
        });
    } catch (error) {
        console.error('Error creating customer fetch:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to start customer fetch',
            details: error.message
        });
    }
};

const processFetchAllCustomers = async (groupId) => {
    try {
        let allCustomers = [];
        let currentPage = 1;
        let totalPages = 1;
        const pageSize = 20; 
        
        console.log(`Mulai fetch semua customer...`);
        
        const firstParams = {
            'sp.page': 1,
            'sp.pageSize': pageSize
        };
        
        console.log(`Fetching customer page 1...`);
        const firstResponse = await accurateRequest('/customer/list.do', firstParams);
        
        if (firstResponse.sp && firstResponse.sp.pageCount) {
            totalPages = firstResponse.sp.pageCount;
            console.log(`Total pages: ${totalPages}, Total records: ${firstResponse.sp.rowCount}`);
        }
        
        for (let page = 1; page <= totalPages; page++) {
            const params = {
                'sp.page': page,
                'sp.pageSize': pageSize
            };
            
            console.log(`Fetching customer page ${page}/${totalPages}...`);
            const data = await accurateRequest('/customer/list.do', params);
            const customerIds = data.d || [];
            
            for (const customer of customerIds) {
                try {
                    const detailResponse = await accurateRequest('/customer/detail.do', {
                        id: customer.id
                    });
                    
                    if (detailResponse.s && detailResponse.d) {
                        const customerDetail = detailResponse.d;
                        allCustomers.push({
                            group_id: groupId, 
                            accurate_id: String(customerDetail.id),
                            customerNo: customerDetail.customerNo || null,
                            customerName: customerDetail.name || null,
                            customerId: String(customerDetail.id),
                            phone: customerDetail.mobilePhone || customerDetail.workPhone || customerDetail.fax || null,
                            raw_data: JSON.stringify(customerDetail)
                        });
                    }
                } catch (err) {
                    console.error(`Error fetching detail for customer ${customer.id}:`, err.message);
                    allCustomers.push({
                        group_id: groupId, 
                        accurate_id: String(customer.id),
                        customerNo: null,
                        customerName: null,
                        customerId: String(customer.id),
                        phone: null,
                        raw_data: null
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`Page ${page}: selesai memproses ${customerIds.length} customers (total: ${allCustomers.length})`);
            
            if (allCustomers.length >= 500) {
                await saveBatchToDatabase(groupId, allCustomers.splice(0, 500));
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`Selesai fetch. Total customers: ${allCustomers.length}`);
        
        if (allCustomers.length > 0) {
            await saveBatchToDatabase(groupId, allCustomers);
        }
        
        const totalSaved = await CustomerDetail.count({ where: { group_id: groupId } });
        
        await CustomerGroup.update({
            status: 'COMPLETED',
            total_data: totalSaved,
            total_pages: totalPages,
            total_records: totalSaved
        }, {
            where: { id: groupId }
        });
        
        console.log(`Group ${groupId} completed with ${totalSaved} customers from ${totalPages} pages`);
        
    } catch (error) {
        console.error(`Error processing group ${groupId}:`, error);
        
        await CustomerGroup.update({
            status: 'FAILED',
            error_message: error.message
        }, {
            where: { id: groupId }
        });
    }
};

const saveBatchToDatabase = async (groupId, customers) => {
    if (!customers || customers.length === 0) return;
    
    try {
        const customersWithGroupId = customers.map(c => ({
            ...c,
            group_id: groupId
        }));
        
        const created = await CustomerDetail.bulkCreate(customersWithGroupId);
        console.log(`Saved batch of ${created.length} customers to database`);
        return created;
    } catch (error) {
        console.error('Error saving batch:', error);
        throw error;
    }
};

export const getCustomerGroups = async (req, res) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const offset = (page - 1) * pageSize;
        
        const { count, rows } = await CustomerGroup.findAndCountAll({
            order: [['createdAt', 'DESC']],
            limit: parseInt(pageSize),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(count / pageSize)
            }
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch groups' 
        });
    }
};

export const getCustomerGroupDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await CustomerGroup.findByPk(id, {
            include: [{
                model: CustomerDetail,
                as: 'details',
                order: [['customerName', 'ASC']]
            }]
        });
        
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Group not found' 
            });
        }
        
        res.json({
            success: true,
            data: group
        });
    } catch (error) {
        console.error('Error fetching group detail:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch group detail' 
        });
    }
};

export const deleteCustomerDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        const detail = await CustomerDetail.findByPk(id);
        if (!detail) {
            return res.status(404).json({ 
                success: false, 
                error: 'Customer not found' 
            });
        }
        
        const groupId = detail.group_id;
        await detail.destroy();
        
        const remainingCount = await CustomerDetail.count({
            where: { group_id: groupId }
        });
        
        await CustomerGroup.update({
            total_data: remainingCount
        }, {
            where: { id: groupId }
        });
        
        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete customer' 
        });
    }
};

export const deleteCustomerGroup = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await CustomerGroup.findByPk(id);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Group not found' 
            });
        }
        
        await CustomerDetail.destroy({
            where: { group_id: id }
        });
        
        await group.destroy();
        
        res.json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete group' 
        });
    }
};