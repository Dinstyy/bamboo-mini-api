import axios from 'axios';
import { Op } from 'sequelize';
import { ProcessStagesGroup, ProcessStagesDetail } from '../../models/process_stages/index.js';

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

export const fetchProcessStagesByDate = async (req, res) => {
    try {
        const { tanggal_mulai, tanggal_akhir } = req.body;
        
        if (!tanggal_mulai || !tanggal_akhir) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tanggal mulai dan tanggal akhir wajib diisi' 
            });
        }
        
        const group = await ProcessStagesGroup.create({
            no_setting: `PS_${Date.now()}`,
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
        console.error('Error creating process stages fetch:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to start process stages fetch',
            details: error.message
        });
    }
};

const processFetchData = async (groupId, tanggal_mulai, tanggal_akhir) => {
    try {
        console.log(`Tanggal dari frontend: mulai=${tanggal_mulai}, akhir=${tanggal_akhir}`);
        
        const listParams = {
            fields: 'id,number,transDate',
            pageSize: 1000
        };
        
        const listData = await accurateRequest('/process-stages/list.do', listParams);
        
        let results = listData.d || [];
        
        if (results.length > 0) {
            console.log('Sample transDate dari API:', results[0].transDate);
        }
        
        const filteredItems = results.filter(item => {
            let itemDate = item.transDate;
            if (itemDate && itemDate.includes('/')) {
                const parts = itemDate.split('/');
                itemDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            console.log(`Item ${item.id}: date=${itemDate}, filter: ${tanggal_mulai} <= ${itemDate} <= ${tanggal_akhir}`);
            return itemDate >= tanggal_mulai && itemDate <= tanggal_akhir;
        });
        
        console.log(`After RANGE filter: ${filteredItems.length} items (from ${tanggal_mulai} to ${tanggal_akhir})`);
        
        const savedItems = [];
        
        for (const item of filteredItems) {
            try {
                const detailData = await accurateRequest('/process-stages/detail.do', { id: item.id });
                const detail = detailData.d || detailData;
                
                console.log(`Detail for item ${item.id}:`, {
                    workOrderNumber: detail.workOrderNumber,
                    quantity: detail.quantity,
                    processStagesType: detail.processStagesType,
                    item: detail.item
                });
                
                const itemInfo = detail.item || {};
                
                const savedDetail = await ProcessStagesDetail.create({
                    group_id: groupId,
                    accurate_id: String(item.id),
                    number: item.number || detail.number,
                    workOrderNumber: detail.workOrderNumber || null,
                    quantity: detail.quantity || 0,
                    transDate: item.transDate || detail.transDate,
                    instruction: detail.description || detail.instruction || null,
                    processStagesType: detail.processStagesType || null,
                    itemName: itemInfo.name || null,      
                    itemNo: itemInfo.no || null,        
                    raw_data: JSON.stringify({ list: item, detail: detail })
                });
                savedItems.push(savedDetail);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (detailError) {
                console.error(`Failed to fetch detail for item ${item.id}:`, detailError.message);
                const savedDetail = await ProcessStagesDetail.create({
                    group_id: groupId,
                    accurate_id: String(item.id),
                    number: item.number,
                    workOrderNumber: null,
                    quantity: 0,
                    transDate: item.transDate,
                    instruction: null,
                    processStagesType: null,
                    itemName: null,
                    itemNo: null,
                    raw_data: JSON.stringify({ list: item, error: detailError.message })
                });
                savedItems.push(savedDetail);
            }
        }
        
        await ProcessStagesGroup.update({
            status: savedItems.length > 0 ? 'COMPLETED' : 'COMPLETED',
            total_data: savedItems.length
        }, {
            where: { id: groupId }
        });
        
        console.log(`Group ${groupId} completed with ${savedItems.length} items`);
        
    } catch (error) {
        console.error(`Error processing group ${groupId}:`, error);
        
        await ProcessStagesGroup.update({
            status: 'FAILED',
            error_message: error.message
        }, {
            where: { id: groupId }
        });
    }
};

export const exportToAccurate = async (req, res) => {
    try {
        const { id } = req.params;
        
        const transaction = await ProcessStagesDetail.findByPk(id);
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }
        
        if (transaction.export_status === 'SUCCESS') {
            return res.status(400).json({
                success: false,
                error: 'Transaction already exported successfully'
            });
        }
        
        await transaction.update({
            export_status: 'IN_PROGRESS',
            export_error_message: null
        });
        
        const formatDateForAccurate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };
        
        const exportData = {
            processCategoryId: 50,  
            processCategoryName: "Di kumpulkan", 
            processStagesType: transaction.processStagesType || "START_PROCESS", 
            transDate: formatDateForAccurate(transaction.transDate),  
            workOrderNumber: transaction.workOrderNumber,
            description: transaction.instruction || null,
            quantity: transaction.quantity || 0,
            number: transaction.number || null,
            workTimeHours: 0,
            workTimeMinutes: 0
        };
        
        console.log('Sending to Accurate:', JSON.stringify(exportData, null, 2));
        
        try {
            const response = await axios.post(
                `${ACCURATE_API_URL}/process-stages/save.do`,
                exportData,
                {
                    headers: {
                        'Authorization': `Bearer ${ACCURATE_TOKEN}`,
                        'X-Session-ID': ACCURATE_SESSION_ID,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            
            console.log('Accurate Response:', response.data);
            
            if (response.data && response.data.s === true) {
                await transaction.update({
                    export_status: 'SUCCESS',
                    export_error_message: null,
                    export_response: JSON.stringify(response.data),
                    exported_at: new Date()
                });
                
                return res.json({
                    success: true,
                    message: 'Export successful',
                    data: response.data
                });
            } else {
                let errorMsg = 'Unknown error';
                
                if (response.data?.d && Array.isArray(response.data.d) && response.data.d.length > 0) {
                    errorMsg = response.data.d.join('; ');
                } else if (response.data?.error_description) {
                    errorMsg = response.data.error_description;
                } else if (response.data?.error) {
                    errorMsg = response.data.error;
                }
                
                await transaction.update({
                    export_status: 'FAILED',
                    export_error_message: errorMsg
                });
                
                return res.status(400).json({
                    success: false,
                    error: errorMsg,
                    details: response.data
                });
            }
            
        } catch (apiError) {
            console.error('API Error Details:', {
                status: apiError.response?.status,
                data: apiError.response?.data,
                message: apiError.message
            });
            
            let errorMsg = apiError.message;
            
            if (apiError.response?.data?.d && Array.isArray(apiError.response.data.d)) {
                errorMsg = apiError.response.data.d.join('; ');
            } else if (apiError.response?.data?.error_description) {
                errorMsg = apiError.response.data.error_description;
            } else if (apiError.response?.data?.error) {
                errorMsg = apiError.response.data.error;
            }
            
            await transaction.update({
                export_status: 'FAILED',
                export_error_message: errorMsg
            });
            
            return res.status(400).json({
                success: false,
                error: errorMsg,
                details: apiError.response?.data
            });
        }
        
    } catch (error) {
        console.error('Error exporting to Accurate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export transaction',
            details: error.message
        });
    }
};

export const getExportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const transaction = await ProcessStagesDetail.findByPk(id, {
            attributes: ['id', 'number', 'export_status', 'export_error_message', 'export_response', 'updatedAt']
        });
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }
        
        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        console.error('Error fetching export status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch export status'
        });
    }
};

