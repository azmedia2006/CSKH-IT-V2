import { formatErrorMessage } from '../utils/formatError';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ticketApi } from '../services/ticketApi';
import { Send, ArrowLeft, Loader2, AlertCircle, X, Image as ImageIcon, HelpCircle } from 'lucide-react';

export const CreateTicketPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const stateData = (location.state as {
    prefillTitle?: string;
    prefillDescription?: string;
    prefillCategory?: string;
  } | null);

  const [title, setTitle] = useState(stateData?.prefillTitle || '');
  const [description, setDescription] = useState(stateData?.prefillDescription || '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stateData?.prefillTitle) {
      setTitle(stateData.prefillTitle);
    }
    if (stateData?.prefillDescription) {
      setDescription(stateData.prefillDescription);
    }
  }, [stateData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setErrorMessage(null);

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const maxFiles = 5;
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    if (selectedFiles.length + files.length > maxFiles) {
      setErrorMessage(`Bạn chỉ có thể đính kèm tối đa ${maxFiles} ảnh cho mỗi ticket.`);
      return;
    }

    const validNewFiles: File[] = [];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage(`File "${file.name}" không hợp lệ. Chỉ chấp nhận định dạng PNG, JPG, WEBP.`);
        return;
      }
      if (file.size > maxSizeBytes) {
        setErrorMessage(`File "${file.name}" vượt quá kích thước 10 MB.`);
        return;
      }
      validNewFiles.push(file);
    }

    setSelectedFiles((prev) => [...prev, ...validNewFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const newTicket = await ticketApi.createTicket({ title, description });
      if (newTicket && newTicket.id) {
        // Upload any attached files in parallel
        if (selectedFiles.length > 0) {
          await Promise.all(
            selectedFiles.map(async (file) => {
              try {
                await ticketApi.uploadAttachment(newTicket.id, file);
              } catch (attErr) {
                console.error('Failed to upload attachment:', file.name, attErr);
              }
            })
          );
        }
        navigate(`/tickets/${newTicket.id}`);
      } else {
        navigate('/tickets');
      }
    } catch (error: any) {
      console.error('Failed to create ticket', error);
      const msg = formatErrorMessage(error, 'Tạo ticket thất bại. Vui lòng kiểm tra lại thông tin và thử lại.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 md:p-8 animate-in fade-in duration-300">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 mb-5 transition-colors font-medium text-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/70">
            <h2 className="text-xl font-bold text-slate-900">Tạo Ticket Mới</h2>
            <p className="text-slate-500 mt-1 text-xs font-normal">Gửi yêu cầu hỗ trợ mới tới đội ngũ IT Service Desk.</p>
          </div>

          {stateData?.prefillTitle && (
            <div className="m-6 mb-0 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center gap-2.5 text-xs text-indigo-800 font-medium animate-in fade-in duration-200">
              <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Đang tạo ticket từ câu hỏi Hỏi đáp & FAQ. Bạn có thể bổ sung thêm mô tả chi tiết hoặc đính kèm ảnh bên dưới.</span>
            </div>
          )}

          {errorMessage && (
            <div className="m-6 mb-0 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Tiêu đề yêu cầu <span className="text-rose-500">*</span></label>
              <input 
                required
                type="text" 
                placeholder="Tóm tắt ngắn gọn vấn đề của bạn..." 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-normal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Mô tả chi tiết vấn đề <span className="text-rose-500">*</span></label>
              <textarea 
                required
                rows={6}
                placeholder="Mô tả chi tiết vấn đề, thiết bị, phần mềm liên quan hoặc các bước tái hiện lỗi..." 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all resize-none font-normal leading-relaxed"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Attachments Section */}
            <div className="space-y-2 pt-1">
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/png,image/jpeg,image/webp" 
                multiple
                className="hidden" 
                onChange={handleFileChange}
              />

              {/* Upload trigger button */}
              {selectedFiles.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 py-2 border border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-indigo-500" />
                  <span>Ảnh đính kèm</span>
                </button>
              )}

              {/* Selected files preview */}
              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate font-medium">{file.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer p-1 rounded-md hover:bg-white"
                        title="Xóa ảnh này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button 
                type="submit" 
                disabled={isSubmitting || !title.trim() || !description.trim()}
                className="inline-flex items-center justify-center rounded-xl font-semibold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs h-10 px-6 gap-2 text-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {isSubmitting ? 'Đang phân tích & tạo ticket...' : 'Gửi Yêu Cầu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default CreateTicketPage;
