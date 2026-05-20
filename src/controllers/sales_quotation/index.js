import axios from 'axios';
import { SalesQuotationGroup, SalesQuotationDetail } from '../../models/sales_quotation/index.js';

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

export const fetchSalesQuotationByDate = async (req, res) => {
    try {
        const { tanggal_mulai, tanggal_akhir } = req.body;
        
        if (!tanggal_mulai || !tanggal_akhir) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tanggal mulai dan tanggal akhir wajib diisi' 
            });
        }
        
        const group = await SalesQuotationGroup.create({
            no_setting: `SQ_${Date.now()}`,
            tanggal_mulai,
            tanggal_akhir,
            status: 'IN_PROGRESS',
            total_data: 0
        });
        
        processFetchData(group.id, tanggal_mulai, tanggal_akhir);
        
        res.json({
            success: true,
            message: 'Proses penarikan data dimulai',
            data: {
                group_id: group.id,
                status: group.status
            }
        });
    } catch (error) {
        console.error('Error creating sales quotation fetch:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to start sales quotation fetch',
            details: error.message
        });
    }
};

const processFetchData = async (groupId, tanggal_mulai, tanggal_akhir) => {
    try {
        const formatDateToAPI = (date) => {
            if (!date) return null;
            if (date.includes('/')) return date;
            const parts = date.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return date;
        };
        
        const params = {
            fields: 'id,number,transDate,name',
            pageSize: 1000,
            'filter.transDate.op': 'BETWEEN',
            'filter.transDate.val': `${formatDateToAPI(tanggal_mulai)},${formatDateToAPI(tanggal_akhir)}`
        };
        
        console.log('Calling Accurate API with params:', params);
        
        const data = await accurateRequest('/sales-quotation/list.do', params);
        let results = data.d || [];
        
        console.log(`Found ${results.length} total items from API`);
        
        const filteredResults = results.filter(item => {
            if (!item.transDate) return false;
            const parts = item.transDate.split('/');
            const itemDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            const startDate = new Date(tanggal_mulai);
            const endDate = new Date(tanggal_akhir);
            return itemDate >= startDate && itemDate <= endDate;
        });
        
        console.log(`After re-filter: ${filteredResults.length} items`);
        
        const savedItems = [];
        
        for (const item of filteredResults) {
            const savedDetail = await SalesQuotationDetail.create({
                group_id: groupId,
                accurate_id: String(item.id),
                number: item.number,
                transDate: item.transDate ? new Date(item.transDate.split('/').reverse().join('-')) : null,
                name: item.name || null,
                raw_data: JSON.stringify(item)
            });
            savedItems.push(savedDetail);
        }
        
        await SalesQuotationGroup.update({
            status: savedItems.length > 0 ? 'COMPLETED' : 'COMPLETED',
            total_data: savedItems.length
        }, {
            where: { id: groupId }
        });
        
        console.log(`Group ${groupId} completed with ${savedItems.length} items`);
        
    } catch (error) {
        console.error(`Error processing group ${groupId}:`, error);
        
        await SalesQuotationGroup.update({
            status: 'FAILED',
            error_message: error.message
        }, {
            where: { id: groupId }
        });
    }
};

export const getSalesQuotationGroups = async (req, res) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const offset = (page - 1) * pageSize;
        
        const { count, rows } = await SalesQuotationGroup.findAndCountAll({
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

export const getSalesQuotationGroupDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await SalesQuotationGroup.findByPk(id, {
            include: [{
                model: SalesQuotationDetail,
                as: 'details',
                order: [['transDate', 'DESC']]
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

export const deleteSalesQuotationDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        const detail = await SalesQuotationDetail.findByPk(id);
        if (!detail) {
            return res.status(404).json({ 
                success: false, 
                error: 'Transaction not found' 
            });
        }
        
        const groupId = detail.group_id;
        await detail.destroy();
        
        const remainingCount = await SalesQuotationDetail.count({
            where: { group_id: groupId }
        });
        
        await SalesQuotationGroup.update({
            total_data: remainingCount
        }, {
            where: { id: groupId }
        });
        
        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete transaction' 
        });
    }
};

export const deleteSalesQuotationGroup = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await SalesQuotationGroup.findByPk(id);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Group not found' 
            });
        }
        
        await SalesQuotationDetail.destroy({
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

export const getSalesQuotationList = async (req, res) => {
    try {
        const { fields, page, pageSize, tanggal_mulai, tanggal_akhir } = req.query;
        
        const params = {};
        params.fields = fields || 'id,number,transDate,name';
        if (page) params.page = page;
        if (pageSize) params.pageSize = pageSize;
        
        if (tanggal_mulai && tanggal_akhir) {
            const formatToAPI = (date) => {
                if (!date) return null;
                if (date.includes('/')) return date;
                const parts = date.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return date;
            };
            
            params['filter.transDate.op'] = 'BETWEEN';
            params['filter.transDate.val'] = `${formatToAPI(tanggal_mulai)},${formatToAPI(tanggal_akhir)}`;
        }
        
        console.log('Calling Accurate API with params:', params);
        
        const data = await accurateRequest('/sales-quotation/list.do', params);
        
        res.json({
            success: true,
            data: data.d || [],
            pagination: data.sp || null
        });
    } catch (error) {
        console.error('Error fetching sales quotation list:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch sales quotation list',
            details: error.response?.data || error.message
        });
    }
};