export const getProcessStagesGroups = async (req, res) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const offset = (page - 1) * pageSize;
        
        const { count, rows } = await ProcessStagesGroup.findAndCountAll({
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

export const getProcessStagesGroupDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await ProcessStagesGroup.findByPk(id, {
            include: [{
                model: ProcessStagesDetail,
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

export const deleteProcessStagesDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        const detail = await ProcessStagesDetail.findByPk(id);
        if (!detail) {
            return res.status(404).json({ 
                success: false, 
                error: 'Transaction not found' 
            });
        }
        
        const groupId = detail.group_id;
        await detail.destroy();
        
        const remainingCount = await ProcessStagesDetail.count({
            where: { group_id: groupId }
        });
        
        await ProcessStagesGroup.update({
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

export const deleteProcessStagesGroup = async (req, res) => {
    try {
        const { id } = req.params;
        
        const group = await ProcessStagesGroup.findByPk(id);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Group not found' 
            });
        }
        
        await ProcessStagesDetail.destroy({
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

export const getProcessStagesList = async (req, res) => {
    try {
        const { fields, page, pageSize, sort } = req.query;
        let { tanggal_mulai, tanggal_akhir } = req.body || {};
        
        const params = {};
        params.fields = fields || 'id,number,transDate';
        if (page) params.page = page;
        if (pageSize) params.pageSize = pageSize;
        if (sort) params.sort = sort;
        
        const data = await accurateRequest('/process-stages/list.do', params);
        
        let results = data.d || [];
        
        if (tanggal_mulai && tanggal_akhir) {
            results = results.filter(item => {
                let itemDate = item.transDate;
                if (itemDate && itemDate.includes('/')) {
                    const parts = itemDate.split('/');
                    itemDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                return itemDate >= tanggal_mulai && itemDate <= tanggal_akhir;
            });
        } else if (tanggal_mulai) {
            results = results.filter(item => item.transDate === tanggal_mulai);
        } else if (tanggal_akhir) {
            results = results.filter(item => item.transDate === tanggal_akhir);
        }
        
        res.json({
            success: true,
            data: results,
            pagination: data.sp || null
        });
    } catch (error) {
        console.error('Error fetching process stages list:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch process stages list',
            details: error.response?.data || error.message
        });
    }
};

export const getProcessStageDetail = async (req, res) => {
    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ 
                success: false, 
                error: 'ID parameter is required' 
            });
        }
        
        const data = await accurateRequest('/process-stages/detail.do', { id });
        
        res.json({
            success: true,
            data: data.d || data,
            raw: data
        });
    } catch (error) {
        console.error('Error fetching process stage detail:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch process stage detail',
            details: error.response?.data || error.message
        });
    }
};