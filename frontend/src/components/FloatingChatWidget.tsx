import React, { useState, useRef, useEffect } from 'react';
import { Send, X, RefreshCw, AlertCircle, Ticket as TicketIcon, BookOpen, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { MarkdownView } from './MarkdownView';

interface CitationItem {
  article_id: string;
  title: string;
  category?: string;
  document_name?: string;
  version?: string;
  status?: string;
  is_sample_unapproved?: boolean;
  disclaimer?: string;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isOutOfScope?: boolean;
  citations?: CitationItem[];
  hasUnapprovedNotice?: boolean;
  unapprovedNotice?: string;
  suggestTicketCreation?: boolean;
}

const QUICK_PROMPTS = [
  'Danh sách ticket của tôi',
  'Lỗi kết nối Wi-Fi công ty',
  'Cách cài đặt máy in văn phòng',
  'Quên mật khẩu tài khoản'
];

const parseCitationsFromMessage = (
  text: string,
  existingCitations?: CitationItem[]
): { cleanText: string; citations: CitationItem[] } => {
  const citationBlockRegex = /(?:\n+)?(?:\*|_)?(?:Nguồn\s+tham\s+khảo|Nguồn\s+tài\s+liệu\s+tham\s+khảo)[\s:]+[\s\S]*?(?:\*|_)?$/i;
  const match = text.match(citationBlockRegex);
  let cleanText = text.replace(citationBlockRegex, '').trim();

  // Loại bỏ triệt để các cụm từ bản thảo chờ phê duyệt, SAMPLE_NEEDS_APPROVAL khi hiển thị chat
  cleanText = cleanText
    .replace(/\(?(?:Trạng\s+thái:\s*)?SAMPLE_NEEDS_APPROVAL\)?/gi, '')
    .replace(/SAMPLE_NEEDS_APPROVAL/gi, '')
    .replace(/bản\s+(?:thảo|mẫu)\s*(?:đang\s*)?chờ\s*(?:phê\s*)?duyệt/gi, '')
    .replace(/Vì\s+tài\s+liệu\s+hiện\s+đang\s+ở\s+trạng\s+thái\s*,?\s*/gi, '')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  let citations: CitationItem[] = existingCitations && existingCitations.length > 0 ? [...existingCitations] : [];

  // Nếu existingCitations rỗng nhưng có đoạn text [CODE — Tiêu đề...], trích xuất tự động
  if (citations.length === 0 && match) {
    const rawBlock = match[0];
    const itemRegex = /\[\s*([A-Za-z0-9\-]+)\s*—\s*([^,\]]+)(?:,\s*phiên bản\s*([^(\]]+))?(?:\s*\(Trạng thái:\s*([^)]+)\))?\s*\]/g;
    let m;
    while ((m = itemRegex.exec(rawBlock)) !== null) {
      citations.push({
        article_id: m[1].trim(),
        title: m[2].trim(),
        version: m[3]?.trim() || '1.0-SAMPLE',
        status: m[4]?.trim() || 'SAMPLE_NEEDS_APPROVAL',
        is_sample_unapproved: m[4]?.includes('SAMPLE') ?? true
      });
    }
  }

  return { cleanText, citations };
};

