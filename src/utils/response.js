export const sendSuccess = (res, { status = 200, message = 'Success', data, pagination } = {}) => res.status(status).json({ success: true, message, data, ...(pagination && { pagination }) });
