export const formatErrorMessage = (error: any, defaultMsg = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string => {
  if (!error) return defaultMsg;
  
  const detail = error?.response?.data?.detail ?? error?.detail ?? error;
  
  if (typeof detail === 'string') {
    return detail;
  }
  
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.msg || item.message || JSON.stringify(item);
        }
        return String(item);
      })
      .join(', ');
  }
  
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  
  return error.message || defaultMsg;
};
