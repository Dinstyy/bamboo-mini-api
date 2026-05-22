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
        
        processFetchDataWithPagination(group.id, tanggal_mulai, tanggal_akhir);
        
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

const processFetchDataWithPagination = async (groupId, tanggal_mulai, tanggal_akhir) => {
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
        
        const formatToDDMMYYYY = (date) => {
            if (!date) return null;
            const parts = date.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return date;
        };
        
        const startDateStr = formatToDDMMYYYY(tanggal_mulai);
        const endDateStr = formatToDDMMYYYY(tanggal_akhir);
        
        let allResults = [];
        let currentPage = 1;
        let totalPages = 1;
        const pageSize = 100; 
        
        console.log(`Mulai fetch data dari ${startDateStr} sampai ${endDateStr}`);
        
        do {
            const params = {
                fields: 'id,number,transDate,name',
                page: currentPage,
                pageSize: pageSize,
                'filter.transDate.op': 'BETWEEN',
                'filter.transDate.val': `${formatDateToAPI(tanggal_mulai)},${formatDateToAPI(tanggal_akhir)}`
            };
            
            console.log(`Fetching page ${currentPage}...`);
            
            const data = await accurateRequest('/sales-quotation/list.do', params);
            let results = data.d || [];
            
            const filteredResults = results.filter(item => {
                if (!item.transDate) return false;
                return item.transDate >= startDateStr && item.transDate <= endDateStr;
            });
            
            allResults = [...allResults, ...filteredResults];
            
            if (data.sp && data.sp.pageCount) {
                totalPages = data.sp.pageCount;
            }
            
            console.log(`Page ${currentPage}: mendapatkan ${filteredResults.length} items (total: ${allResults.length})`);
            
            currentPage++;
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } while (currentPage <= totalPages);
        
        console.log(`Selesai fetch. Total items: ${allResults.length}`);
        
        const dateCount = {};
        allResults.forEach(item => {
            dateCount[item.transDate] = (dateCount[item.transDate] || 0) + 1;
        });
        console.log('Ringkasan per tanggal:', dateCount);
        
        const savedItems = [];
        for (const item of allResults) {
            let branchId = null;
            let branchName = null;
            try {
                const detailData = await accurateRequest('/sales-quotation/detail.do', { id: item.id });
                const detail = detailData.d || detailData;
                branchId = detail.branchId;
                branchName = detail.branchName;
            } catch (err) {
                console.error(`Failed to fetch detail for branchId:`, err.message);
            }
    
            const savedDetail = await SalesQuotationDetail.create({
                group_id: groupId,
                accurate_id: String(item.id),
                number: item.number,
                transDate: item.transDate ? new Date(item.transDate.split('/').reverse().join('-')) : null,
                name: item.name || null,
                branch_id: branchId,     
                branch_name: branchName, 
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
        
        const formatToDDMMYYYY = (date) => {
            if (!date) return null;
            const parts = date.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return date;
        };
        
        const startDateStr = formatToDDMMYYYY(tanggal_mulai);
        const endDateStr = formatToDDMMYYYY(tanggal_akhir);
        
        console.log(`Date range for comparison: ${startDateStr} to ${endDateStr}`);
        
        const filteredResults = results.filter(item => {
            if (!item.transDate) return false;
            return item.transDate >= startDateStr && item.transDate <= endDateStr;
        });
        
        console.log(`After re-filter: ${filteredResults.length} items`);
        
        filteredResults.forEach(item => {
            console.log(`  - ${item.transDate}: ${item.number}`);
        });
        
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
        
        let results = data.d || [];
        
        if (tanggal_mulai && tanggal_akhir) {
            const formatToDDMMYYYY = (date) => {
                if (!date) return null;
                const parts = date.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return date;
            };
            
            const startDateStr = formatToDDMMYYYY(tanggal_mulai);
            const endDateStr = formatToDDMMYYYY(tanggal_akhir);
            
            results = results.filter(item => {
                if (!item.transDate) return false;
                return item.transDate >= startDateStr && item.transDate <= endDateStr;
            });
        }
        
        res.json({
            success: true,
            data: results,
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

export const getSalesQuotationDetail = async (req, res) => {
    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID parameter is required'
            });
        }
        
        const data = await accurateRequest('/sales-quotation/detail.do', { id });
        const detail = data.d || data;
        const items = (detail.detailItem || []).map(item => ({
            itemName: item.detailName || item.item?.name || '-',
            itemNo: item.item?.no || '-',
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            description: item.detailNotes || '-'
        }));
        
        const expenses = (detail.detailExpense || []).map(expense => ({
            accountNo: expense.account?.no || '-',
            accountName: expense.expenseName || '-',
            amount: expense.amount || expense.expenseAmount || 0,
            description: expense.expenseNotes || '-'
        }));
        
        res.json({
            success: true,
            data: {
                id: detail.id,
                number: detail.number,
                transDate: detail.transDate,
                customerName: detail.customer?.name || '-',
                customerNo: detail.customer?.customerNo || '-',
                totalAmount: detail.totalAmount || 0,
                subTotal: detail.subTotal || 0,
                taxAmount: detail.tax1Amount || 0,
                status: detail.statusName || detail.status,
                items: items,
                expenses: expenses,
                raw_data: data
            }
        });
    } catch (error) {
        console.error('Error fetching sales quotation detail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sales quotation detail',
            details: error.response?.data || error.message
        });
    }
};

export const bulkExportToAccurate = async (req, res) => {
    try {
        const { ids } = req.body; 
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Pilih minimal satu quotation untuk diexport'
            });
        }
        
        if (ids.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maksimal 100 quotation dalam 1 kali export'
            });
        }
        
        const quotations = await SalesQuotationDetail.findAll({
            where: {
                id: ids
            }
        });
        
        if (quotations.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Data quotation tidak ditemukan'
            });
        }
        
        for (const quote of quotations) {
            await quote.update({
                export_status: 'IN_PROGRESS',
                export_error_message: null
            });
        }
        
        const formatDateToAPI = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };
        
        const bulkData = [];
        
        for (let i = 0; i < quotations.length; i++) {
            const quote = quotations[i];
            
            let rawDetail = null;
            try {
                const detailResponse = await accurateRequest('/sales-quotation/detail.do', { id: quote.accurate_id });
                rawDetail = detailResponse.d || detailResponse;
            } catch (err) {
                console.error(`Failed to fetch detail for ${quote.number}:`, err.message);
            }
            
            const items = (rawDetail?.detailItem || []).map((item, idx) => ({
                itemNo: item.item?.no || '-',
                unitPrice: item.unitPrice || 0,
                quantity: item.quantity || 0,
                detailName: item.detailName || item.item?.name || '-',
                detailNotes: item.detailNotes || null
            }));
            
            const validItems = items.filter(item => item.itemNo && item.itemNo !== '-');
            
            if (validItems.length === 0) {
                bulkData.push({ error: true, quote, reason: 'Tidak ada item dengan kode barang yang valid' });
                continue;
            }
            
            const dataItem = {
                customerNo: rawDetail?.customer?.customerNo || "CUST-001",
                transDate: formatDateToAPI(quote.transDate) || formatDateToAPI(new Date()),
                // number: quote.number || null, 
                description: `Sales Quotation ${quote.number}`,
                currencyCode: "IDR",
                shipmentName: "JNE",
                toAddress: rawDetail?.toAddress || "Jakarta, Indonesia",
                fobName: "FOB Destination",
                branchId: quote.branch_id,
                detailItem: validItems.map(item => ({
                    itemNo: item.itemNo,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    detailName: item.detailName,
                    detailNotes: item.detailNotes
                }))
            };
            
            const expenses = (rawDetail?.detailExpense || []).map((expense, idx) => ({
                accountNo: expense.account?.no || '-',
                expenseAmount: expense.amount || expense.expenseAmount || 0,
                expenseName: expense.expenseName || 'Additional Cost',
                expenseNotes: expense.expenseNotes || null
            }));
            
            if (expenses.length > 0 && expenses[0].accountNo !== '-') {
                dataItem.detailExpense = expenses.map(expense => ({
                    accountNo: expense.accountNo,
                    expenseAmount: expense.expenseAmount,
                    expenseName: expense.expenseName,
                    expenseNotes: expense.expenseNotes
                }));
            }
            
            bulkData.push({ error: false, data: dataItem, quote });
        }
        
        const bulkPayload = {};
        let validIndex = 0;
        
        for (let i = 0; i < bulkData.length; i++) {
            const item = bulkData[i];
            
            if (item.error) {
                await item.quote.update({
                    export_status: 'FAILED',
                    export_error_message: item.reason
                });
                continue;
            }
            
            const data = item.data;
            bulkPayload[`data[${validIndex}].customerNo`] = data.customerNo;
            bulkPayload[`data[${validIndex}].transDate`] = data.transDate;
            // if (data.number) bulkPayload[`data[${validIndex}].number`] = data.number;
            if (data.branchId) bulkPayload[`data[${validIndex}].branchId`] = data.branchId;
            if (data.description) bulkPayload[`data[${validIndex}].description`] = data.description;
            if (data.currencyCode) bulkPayload[`data[${validIndex}].currencyCode`] = data.currencyCode;
            if (data.shipmentName) bulkPayload[`data[${validIndex}].shipmentName`] = data.shipmentName;
            if (data.toAddress) bulkPayload[`data[${validIndex}].toAddress`] = data.toAddress;
            if (data.fobName) bulkPayload[`data[${validIndex}].fobName`] = data.fobName;
            
            for (let j = 0; j < data.detailItem.length; j++) {
                const itemDetail = data.detailItem[j];
                bulkPayload[`data[${validIndex}].detailItem[${j}].itemNo`] = itemDetail.itemNo;
                bulkPayload[`data[${validIndex}].detailItem[${j}].unitPrice`] = itemDetail.unitPrice;
                bulkPayload[`data[${validIndex}].detailItem[${j}].quantity`] = itemDetail.quantity;
                if (itemDetail.detailName) bulkPayload[`data[${validIndex}].detailItem[${j}].detailName`] = itemDetail.detailName;
                if (itemDetail.detailNotes) bulkPayload[`data[${validIndex}].detailItem[${j}].detailNotes`] = itemDetail.detailNotes;
            }
            
            if (data.detailExpense) {
                for (let j = 0; j < data.detailExpense.length; j++) {
                    const expense = data.detailExpense[j];
                    bulkPayload[`data[${validIndex}].detailExpense[${j}].accountNo`] = expense.accountNo;
                    bulkPayload[`data[${validIndex}].detailExpense[${j}].expenseAmount`] = expense.expenseAmount;
                    bulkPayload[`data[${validIndex}].detailExpense[${j}].expenseName`] = expense.expenseName;
                    if (expense.expenseNotes) bulkPayload[`data[${validIndex}].detailExpense[${j}].expenseNotes`] = expense.expenseNotes;
                }
            }
            
            bulkData[validIndex].payloadIndex = validIndex;
            validIndex++;
        }
        
        const validBulkData = bulkData.filter(item => !item.error);
        
        console.log('Sending bulk data to Accurate (without number):', JSON.stringify(bulkPayload, null, 2));
        
        try {
            const response = await axios.post(
                `${ACCURATE_API_URL}/sales-quotation/bulk-save.do`,
                new URLSearchParams(bulkPayload).toString(),
                {
                    headers: {
                        'Authorization': `Bearer ${ACCURATE_TOKEN}`,
                        'X-Session-ID': ACCURATE_SESSION_ID,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            
            console.log('Accurate Bulk Response:', JSON.stringify(response.data, null, 2));
            
            if (response.data && response.data.d && Array.isArray(response.data.d)) {
                for (let i = 0; i < response.data.d.length; i++) {
                    const itemResult = response.data.d[i];
                    const originalItem = validBulkData[i];
                    
                    if (originalItem && originalItem.quote) {
                        if (itemResult && itemResult.s === true) {
                            await originalItem.quote.update({
                                export_status: 'SUCCESS',
                                export_error_message: null,
                                export_response: JSON.stringify(itemResult),
                                exported_at: new Date()
                            });
                        } else {
                            let errorMsg = 'Unknown error';
                            
                            if (itemResult?.d && Array.isArray(itemResult.d)) {
                                errorMsg = itemResult.d.join('; ');
                            } 
                            else if (itemResult?.error_description) {
                                errorMsg = String(itemResult.error_description);
                            }
                            else if (itemResult?.error) {
                                errorMsg = String(itemResult.error);
                            }
                            else if (typeof itemResult === 'string') {
                                errorMsg = itemResult;
                            }
                            else {
                                errorMsg = JSON.stringify(itemResult);
                            }
                            
                            console.log(`Error for ${originalItem.quote.number}:`, errorMsg);
                            
                            await originalItem.quote.update({
                                export_status: 'FAILED',
                                export_error_message: errorMsg
                            });
                        }
                    }
                }
            } else if (response.data && response.data.s === true) {
                for (const item of validBulkData) {
                    if (item.quote) {
                        await item.quote.update({
                            export_status: 'SUCCESS',
                            export_error_message: null,
                            export_response: JSON.stringify(response.data),
                            exported_at: new Date()
                        });
                    }
                }
            } else {
                let errorMsg = 'Unknown error';
                
                if (response.data?.d && Array.isArray(response.data.d)) {
                    const errors = [];
                    for (const err of response.data.d) {
                        if (err?.d && Array.isArray(err.d)) {
                            errors.push(err.d.join('; '));
                        } else if (err?.error_description) {
                            errors.push(String(err.error_description));
                        } else if (err?.error) {
                            errors.push(String(err.error));
                        } else if (typeof err === 'string') {
                            errors.push(err);
                        }
                    }
                    errorMsg = errors.join('; ');
                } else if (response.data?.error_description) {
                    errorMsg = String(response.data.error_description);
                } else if (response.data?.error) {
                    errorMsg = String(response.data.error);
                }
                
                for (const item of validBulkData) {
                    if (item.quote) {
                        await item.quote.update({
                            export_status: 'FAILED',
                            export_error_message: errorMsg
                        });
                    }
                }
            }
            
            const successQuotes = quotations.filter(q => q.export_status === 'SUCCESS');
            const failedQuotes = quotations.filter(q => q.export_status === 'FAILED');
            
            return res.json({
                success: successQuotes.length > 0,
                message: `Export selesai! Berhasil: ${successQuotes.length}, Gagal: ${failedQuotes.length}`,
                data: {
                    success: successQuotes.map(q => q.id),
                    failed: failedQuotes.map(q => q.id),
                    total: quotations.length
                }
            });
            
        } catch (apiError) {
            console.error('Bulk API Error:', apiError.response?.data);
            
            let errorMsg = apiError.response?.data?.error_description || 
                            apiError.response?.data?.error || 
                            apiError.message;
            
            if (Array.isArray(errorMsg)) {
                errorMsg = errorMsg.join('; ');
            }
            
            for (const quote of quotations) {
                await quote.update({
                    export_status: 'FAILED',
                    export_error_message: errorMsg
                });
            }
            
            return res.status(400).json({
                success: false,
                error: errorMsg,
                details: apiError.response?.data
            });
        }
        
    } catch (error) {
        console.error('Error in bulk export:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk export quotations',
            details: error.message
        });
    }
};