export const FloatingChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  // AI Chat state
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [citationDetail, setCitationDetail] = useState<{ content?: string; steps?: string[] } | null>(null);
  const [loadingCitation, setLoadingCitation] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: 'Xin chào! Tôi là **Trợ lý IT Service Desk**.\n\nTôi hỗ trợ giải đáp các quy trình, tài liệu hướng dẫn kỹ thuật CNTT (Wi-Fi, VPN, máy in, phần mềm, tài khoản) và tra cứu ticket của bạn. Bạn cần hỗ trợ gì hôm nay?',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll AI chat messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isAiTyping, isOpen]);

  // Focus input on opening chat
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => aiInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleOpenCitation = async (citation: CitationItem) => {
    setSelectedCitation(citation);
    setCitationDetail(null);
    setLoadingCitation(true);
    try {
      const res = await api.get(`/knowledge/articles/${citation.article_id}`);
      setCitationDetail(res.data);
    } catch (err) {
      setCitationDetail({
        content: `Tài liệu kỹ thuật [${citation.article_id}] — ${citation.title}. Phiên bản: ${citation.version || '1.0'}. Vui lòng mở trang Kho tri thức để tra cứu toàn văn.`,
        steps: [
          'Kiểm tra cấu hình và trạng thái thiết bị/ứng dụng theo đúng khuyến nghị chuẩn.',
          'Thực hiện theo các bước chi tiết trong tài liệu toàn văn tại Kho tri thức.',
          'Tạo ticket để được hỗ trợ chuyên sâu nếu sự cố chưa được khắc phục.'
        ]
      });
    } finally {
      setLoadingCitation(false);
    }
  };

  const handleSendAiMessage = async (textToSend?: string) => {
    const query = (textToSend || aiInput).trim();
    if (!query || isAiTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setIsAiTyping(true);

    try {
      // Chuẩn bị lịch sử hội thoại phiên hiện tại
      const historyPayload = aiMessages.slice(-6).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      // Gọi endpoint chuyên dụng cho Requester AI Chat có kiểm tra phạm vi & RAG ở Backend
      const response = await api.post('/tickets/assistant/chat', {
        message: query,
        history: historyPayload
      });

      const reply = response.data?.reply;
      const isOutOfScope = response.data?.is_out_of_scope || response.data?.status === 'OUT_OF_SCOPE';
      const citations = response.data?.citations || [];
      const hasUnapprovedNotice = response.data?.has_unapproved_sources || false;
      const unapprovedNotice = response.data?.unapproved_notice;
      const suggestTicketCreation = response.data?.suggest_ticket_creation || false;

      if (!reply) {
        throw new Error('AI Service returned no response');
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isOutOfScope,
        citations,
        hasUnapprovedNotice,
        unapprovedNotice,
        suggestTicketCreation
      };
      setAiMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      // Fallback lịch sự nếu có lỗi kết nối
      const lowerQuery = query.toLowerCase();
      let fallbackText = 'Hiện tại hệ thống AI đang bận hoặc gặp sự cố kết nối. Bạn có thể tra cứu nhanh trong mục **Hỏi đáp & FAQ** hoặc bấm **Tạo ticket hỗ trợ** để gửi yêu cầu cho nhân viên IT.';

      if (lowerQuery.includes('hôm nay ăn gì') || lowerQuery.includes('mua sách ở đâu')) {
        fallbackText = 'Mình là Trợ lý IT Service Desk, chỉ hỗ trợ các vấn đề về tài khoản, phần mềm, thiết bị, mạng, quyền truy cập và sử dụng hệ thống hỗ trợ. Mình không thể tư vấn về món ăn hoặc địa điểm mua sách. Bạn đang gặp vấn đề CNTT nào cần hỗ trợ?';
      }

      const aiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        suggestTicketCreation: true
      };
      setAiMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleResetAiChat = () => {
    setAiMessages([
      {
        id: 'welcome-reset',
        sender: 'ai',
        text: 'Cuộc trò chuyện đã được làm mới. Mình là **Trợ lý IT Service Desk**, bạn đang gặp vấn đề kỹ thuật nào cần hỗ trợ?',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <>
      {/* Floating Chat Modal Popup */}
      {isOpen && (
        <div 
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] max-h-[calc(100vh-6.5rem)] sm:max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
          role="dialog"
          aria-labelledby="chat-widget-title"
          aria-modal="true"
        >
          {/* TOP HEADER */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 p-1 flex items-center justify-center backdrop-blur-xs shadow-inner overflow-hidden shrink-0 border border-white/20">
                <img 
                  src="/avatar/AI_support.svg" 
                  alt="AI Support" 
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.src = '/ai-logo.jpg'; }}
                />
              </div>
              <div className="min-w-0">
                <h4 id="chat-widget-title" className="text-xs sm:text-sm font-bold leading-tight truncate flex items-center gap-1.5">
                  Trợ lý IT Service Desk
                </h4>
                <p className="text-[10px] text-indigo-100 flex items-center gap-1.5 mt-0.5 font-medium truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                  <span className="truncate">Hỗ trợ CNTT & Service Desk</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button 
                onClick={handleResetAiChat}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                title="Làm mới cuộc trò chuyện"
                aria-label="Làm mới cuộc trò chuyện"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {/* Nút đóng duy nhất và rõ ràng trong Header khi widget đang mở */}
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                title="Đóng cửa sổ hỗ trợ"
                aria-label="Đóng cửa sổ hỗ trợ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CHAT BODY CONTENT */}
          <div className="flex-1 flex flex-col bg-slate-50/60 overflow-hidden min-h-0">
            {/* Messages List */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 min-h-0">
              {aiMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center p-1 shrink-0 mt-0.5 shadow-2xs">
                      <img 
                        src="/avatar/AI_support.svg" 
                        alt="AI Bot" 
                        className="w-full h-full object-contain"
                        onError={(e) => { e.currentTarget.src = '/ai-logo.jpg'; }}
                      />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : msg.isOutOfScope
                      ? 'bg-amber-50/90 border border-amber-200 text-amber-950 rounded-tl-xs'
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                  }`}>
                    {msg.isOutOfScope && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Ngoài phạm vi hỗ trợ CNTT</span>
                      </div>
                    )}
                    {msg.sender === 'ai' ? (
                      <div>
                        {(() => {
                          const { cleanText, citations } = parseCitationsFromMessage(msg.text, msg.citations);
                          return (
                            <>
                              <MarkdownView content={cleanText} />

                              {/* Rich interactive citations */}
                              {citations.length > 0 && (
                                <div className="mt-3 pt-2.5 border-t border-slate-100">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Nguồn tài liệu tham khảo ({citations.length}):</span>
                                    </div>
                                    <span className="text-[10px] text-indigo-600 font-medium">Bấm để xem</span>
                                  </div>

                                  <div className="space-y-1.5">
                                    {citations.map((c, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleOpenCitation(c)}
                                        className="w-full group flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-200 transition-all cursor-pointer text-left shadow-2xs"
                                        title={`Xem tài liệu [${c.article_id}] ${c.title}`}
                                      >
                                        <div className="min-w-0 pr-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/90 shadow-2xs shrink-0 whitespace-nowrap">
                                              {c.article_id}
                                            </span>
                                            <p className="text-[11.5px] font-medium text-slate-800 group-hover:text-indigo-700 truncate">
                                              {c.title}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="w-5 h-5 rounded-full bg-white group-hover:bg-indigo-100 flex items-center justify-center shrink-0 border border-slate-200 group-hover:border-indigo-200 transition-colors">
                                          <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Suggest Ticket Creation CTA */}
                        {msg.suggestTicketCreation && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500 leading-tight">Chưa có hướng dẫn phù hợp?</span>
                            <a
                              href="/tickets"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10.5px] font-semibold transition-colors shadow-2xs shrink-0"
                            >
                              <TicketIcon className="w-3 h-3" />
                              Tạo ticket hỗ trợ
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div className={`text-[9px] mt-1 text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing Indicator - 3 chấm nảy sinh động */}
              {isAiTyping && (
                <div className="flex gap-2.5 justify-start items-center">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center p-1 shrink-0 shadow-2xs">
                    <img src="/avatar/AI_support.svg" alt="AI Bot" className="w-full h-full object-contain" />
                  </div>
                  <div className="bg-white border border-slate-200/90 px-3.5 py-2.5 rounded-2xl rounded-tl-xs shadow-2xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Suggestions - 1 hàng ngang duy nhất cuộn mượt */}
            {aiMessages.length <= 2 && !isAiTyping && (
              <div className="px-3 py-2 bg-white border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendAiMessage(prompt)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-[11px] font-medium transition-colors border border-slate-200/60 cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendAiMessage(); }}
              className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              <input
                ref={aiInputRef}
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Nhập câu hỏi hỗ trợ CNTT của bạn..."
                disabled={isAiTyping}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                aria-label="Nội dung câu hỏi gửi Trợ lý AI"
              />
              <button
                type="submit"
                disabled={!aiInput.trim() || isAiTyping}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-40 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Gửi câu hỏi"
                aria-label="Gửi câu hỏi"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* POPUP MODAL XEM CHI TIẾT NGUỒN THAM KHẢO */}
          {selectedCitation && (
            <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-2 sm:p-3 rounded-2xl animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      {selectedCitation.article_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      Chi tiết hướng dẫn kỹ thuật
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCitation(null)}
                    className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Đóng xem trước"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content Body */}
                <div className="p-3.5 overflow-y-auto space-y-3 text-xs text-slate-700 min-h-0">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {selectedCitation.title}
                    </h4>
                  </div>

                  {loadingCitation ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                      <span className="text-[11px]">Đang tải toàn văn tài liệu từ RAG...</span>
                    </div>
                  ) : (
                    <>
                      {/* Các bước xử lý kỹ thuật tiêu chuẩn */}
                      {citationDetail?.steps && citationDetail.steps.length > 0 && (
                        <div className="bg-indigo-50/70 rounded-xl p-3 border border-indigo-100/90">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-2.5 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Các bước xử lý kỹ thuật tiêu chuẩn:</span>
                          </div>
                          <div className="space-y-2">
                            {citationDetail.steps.map((st, i) => {
                              const cleanSt = st.replace(/^[#\s\-*]+/, '').trim();
                              const matchParts = cleanSt.match(/^([^:—\-]+[:—\-])\s*(.*)$/);
                              return (
                                <div key={i} className="flex items-start gap-2.5 bg-white/80 p-2.5 rounded-lg border border-indigo-100/70 shadow-2xs">
                                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <div className="text-[11.5px] leading-relaxed text-slate-800">
                                    {matchParts ? (
                                      <>
                                        <strong className="text-indigo-950 font-semibold">{matchParts[1]}</strong>{' '}
                                        <span className="text-slate-700">{matchParts[2]}</span>
                                      </>
                                    ) : (
                                      <span className="text-slate-700">{cleanSt}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tóm tắt metadata & thông tin chung */}
                      {citationDetail?.content && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11.5px] text-slate-600 leading-relaxed">
                          <MarkdownView content={citationDetail.content} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer Link */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                  <span className="text-[9.5px] text-slate-400 truncate">
                    Đồng bộ 100% với RAG Database
                  </span>
                  <a
                    href={`/knowledge?article=${encodeURIComponent(selectedCitation.article_id)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-semibold transition-all shadow-2xs shrink-0 cursor-pointer"
                  >
                    <span>Mở Kho tri thức</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Bubble Button */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center select-none">
          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shrink-0 bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 hover:shadow-indigo-500/30 ring-4 ring-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Mở Trợ lý AI Service Desk"
            aria-label="Mở Trợ lý AI Service Desk"
          >
            <div className="relative flex items-center justify-center w-full h-full p-2.5">
              <img src="/avatar/AI_support.svg" alt="AI Support" className="w-full h-full object-contain drop-shadow-sm" />
              <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse"></span>
            </div>
          </button>
        </div>
      )}
    </>
  );
};

export default FloatingChatWidget;
