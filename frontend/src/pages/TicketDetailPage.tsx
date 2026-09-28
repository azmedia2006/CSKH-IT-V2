import { formatErrorMessage } from '../utils/formatError';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { ticketApi } from '../services/ticketApi';
import { authApi } from '../services/authApi';
import { api } from '../services/api';
import { 
  ArrowLeft, MessageSquare, Clock, Send, Bot, 
  Check, Info, Tag, CheckCircle2, X, SlidersHorizontal, Layers,
  AlertCircle, RotateCcw, Star, Quote, Lock, Globe, User as UserIcon,
  ShieldCheck, Copy, AlertTriangle, CheckCircle, Zap, ChevronDown, ChevronUp,
  Maximize2, Minimize2, Trash2, Paperclip, Download, Plus, UserCheck, Sparkles,
  FileText
} from 'lucide-react';
import { MarkdownView } from '../components/MarkdownView';

interface AttachmentItem {
  id: string;
  file_name: string;
  file_type?: string;
  file_size: number;
  created_at?: string;
}

const AuthenticatedAttachment = ({ ticketId, attachment }: { ticketId: string; attachment: AttachmentItem }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    ticketApi.fetchAttachmentBlob(ticketId, attachment.id)
      .then((blob) => {
        if (active) {
          url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ticketId, attachment.id]);

  return (
    <div className="group relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex flex-col hover:border-slate-300 transition-all">
      <div className="h-24 w-full flex items-center justify-center bg-slate-100 overflow-hidden relative">
        {loading ? (
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        ) : blobUrl ? (
          <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full block">
            <img 
              src={blobUrl} 
              alt={attachment.file_name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
            />
          </a>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
            <Paperclip className="w-5 h-5 text-slate-300" />
            <span className="text-[10px]">Không thể tải ảnh</span>
          </div>
        )}
      </div>
      <div className="p-1.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-medium text-slate-700 max-w-[100px]" title={attachment.file_name}>
          {attachment.file_name}
        </span>
        {blobUrl && (
          <a
            href={blobUrl}
            download={attachment.file_name}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            title="Tải ảnh về"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};

interface CommentItem {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  content: string;
  is_internal: boolean;
  is_ai_generated: boolean;
  edited_by_agent: boolean;
  created_at: string;
}

export const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isExpandedComposer, setIsExpandedComposer] = useState(false);
  const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(false);
  const [isTicketInfoCollapsed, setIsTicketInfoCollapsed] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showAiTriageModal, setShowAiTriageModal] = useState(false);
  const [aiDraftText, setAiDraftText] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    author: string;
    text: string;
  } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea when content changes
  useEffect(() => {
    if (replyTextareaRef.current && !isExpandedComposer) {
      replyTextareaRef.current.style.height = 'auto';
      const targetHeight = Math.min(Math.max(replyTextareaRef.current.scrollHeight, 80), 280);
      replyTextareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [replyText, isExpandedComposer]);

  // Helper parser for replying/quoting specific comments
  const parseCommentContent = (rawContent: string) => {
    const match = rawContent.match(/^> \[Re: @([^\]]+)\]: (.*?)\n\n([\s\S]*)$/);
    if (match) {
      return {
        replyAuthor: match[1],
        replySnippet: match[2],
        cleanContent: match[3]
      };
    }
    return {
      replyAuthor: null,
      replySnippet: null,
      cleanContent: rawContent
    };
  };

  // Support rating state
  const [commentRatings, setCommentRatings] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ticket_comment_ratings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleRateComment = (commentId: string, rating: number) => {
    const next = { ...commentRatings, [commentId]: rating };
    setCommentRatings(next);
    localStorage.setItem('ticket_comment_ratings', JSON.stringify(next));
    setSuccessNotice(`Đã ghi nhận đánh giá ${rating} sao cho phản hồi.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const formatTicketDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getSlaStatus = (dueAt?: string | null, doneAt?: string | null) => {
    if (doneAt) {
      const isLate = dueAt && new Date(doneAt) > new Date(dueAt);
      return {
        state: isLate ? 'completed_late' : 'completed_on_time',
        badge: isLate ? 'Hoàn thành trễ' : 'Đúng hạn',
        color: isLate ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-emerald-800 bg-emerald-50 border-emerald-200',
        detail: `Xong: ${formatTicketDate(doneAt)}`
      };
    }
    if (!dueAt) {
      return {
        state: 'not_set',
        badge: 'Trong 24h',
        color: 'text-slate-600 bg-slate-50 border-slate-200',
        detail: 'Đang theo dõi chuẩn'
      };
    }
    const now = new Date();
    const due = new Date(dueAt);
    const diffMs = due.getTime() - now.getTime();
    if (diffMs < 0) {
      const hoursLate = Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60 * 60)));
      return {
        state: 'breached',
        badge: 'Quá hạn SLA',
        color: 'text-rose-700 bg-rose-50 border-rose-200 font-semibold',
        detail: `Trễ ${hoursLate >= 24 ? `${Math.floor(hoursLate / 24)} ngày` : `${hoursLate} giờ`}`
      };
    }
    const hoursLeft = Math.round(diffMs / (1000 * 60 * 60));
    if (hoursLeft <= 2) {
      return {
        state: 'urgent',
        badge: 'Sắp hết hạn',
        color: 'text-amber-800 bg-amber-50 border-amber-300 font-semibold',
        detail: `Còn ${Math.max(1, Math.round(diffMs / (1000 * 60)))} phút`
      };
    }
    return {
      state: 'active',
      badge: 'Đang trong hạn',
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      detail: hoursLeft >= 24 ? `Còn ${Math.floor(hoursLeft / 24)} ngày` : `Còn ${hoursLeft} giờ`
    };
  };

  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAiTriageModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, []);

  const { data: usersList = [] } = useQuery({
    queryKey: ['usersList'],
    queryFn: () => api.get('/users/agents').then((r: any) => r.data).catch(() => []),
    staleTime: 5 * 60 * 1000,
    enabled: true
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });

  const { data: ticket, isLoading: isTicketLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketApi.getTicket(id!),
    enabled: !!id,
    refetchInterval: 4000
  });

  // Lọc danh sách nhân viên theo nhóm chuyên trách của ticket (theo UC-03)
  const specializedAgents: any[] = useMemo(() => {
    if (!Array.isArray(usersList)) return [];
    const agentsOnly = usersList.filter((u: any) => Boolean(u && (u.role_name === "SUPPORT_AGENT" || u.role_name === "TEAM_LEAD") && u.is_active !== false));
    const ticketCat = (ticket as any)?.category?.code || ticket?.category_name || ticket?.category_id || '';
    if (!ticketCat) return agentsOnly;
    const matching = agentsOnly.filter((u: any) => u.skill_group && (u.skill_group === ticketCat || ticketCat.includes(u.skill_group)));
    return matching.length > 0 ? matching : agentsOnly;
  }, [usersList, ticket?.category_id, ticket?.category_name]);

  const { data: comments = [] } = useQuery<CommentItem[]>({
    queryKey: ['comments', id],
    queryFn: () => ticketApi.getComments(id!),
    enabled: !!id,
    refetchInterval: 3000
  });

  // Lọc sự kiện/comment trùng lặp do thao tác hệ thống ghi vết đồng thời
  const displayComments = useMemo(() => {
    if (!comments || comments.length === 0) return [];
    const result: CommentItem[] = [];
    for (let i = 0; i < comments.length; i++) {
      const cur = comments[i];
      const prev = result[result.length - 1];
      if (prev) {
        const isSameContent = cur.content.trim() === prev.content.trim();
        const isSameUser = cur.user_id === prev.user_id || cur.user_name === prev.user_name;
        const isSameType = cur.is_internal === prev.is_internal;
        const timeDiff = Math.abs(new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime());
        // Nếu cùng tác giả, cùng nội dung, cùng loại nội bộ/công khai và phát sinh gần như cùng lúc (< 30s) -> bỏ qua bản sao lặp
        if (isSameContent && isSameUser && isSameType && (timeDiff < 30000 || isNaN(timeDiff))) {
          continue;
        }
      }
      result.push(cur);
    }
    return result;
  }, [comments]);

  const { data: attachments = [] } = useQuery<AttachmentItem[]>({
    queryKey: ['attachments', id],
    queryFn: () => ticketApi.getAttachments(id!),
    enabled: !!id,
    refetchInterval: 4000
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => ticketApi.uploadAttachment(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
      setSuccessNotice('Tải lên ảnh đính kèm thành công.');
      setTimeout(() => setSuccessNotice(null), 3000);
    },
    onError: (err: any) => {
      setErrorNotice(formatErrorMessage(err, 'Lỗi tải ảnh đính kèm.'));
      setTimeout(() => setErrorNotice(null), 4000);
    }
  });

  // 1. Send Reply Mutation
  const addCommentMutation = useMutation({
    mutationFn: ({ 
      content, 
      isInternal,
      isAiGenerated = false,
      editedByAgent = false
    }: { 
      content: string; 
      isInternal: boolean;
      isAiGenerated?: boolean;
      editedByAgent?: boolean;
    }) => 
      ticketApi.addComment(id!, content, isInternal, isAiGenerated, editedByAgent),
    onSuccess: () => {
      setReplyText('');
      setAiDraftText(null);
      setReplyingTo(null);
      setErrorNotice(null);
      setSuccessNotice(isInternalNote ? 'Đã lưu ghi chú nội bộ.' : 'Đã gửi phản hồi.');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setTimeout(() => setSuccessNotice(null), 3000);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    onError: (err: any) => {
      setErrorNotice(formatErrorMessage(err, 'Lỗi khi gửi phản hồi.'));
      setTimeout(() => setErrorNotice(null), 4000);
    }
  });

  // 2. AI Copilot Suggestion Mutation
  const suggestMutation = useMutation({
    mutationFn: () => {
      const allContext = `Tiêu đề: ${ticket?.title || ''}\nMô tả: ${ticket?.description || ''}\nLịch sử trao đổi:\n` + 
        comments.map(c => `${c.user_name || 'Người dùng'}: ${c.content}`).join('\n');
      return ticketApi.suggestReply(id!, allContext);
    },
    onSuccess: (data: any) => {
      let reply = data?.suggested_reply || data?.draft_reply || '';
      if (reply) {
        // Loại bỏ triệt để các ký tự định dạng markdown như **từ khóa**, *từ khóa*, __từ khóa__
        reply = reply
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/__(.*?)__/g, '$1')
          .replace(/(?<!\*)\*(?!\s)(.*?)(?!\s)\*(?!\*)/g, '$1')
          .trim();

        setAiDraftText(reply);
        setReplyText(reply);
        setIsInternalNote(false);
        setSuccessNotice('AI Copilot đã tạo câu trả lời nháp. Vui lòng kiểm tra và chỉnh sửa trước khi gửi.');
        setTimeout(() => setSuccessNotice(null), 4000);
        setTimeout(() => replyTextareaRef.current?.focus(), 100);
      }
    },
    onError: (err: any) => {
      setErrorNotice(formatErrorMessage(err, 'Không thể lấy gợi ý AI.'));
      setTimeout(() => setErrorNotice(null), 4000);
    }
  });

  // 3. AI Summarize History Mutation
  const summarizeMutation = useMutation({
    mutationFn: () => {
      const commentTexts = [
        `Mô tả ban đầu: ${ticket?.description || ''}`,
        ...comments.map(c => `${c.user_name || 'User'}: ${c.content}`)
      ];
      return ticketApi.summarizeHistory(id!, commentTexts);
    },
    onSuccess: () => {
      setShowAiSummary(true);
    },
    onError: (err: any) => {
      setErrorNotice(formatErrorMessage(err, 'Không thể tạo tóm tắt AI.'));
      setTimeout(() => setErrorNotice(null), 4000);
    }
  });

  // 4. AI Triage / Classify Mutation
  const classifyMutation = useMutation({
    mutationFn: () => ticketApi.classifyTicket(id!, ticket?.description || ''),
    onSuccess: () => {
      setShowAiTriageModal(true);
    },
    onError: (err: any) => {
      setErrorNotice(formatErrorMessage(err, 'Không thể phân tích AI Triage.'));
      setTimeout(() => setErrorNotice(null), 4000);
    }
  });

  const deleteTicketMutation = useMutation({
    mutationFn: () => ticketApi.deleteTicket(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      alert(data?.message || 'Đã xóa ticket thành công.');
      navigate('/tickets');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Xóa ticket thất bại.');
    }
  });

  // 5. Update Ticket Status / Priority / Category Mutation
  const updateTicketMutation = useMutation({
    mutationFn: (data: any) => ticketApi.updateTicket(id!, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (variables.status === 'RESOLVED') {
        setSuccessNotice('Đã chuyển trạng thái sang Đã giải quyết (RESOLVED).');
      } else if (variables.status === 'CLOSED') {
        setSuccessNotice('Đã đóng ticket thành công (CLOSED).');
      } else if (variables.status === 'PROCESSING') {
        setSuccessNotice('Đã chuyển trạng thái sang Đang xử lý (PROCESSING).');
      } else if (variables.status === 'WAITING_CUSTOMER') {
        setSuccessNotice('Đã chuyển trạng thái sang Chờ khách phản hồi (WAITING_CUSTOMER).');
      } else {
        setSuccessNotice('Đã cập nhật thông tin ticket.');
      }
      setTimeout(() => setSuccessNotice(null), 3500);
    },
    onError: (err: any) => {
      setErrorNotice(formatErrorMessage(err, 'Lỗi khi cập nhật ticket.'));
      setTimeout(() => setErrorNotice(null), 4000);
    }
  });

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || addCommentMutation.isPending) return;

    let finalContent = replyText.trim();
    if (replyingTo) {
      const cleanSnippet = replyingTo.text
        .replace(/\n/g, ' ')
        .replace(/^> \[Re:.*?\]:.*?\.\.\.\s*/, '')
        .slice(0, 75);
      finalContent = `> [Re: @${replyingTo.author}]: ${cleanSnippet}...\n\n${finalContent}`;
    }

    const isAi = Boolean(aiDraftText);
    const wasEdited = isAi ? (finalContent.trim() !== aiDraftText?.trim()) : false;

    addCommentMutation.mutate({
      content: finalContent,
      isInternal: isInternalNote,
      isAiGenerated: isAi,
      editedByAgent: wasEdited
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendReply(e);
    }
  };

  const handleApplyAiClassification = () => {
    if (!classifyMutation.data) return;
    const catVal = classifyMutation.data.category_code || classifyMutation.data.category;
    updateTicketMutation.mutate({
      priority: classifyMutation.data.priority,
      category_id: catVal
    }, {
      onSuccess: () => {
        classifyMutation.reset();
        setShowAiTriageModal(false);
        setSuccessNotice('Đã áp dụng đề xuất phân loại AI.');
      }
    });
  };

  const handleCloseTicket = () => {
    updateTicketMutation.mutate({ status: 'CLOSED' });
  };

  const handleResolveTicket = () => {
    updateTicketMutation.mutate({ status: 'RESOLVED' });
  };

  const handleReopenTicket = () => {
    updateTicketMutation.mutate({ status: 'PROCESSING' });
  };

  const handleAcceptTicket = () => {
    updateTicketMutation.mutate({ status: 'PROCESSING' });
  };

  const handleCopyCode = () => {
    if (!ticket?.ticket_code) return;
    navigator.clipboard.writeText(ticket.ticket_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isTicketLoading) {
    return (
      <Layout>
        <div className="flex justify-center p-12 h-full items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="p-8 text-center text-slate-500">Không tìm thấy thông tin ticket</div>
      </Layout>
    );
  }

  const isRequester = currentUser?.role_name === 'REQUESTER';
  const isAdmin = currentUser?.role_name === 'ADMIN';
  const isTeamLead = currentUser?.role_name === 'TEAM_LEAD';
  const isSupportAgent = currentUser?.role_name === 'SUPPORT_AGENT';
  const canManageTicketStatus = isAdmin || isTeamLead || isSupportAgent;

  // RBAC theo báo cáo UC-03 & TC_BIZ_02: CHỈ TEAM_LEAD được quyền phân công thủ công
  const canAssignAgent = isTeamLead;
  const canManageEscalation = isTeamLead;
  const isTicketClosed = ticket.status === 'CLOSED';

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>Chờ nhân viên xử lý</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Đang xử lý</span>
          </span>
        );
      case 'WAITING_CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Chờ khách hàng phản hồi</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Đã giải quyết</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Đã đóng</span>
          </span>
        );
      default:
        return null;
    }
  };

  const handleDeleteTicket = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ticket [${ticket?.ticket_code}] không?`)) {
      deleteTicketMutation.mutate();
    }
  };

  const cleanAuthorName = (name?: string) => {
    if (!name) return 'Người dùng';
    return name.replace(/\s*\((Support Agent|Requester|Admin|TEAM_LEAD|Quản trị viên|Kỹ thuật viên|Kế toán|Nhân viên)\)/gi, '').trim();
  };

  const getUserAvatar = (name?: string, userId?: string) => {
    const isCurrentAdmin = (currentUser && (name === currentUser.full_name || userId === currentUser.id)) || name?.includes('Admin') || name === 'System Administrator';
    if (isCurrentAdmin) {
      const saved = localStorage.getItem('user_avatar');
      if (saved) return saved;
    }
    if (userId) {
      const userCustom = localStorage.getItem(`user_avatar_${userId}`);
      if (userCustom) return userCustom;
    }
    const sum = String(name || userId || 'U').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const avatarIndex = (sum % 39) + 1;
    return `/avatar/${String(avatarIndex).padStart(2, '0')}.jpg`;
  };

  const getCategoryNameFromCode = (code?: string) => {
    switch (code) {
      case 'ACCOUNT_AUTH': return 'Tài khoản & Xác thực';
      case 'SOFTWARE_BUG': return 'Lỗi phần mềm';
      case 'NETWORK_INFRA': return 'Hạ tầng mạng & VPN';
      case 'ACCESS_RESOURCE': return 'Cấp quyền & Tài nguyên';
      case 'TECH_GUIDE': return 'Hướng dẫn kỹ thuật';
      case 'DEVICE': return 'Thiết bị & Máy in';
      case 'UNCATEGORIZED': return 'Chưa phân loại';
      default: return code || 'Chưa phân loại';
    }
  };

  const getSelectedCategoryCode = (t: any) => {
    if (t?.category_code) return t.category_code;
    const raw = t?.category_id;
    if (raw && !raw.includes('-') && raw.length < 30) return raw;
    const name = (t?.category_name || '').toLowerCase();
    if (name.includes('hướng dẫn')) return 'TECH_GUIDE';
    if (name.includes('tài khoản') || name.includes('xác thực')) return 'ACCOUNT_AUTH';
    if (name.includes('phần mềm') || name.includes('bug')) return 'SOFTWARE_BUG';
    if (name.includes('hạ tầng') || name.includes('mạng') || name.includes('vpn')) return 'NETWORK_INFRA';
    if (name.includes('quyền') || name.includes('tài nguyên')) return 'ACCESS_RESOURCE';
    if (name.includes('thiết bị') || name.includes('máy in') || name.includes('phần cứng')) return 'DEVICE';
    return 'UNCATEGORIZED';
  };

  const getCategoryLabel = (t: any) => {
    if (t?.category_name) return t.category_name;
    const raw = t?.category_id;
    if (raw && !raw.includes('-') && raw.length < 30) return getCategoryNameFromCode(raw);
    const text = `${t?.title || ''} ${t?.description || ''}`.toLowerCase();
    if (text.includes('máy in') || text.includes('driver')) return 'Thiết bị & Máy in';
    if (text.includes('quyền') || text.includes('thư mục') || text.includes('mkt') || text.includes('truy cập')) return 'Cấp quyền & Tài nguyên';
    if (text.includes('crm') || text.includes('đăng nhập') || text.includes('mật khẩu') || text.includes('tài khoản')) return 'Tài khoản & Xác thực';
    if (text.includes('kế toán') || text.includes('báo cáo') || text.includes('phần mềm') || text.includes('excel') || text.includes('bug')) return 'Lỗi phần mềm';
    if (text.includes('mạng') || text.includes('wifi') || text.includes('vpn') || text.includes('internet')) return 'Hạ tầng mạng & VPN';
    return 'Hướng dẫn kỹ thuật';
  };

  // SLA calculations
  const responseSla = getSlaStatus(ticket.first_response_due_at, ticket.first_responded_at);
  const resolutionSla = getSlaStatus(ticket.resolution_due_at, ticket.resolved_at || ticket.closed_at);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100dvh-64px)] bg-[#f8fafc] overflow-hidden">
        
        {/* THANH TIÊU ĐỀ TICKET GỌN GÀNG (Chỉ giữ thông tin cần thiết: Quay lại, Mã, Tiêu đề và 1 Trạng thái) */}
        <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 shrink-0 flex flex-col items-stretch xl:flex-row xl:items-center justify-between gap-2 z-10 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <Link 
              to="/tickets" 
              className="inline-flex items-center gap-1.5 justify-center h-8 w-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Quay lại danh sách yêu cầu"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quay lại</span>
            </Link>

            <div className="h-4 w-px bg-slate-200 shrink-0 hidden sm:block" />

            <button
              type="button"
              onClick={handleCopyCode}
              className="group inline-flex flex-1 sm:flex-none min-w-0 items-center justify-center gap-1 text-[11px] sm:text-xs font-mono font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
              title="Sao chép mã ticket"
            >
              <span className="truncate">{ticket.ticket_code}</span>
              {copiedCode ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
              )}
            </button>

            <span className="hidden sm:inline text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 max-w-full break-words">
              {getCategoryLabel(ticket)}
            </span>

            {/* Huy hiệu trạng thái xử lý trực quan ngay cạnh tiêu đề */}
            {renderStatusBadge(ticket.status)}

            <h1 className="w-full xl:w-auto xl:flex-1 text-sm sm:text-base font-semibold text-slate-900 break-words xl:truncate min-w-0" title={ticket.title}>
              {ticket.title}
            </h1>

          </div>

          {/* Nút hành động chính */}
          <div className="flex items-center gap-1.5 sm:gap-2 w-full xl:w-auto shrink-0 min-w-0 [&_button]:min-h-10 [&_button]:justify-center [&_button]:whitespace-nowrap [&_svg]:shrink-0">
            {/* Các nút hành động xử lý trạng thái ticket */}
            {canManageTicketStatus && ticket.status === 'RESOLVED' && (
              <div className="grid grid-cols-2 flex-1 xl:flex-none min-w-0 gap-1.5">
                <button
                  type="button"
                  onClick={handleReopenTicket}
                  disabled={updateTicketMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Mở lại yêu cầu để tiếp tục xử lý (Đang xử lý)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mở lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={updateTicketMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Đóng hoàn tất ticket này (CLOSED)"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="sm:hidden">Đóng</span>
                  <span className="hidden sm:inline">Đóng ticket</span>
                </button>
              </div>
            )}

            {canManageTicketStatus && ticket.status === 'CLOSED' && (
              <button
                type="button"
                onClick={handleAcceptTicket}
                disabled={updateTicketMutation.isPending}
                className="inline-flex flex-1 xl:flex-none items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                title="Mở lại ticket đã đóng"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mở lại yêu cầu</span>
              </button>
            )}

            {canManageTicketStatus && ticket.status === 'NEW' && (
              <button
                type="button"
                onClick={handleReopenTicket}
                disabled={updateTicketMutation.isPending}
                className="inline-flex flex-1 xl:flex-none items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                title="Tiếp nhận ticket và chuyển sang trạng thái đang xử lý"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tiếp nhận xử lý</span>
              </button>
            )}

            {canManageTicketStatus && (ticket.status === 'PROCESSING' || ticket.status === 'WAITING_CUSTOMER') && (
              <div className="grid grid-cols-2 flex-1 xl:flex-none min-w-0 gap-1.5">
                <button
                  type="button"
                  onClick={handleResolveTicket}
                  disabled={updateTicketMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Đánh dấu đã giải quyết sự cố (RESOLVED) - Kỹ thuật đã xử lý xong"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="sm:hidden">Giải quyết</span>
                  <span className="hidden sm:inline">Giải quyết ticket</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={updateTicketMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Đóng hoàn tất ticket (CLOSED)"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="sm:hidden">Đóng</span>
                  <span className="hidden sm:inline">Đóng ticket</span>
                </button>
              </div>
            )}

            {/* Xóa ticket (Chỉ hiển thị cho Quản trị viên) */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleDeleteTicket}
                disabled={deleteTicketMutation.isPending}
                title="Xóa vĩnh viễn ticket (Chỉ Quản trị viên)"
                className="inline-flex shrink-0 items-center gap-1 w-10 sm:w-auto sm:px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteTicketMutation.isPending ? (
                  <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span className="hidden sm:inline">Xóa</span>
              </button>
            )}
          </div>
        </header>

        {/* Thông báo thao tác ngắn gọn */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-emerald-800 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
            <button onClick={() => setSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer">✕</button>
          </div>
        )}

        {errorNotice && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-rose-800 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorNotice}</span>
            </div>
            <button onClick={() => setErrorNotice(null)} className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer">✕</button>
          </div>
        )}

        {/* BỐ CỤC 2 CỘT: Cột chính (Nội dung & Hội thoại) + Cột phụ (Bảng thuộc tính có thể đóng/mở) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 pb-24 sm:pb-24">
          <div className={`mx-auto transition-all duration-300 ${isTicketInfoCollapsed
            ? 'max-w-screen-2xl grid grid-cols-1 items-start'
            : 'max-w-7xl grid grid-cols-1 gap-6 items-start lg:grid-cols-12'
          }`}>
            
            {/* CỘT CHÍNH: Mở rộng tràn viền toàn bộ khi thu gọn thông tin, hoặc 8 cột khi mở panel */}
            <div className={`min-w-0 space-y-5 transition-all duration-300 ${
              isTicketInfoCollapsed ? 'lg:col-span-12' : 'lg:col-span-8'
            }`}>
              {isTicketInfoCollapsed && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsTicketInfoCollapsed(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Hiện thông tin ticket
                  </button>
                </div>
              )}
              
              {/* 1. NỘI DUNG SỰ CỐ BAN ĐẦU */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden ring-1 ring-slate-200">
                      <img 
                        src={getUserAvatar(ticket.requester_name, ticket.requester_id)} 
                        alt={ticket.requester_name || 'Khách hàng'}
                        className="w-full h-full object-cover shrink-0"
                        onError={(e) => { 
                          e.currentTarget.style.display = 'none'; 
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <span className="hidden w-full h-full items-center justify-center">
                        {(ticket.requester_name || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {cleanAuthorName(ticket.requester_name)}
                        </span>
                        <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded">
                          Người tạo yêu cầu
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
                        <span>Mã: {ticket.requester_id ? ticket.requester_id.slice(0, 8) : 'N/A'}</span>
                        <span>•</span>
                        <span>{formatTicketDate(ticket.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDescriptionCollapsed(!isDescriptionCollapsed)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                    >
                      {isDescriptionCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isDescriptionCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
                    </button>
                  </div>
                </div>

                {!isDescriptionCollapsed && (
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="text-sm text-slate-800 leading-relaxed font-normal">
                      <MarkdownView content={ticket.description || 'Không có mô tả chi tiết.'} />
                    </div>

                    {/* Danh sách ảnh đính kèm của yêu cầu ban đầu (chỉ hiển thị khi có tệp đính kèm) */}
                    {attachments.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                            Tệp đính kèm ({attachments.length})
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                          {attachments.map((att) => (
                            <AuthenticatedAttachment key={att.id} ticketId={id!} attachment={att} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. DÒNG THỜI GIAN TRAO ĐỔI (Đã khử trùng lặp sự kiện, màu sắc dịu mắt) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> 
                    Lịch sử trao đổi ({displayComments.length})
                  </h3>
                </div>

                {displayComments.length === 0 ? (
                  <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">Chưa có trao đổi nào</p>
                    <p className="text-[11px] text-slate-400">Nhập phản hồi bên dưới để trao đổi thông tin.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayComments.map((cmt, idx) => {
                      const isOwn = currentUser?.id === cmt.user_id || (currentUser?.full_name && cmt.user_name === currentUser.full_name);
                      const { replyAuthor, replySnippet, cleanContent } = parseCommentContent(cmt.content);
                      const isSystemNote = cmt.content?.startsWith('[Hệ thống]') || 
                                           cmt.content?.startsWith('🤖') || 
                                           cmt.content?.startsWith('👤 [Chuyển cấp');
                      const authorName = isSystemNote ? 'Hệ thống tự động' : cleanAuthorName(cmt.user_name);
                      const isStaffComment = cmt.user_role === 'SUPPORT_AGENT' || cmt.user_role === 'TEAM_LEAD' || cmt.user_role === 'ADMIN' || cmt.user_role === 'AGENT';

                      return (
                        <div 
                          key={cmt.id || idx}
                          className={`rounded-xl border transition-all ${
                            isSystemNote
                              ? 'bg-indigo-50/30 border-indigo-100 shadow-2xs'
                              : cmt.is_internal 
                                ? 'bg-slate-50/80 border-slate-200/90 shadow-2xs' 
                                : 'bg-white border-slate-200/80 shadow-2xs'
                          }`}
                        >
                          {/* Header bình luận: Tên + Đúng 1 nhãn vai trò/loại + Thời gian */}
                          <div className={`px-4 py-2 border-b flex items-center justify-between gap-2 ${
                            isSystemNote
                              ? 'bg-indigo-50/60 border-indigo-100'
                              : cmt.is_internal 
                                ? 'bg-slate-100/70 border-slate-200/80' 
                                : 'bg-slate-50/50 border-slate-100'
                          }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 overflow-hidden ring-1 ${
                                isSystemNote
                                  ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
                                  : 'bg-slate-300 text-slate-700 ring-slate-200'
                              }`}>
                                {isSystemNote ? (
                                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                                ) : (
                                  <>
                                    <img 
                                      src={getUserAvatar(cmt.user_name, cmt.user_id)} 
                                      alt={authorName}
                                      className="w-full h-full object-cover shrink-0"
                                      onError={(e) => { 
                                        e.currentTarget.style.display = 'none'; 
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                    <span className="hidden w-full h-full items-center justify-center">
                                      {authorName[0]?.toUpperCase() || 'U'}
                                    </span>
                                  </>
                                )}
                              </div>

                              <span className={`font-semibold text-xs truncate ${isSystemNote ? 'text-indigo-950 font-bold' : 'text-slate-900'}`}>
                                {authorName}
                              </span>

                              {/* Nhãn vai trò / Loại ghi chú */}
                              {isSystemNote ? (
                                <span className="text-[10px] font-medium text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded inline-flex items-center gap-1 shrink-0">
                                  <Bot className="w-2.5 h-2.5 text-indigo-600" />
                                  <span>Thông báo hệ thống</span>
                                </span>
                              ) : cmt.is_internal ? (
                                <span className="text-[10px] font-medium text-slate-700 bg-slate-200/80 border border-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1 shrink-0">
                                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                                  <span>Ghi chú nội bộ</span>
                                </span>
                              ) : null}
                            </div>

                            <div className="text-[11px] text-slate-400 shrink-0">
                              {formatTicketDate(cmt.created_at)}
                            </div>
                          </div>

                          {/* Nội dung bình luận */}
                          <div className="px-4 py-3 space-y-2">
                            {replyAuthor && (
                              <div className="p-2 bg-slate-100/70 border-l-2 border-indigo-400 rounded-r text-xs text-slate-600 italic">
                                <span className="font-semibold text-slate-800 not-italic">@{replyAuthor}:</span> {replySnippet}...
                              </div>
                            )}

                            <div className="text-sm text-slate-800 leading-relaxed font-normal">
                              <MarkdownView content={cleanContent} />
                            </div>

                            {/* Footer bình luận */}
                            <div className="pt-1.5 flex items-center justify-between text-xs">
                              {isRequester && isStaffComment ? (
                                <div className="flex items-center gap-1 text-slate-400">
                                  <span className="text-[11px]">Đánh giá:</span>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => handleRateComment(cmt.id, star)}
                                      className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                                    >
                                      <Star 
                                        className={`w-3 h-3 ${
                                          (commentRatings[cmt.id] || 0) >= star
                                            ? 'text-amber-400 fill-amber-400'
                                            : 'text-slate-300 hover:text-amber-300'
                                        }`} 
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : <div />}

                              {!isOwn && !isSystemNote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo({
                                      id: cmt.id,
                                      author: authorName,
                                      text: cleanContent
                                    });
                                    setTimeout(() => replyTextareaRef.current?.focus(), 100);
                                  }}
                                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer ml-auto"
                                >
                                  <Quote className="w-3 h-3" />
                                  <span>Trích dẫn</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* 3. KHUNG SOẠN TIN NHẮN (Gọn, ít màu nổi, thao tác phụ tinh tế) */}
              <div className={`bg-white rounded-xl border border-slate-200 shadow-2xs transition-all ${
                isExpandedComposer ? 'fixed inset-x-0 bottom-0 top-16 z-40 p-3 sm:p-6 overflow-y-auto flex flex-col bg-white rounded-none border-t border-slate-300' : ''
              }`}>
                <div className={`w-full ${isExpandedComposer ? 'flex-1 flex flex-col h-full max-w-4xl mx-auto' : ''}`}>
                  
                  {/* Thanh công cụ khung nhập: Chọn loại tin + Thao tác phụ */}
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 rounded-t-xl">
                    {!isRequester ? (
                      <div className="grid grid-cols-2 sm:flex w-full sm:w-auto min-w-0 items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsInternalNote(false)}
                          className={`px-2 sm:px-3 py-2 sm:py-1.5 min-w-0 rounded-md text-xs font-semibold transition-all cursor-pointer inline-flex justify-center items-center gap-1.5 ${
                            !isInternalNote 
                              ? 'bg-indigo-600 text-white shadow-xs' 
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          }`}
                        >
                          <Globe className={`w-3.5 h-3.5 ${!isInternalNote ? 'text-white' : 'text-slate-500'}`} />
                          <span>Phản hồi công khai</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsInternalNote(true)}
                          className={`px-2 sm:px-3 py-2 sm:py-1.5 min-w-0 rounded-md text-xs font-semibold transition-all cursor-pointer inline-flex justify-center items-center gap-1.5 ${
                            isInternalNote 
                              ? 'bg-amber-600 text-white shadow-xs' 
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          }`}
                        >
                          <Lock className={`w-3.5 h-3.5 ${isInternalNote ? 'text-white' : 'text-slate-500'}`} />
                          <span>Ghi chú nội bộ</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        <span>Phản hồi cho nhân viên hỗ trợ</span>
                      </div>
                    )}

                    {/* Thao tác phụ cho nhân viên: Gợi ý AI, Tóm tắt (Đúng chuẩn nghiệp vụ, tinh gọn) */}
                    <div className="flex items-center gap-2">
                      {!isRequester && (
                        <>
                          {/* Gợi ý AI */}
                          <button 
                            type="button"
                            onClick={() => suggestMutation.mutate()}
                            disabled={suggestMutation.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs disabled:opacity-50"
                            title="AI Copilot tạo câu trả lời nháp từ kho tri thức"
                          >
                            <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${suggestMutation.isPending ? 'animate-spin' : ''}`} />
                            <span>{suggestMutation.isPending ? 'Đang tạo...' : 'Gợi ý AI'}</span>
                          </button>

                          {/* Tóm tắt */}
                          <button 
                            type="button"
                            onClick={() => summarizeMutation.mutate()}
                            disabled={summarizeMutation.isPending || displayComments.length < 2}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs disabled:opacity-40"
                            title="Tóm tắt ngắn gọn cuộc trao đổi"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden sm:inline">Tóm tắt</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsExpandedComposer(!isExpandedComposer)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg shadow-2xs transition-all cursor-pointer"
                        title={isExpandedComposer ? "Thu nhỏ" : "Mở rộng"}
                      >
                        {isExpandedComposer ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Banner kiểm duyệt bản nháp AI (Human-In-The-Loop) */}
                  {aiDraftText && (
                    <div className="mx-4 mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Bot className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">Bản nháp AI: Bạn có thể chỉnh sửa trước khi bấm gửi.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setAiDraftText(null); setReplyText(''); }}
                        className="text-[11px] text-slate-500 hover:text-rose-600 font-medium cursor-pointer shrink-0"
                      >
                        Bỏ bản nháp
                      </button>
                    </div>
                  )}

                  {/* Trích dẫn đang hoạt động */}
                  {replyingTo && (
                    <div className="mx-4 mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Trích dẫn @{replyingTo.author}: "{replyingTo.text.slice(0, 60)}..."</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        title="Hủy trích dẫn"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Ô nhập tin nhắn */}
                  <form onSubmit={handleSendReply} className={`p-4 space-y-3 ${isExpandedComposer ? 'flex-1 flex flex-col' : ''}`}>
                    <textarea 
                      ref={replyTextareaRef}
                      required
                      rows={isExpandedComposer ? 12 : 3}
                      onKeyDown={handleKeyDown}
                      className={`w-full resize-y border rounded-lg p-3 text-sm focus:outline-none transition-all leading-relaxed ${
                        isExpandedComposer ? 'flex-1 h-full' : 'min-h-[80px] max-h-[300px]'
                      } ${
                        isInternalNote 
                          ? 'border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-slate-400 text-slate-900 placeholder-slate-400' 
                          : 'border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 text-slate-900 placeholder-slate-400'
                      }`}
                      placeholder={
                        isInternalNote 
                          ? "Nhập ghi chú nội bộ (chỉ nhân viên nhìn thấy)..."
                          : "Nhập nội dung phản hồi..."
                      }
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium cursor-pointer transition-colors">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                          <span>{uploadAttachmentMutation.isPending ? 'Đang tải...' : `Đính kèm (${attachments.length}/5)`}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={uploadAttachmentMutation.isPending || attachments.length >= 5}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                uploadAttachmentMutation.mutate(file);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        {replyText.trim() && (
                          <button
                            type="button"
                            onClick={() => { setReplyText(''); setAiDraftText(null); }}
                            className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            Xóa nháp
                          </button>
                        )}

                        <button
                          type="submit"
                          disabled={!replyText.trim() || addCommentMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-black text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {addCommentMutation.isPending ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Đang gửi...</span>
                            </>
                          ) : (
                            <>
                              <span>{isInternalNote ? 'Lưu ghi chú' : 'Gửi'}</span>
                              <Send className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

            </div>

            {!isTicketInfoCollapsed && (
            <>
            {/* CỘT PHỤ (4 CỘT): Gom nhóm thuộc tính Ticket, Cam kết SLA và Người yêu cầu thành 1 khối tinh gọn */}
              <div className="min-w-0 lg:col-span-4 space-y-4 lg:sticky lg:top-4 animate-in fade-in slide-in-from-right-4 duration-200">
                
                {/* BẢNG THUỘC TÍNH TICKET (Gọn gàng, đúng quyền cho từng vai trò) */}
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      Thuộc tính yêu cầu
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsTicketInfoCollapsed(true)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                        title="Thu gọn thông tin ticket"
                      >
                        <Minimize2 className="w-3 h-3" />
                        <span>Thu gọn</span>
                      </button>
                      {!isRequester && (
                        <button
                          type="button"
                          onClick={() => classifyMutation.mutate()}
                          disabled={classifyMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                          title="AI Triage đề xuất phân loại"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${classifyMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>AI Triage</span>
                        </button>
                      )}

                    </div>
                  </div>

                {!isRequester ? (
                  <div className="space-y-3">
                    {/* Trạng thái xử lý */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">Trạng thái xử lý</label>
                      <div className="relative">
                        <select
                          value={ticket.status}
                          disabled={updateTicketMutation.isPending}
                          onChange={(e) => updateTicketMutation.mutate({ status: e.target.value })}
                          className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition-all pr-7 appearance-none"
                        >
                          <option value="NEW">Chờ nhân viên xử lý (NEW)</option>
                          <option value="PROCESSING">Đang xử lý (PROCESSING)</option>
                          <option value="WAITING_CUSTOMER">Chờ khách phản hồi (WAITING)</option>
                          <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                          <option value="CLOSED">Đã đóng (CLOSED)</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Mức độ ưu tiên */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">Mức độ ưu tiên</label>
                      <div className="relative">
                        <select
                          value={ticket.priority || 'P3'}
                          disabled={updateTicketMutation.isPending}
                          onChange={(e) => updateTicketMutation.mutate({ priority: e.target.value })}
                          className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition-all pr-7 appearance-none"
                        >
                          <option value="P1">P1 - Khẩn cấp (SLA 1-2h)</option>
                          <option value="P2">P2 - Cao (SLA 4-8h)</option>
                          <option value="P3">P3 - Trung bình (SLA 24h)</option>
                          <option value="P4">P4 - Thấp (SLA 48h)</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Danh mục sự cố */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">Danh mục</label>
                      <div className="relative">
                        <select
                          value={getSelectedCategoryCode(ticket)}
                          disabled={updateTicketMutation.isPending}
                          onChange={(e) => updateTicketMutation.mutate({ category_id: e.target.value })}
                          className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition-all pr-7 appearance-none"
                        >
                          <option value="ACCOUNT_AUTH">Tài khoản & Xác thực</option>
                          <option value="SOFTWARE_BUG">Lỗi phần mềm</option>
                          <option value="NETWORK_INFRA">Hạ tầng mạng & VPN</option>
                          <option value="ACCESS_RESOURCE">Cấp quyền & Tài nguyên</option>
                          <option value="DEVICE">Thiết bị & Máy in</option>
                          <option value="TECH_GUIDE">Hướng dẫn kỹ thuật</option>
                          <option value="UNCATEGORIZED">Chưa phân loại</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Cấp độ hỗ trợ (L1/L2) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-slate-500">Cấp hỗ trợ</label>
                      </div>
                      {canManageEscalation ? (
                        <div className="relative">
                          <select
                            value={ticket.support_level || 'L1'}
                            disabled={updateTicketMutation.isPending}
                            onChange={(e) => updateTicketMutation.mutate({ support_level: e.target.value })}
                            className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition-all pr-7 appearance-none"
                          >
                            <option value="L1">L1</option>
                            <option value="L2">L2</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                          {ticket.support_level === 'L2' ? 'L2' : 'L1'}
                        </div>
                      )}
                    </div>

                    {/* Phân công nhân viên: CHỈ TEAM_LEAD có dropdown; AGENT và ADMIN ở chế độ chỉ đọc */}
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-slate-500">Kỹ thuật viên phụ trách</label>
                        {ticket.previous_agent_name && (
                          <span className="text-[10px] text-slate-400">Trước: {cleanAuthorName(ticket.previous_agent_name)}</span>
                        )}
                      </div>

                      {canAssignAgent ? (
                        <div className="relative">
                          <select
                            value={ticket.assigned_agent_id || ''}
                            disabled={updateTicketMutation.isPending}
                            onChange={(e) => updateTicketMutation.mutate({ assigned_agent_id: e.target.value || null })}
                            className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition-all pr-7 appearance-none"
                          >
                            <option value="">Chưa phân công (Chờ Team Lead)</option>
                            {specializedAgents.map((agent: any) => (
                              <option key={agent.id} value={agent.id}>
                                {cleanAuthorName(agent?.full_name)} [{agent?.support_level || 'L1'}]
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      ) : (
                        /* Chế độ chỉ đọc cho Support Agent và Quản trị viên (Không dropdown, không phân công lậu) */
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${ticket.assigned_agent_id ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {ticket.assigned_agent_name ? cleanAuthorName(ticket.assigned_agent_name) : 'Chưa phân công'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Giao diện xem thuộc tính cho REQUESTER (Chỉ đọc, dễ hiểu) */
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Mức độ ưu tiên:</span>
                      <span className="font-medium text-slate-800">
                        {ticket.priority === 'P1' ? 'P1 - Khẩn cấp' :
                         ticket.priority === 'P2' ? 'P2 - Cao' :
                         ticket.priority === 'P3' ? 'P3 - Trung bình' : 'P4 - Thấp'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Danh mục sự cố:</span>
                      <span className="font-medium text-slate-800">{getCategoryLabel(ticket)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Nhân viên phụ trách:</span>
                      <span className="font-medium text-slate-800">
                        {ticket.assigned_agent_name ? cleanAuthorName(ticket.assigned_agent_name) : 'Đang điều phối'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* CAM KẾT TIẾN ĐỘ SLA (Gọn gàng, dễ quét, không chiếm chỗ) */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Tiến độ cam kết SLA
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Phản hồi lần đầu</span>
                      <span className="font-medium text-slate-800 text-[11px]">
                        {ticket.first_response_due_at ? formatTicketDate(ticket.first_response_due_at) : 'Trong 4h làm việc'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${responseSla.color}`}>
                      {responseSla.badge}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Giải quyết hoàn tất</span>
                      <span className="font-medium text-slate-800 text-[11px]">
                        {ticket.resolution_due_at ? formatTicketDate(ticket.resolution_due_at) : 'Trong 24h'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${resolutionSla.color}`}>
                      {resolutionSla.badge}
                    </span>
                  </div>
                </div>
              </div>



            </div>
            </>
            )}

        </div>
      </div>

        {/* MODAL GỢI Ý PHÂN LOẠI AI TRIAGE (Chỉ mở khi nhân viên bấm yêu cầu) */}
        {showAiTriageModal && classifyMutation.data && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Đề xuất phân loại AI Triage
                </h4>
                <button 
                  onClick={() => setShowAiTriageModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Độ tin cậy:</span>
                    <span className="font-semibold text-slate-800">
                      {(classifyMutation.data.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Đề xuất danh mục:</span>
                    <span className="font-semibold text-slate-900">
                      {getCategoryNameFromCode(classifyMutation.data.category || classifyMutation.data.category_code)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Đề xuất ưu tiên:</span>
                    <span className="font-semibold text-slate-900">
                      {classifyMutation.data.priority}
                    </span>
                  </div>
                </div>

                {classifyMutation.data.rationale && (
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    <span className="font-medium text-slate-700">Căn cứ:</span> {classifyMutation.data.rationale}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAiTriageModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={handleApplyAiClassification}
                  disabled={updateTicketMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-black text-white cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {updateTicketMutation.isPending && (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{updateTicketMutation.isPending ? 'Đang áp dụng...' : 'Áp dụng đề xuất'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TÓM TẮT LỊCH SỬ AI (Chỉ mở khi bấm Tóm tắt) */}
        {showAiSummary && summarizeMutation.data && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-3 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  Tóm tắt lịch sử trao đổi bằng AI
                </h4>
                <button 
                  onClick={() => setShowAiSummary(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed max-h-80 overflow-y-auto">
                <MarkdownView content={summarizeMutation.data?.summary || ''} />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowAiSummary(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-black text-white cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default TicketDetailPage;
