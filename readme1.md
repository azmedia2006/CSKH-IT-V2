# Hệ thống IT Service Desk tích hợp AI

## Giới thiệu

Hệ thống IT Service Desk là ứng dụng web hỗ trợ bộ phận IT Helpdesk tiếp nhận, phân loại, phân công và xử lý sự cố kỹ thuật hoặc yêu cầu dịch vụ phần mềm. Hệ thống quản lý ticket tập trung, theo dõi cam kết SLA và cung cấp các công cụ AI để hỗ trợ phân loại sự cố, soạn câu trả lời nháp và tóm tắt lịch sử trao đổi.

AI chỉ đóng vai trò trợ lý. Nhân viên hỗ trợ phải kiểm duyệt nội dung AI trước khi gửi cho người yêu cầu. Dữ liệu nhạy cảm được lọc trước khi đưa qua dịch vụ AI bên ngoài.

> Tài liệu này tổng hợp phạm vi chức năng và kiến trúc được mô tả trong báo cáo đồ án. Báo cáo còn một số điểm chưa đồng nhất và phần minh chứng triển khai/kiểm thử còn chỗ trống; xem mục **Các điểm cần xác nhận** trước khi dùng README này làm tài liệu phát hành chính thức.

## Mục lục

- [Mục tiêu](#mục-tiêu)
- [Vai trò người dùng](#vai-trò-người-dùng)
- [Chức năng](#chức-năng)
- [Quy trình xử lý ticket](#quy-trình-xử-lý-ticket)
- [AI và bảo vệ dữ liệu](#ai-và-bảo-vệ-dữ-liệu)
- [AI hỗ trợ theo từng role](#ai-hỗ-trợ-theo-từng-role)
- [Dashboard, SLA và báo cáo](#dashboard-sla-và-báo-cáo)
- [Kiến trúc và công nghệ](#kiến-trúc-và-công-nghệ)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [API chính](#api-chính)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [Kiểm thử](#kiểm-thử)
- [Giới hạn và hướng phát triển](#giới-hạn-và-hướng-phát-triển)
- [Các điểm cần xác nhận](#các-điểm-cần-xác-nhận)

## Mục tiêu

Hệ thống hướng đến các mục tiêu sau:

- Tập trung hóa quy trình tiếp nhận và xử lý yêu cầu hỗ trợ.
- Theo dõi chủ sở hữu, trạng thái, mức độ ưu tiên và thời hạn SLA của từng ticket.
- Giảm thời gian đọc lịch sử dài và tra cứu hướng dẫn lặp lại cho nhân viên.
- Dùng AI để đề xuất phân loại, mức ưu tiên, câu trả lời nháp và bản tóm tắt.
- Giữ nhân viên trong vòng kiểm soát đối với mọi phản hồi do AI tạo.
- Lọc thông tin cá nhân và bí mật trước khi gửi ngữ cảnh sang AI.
- Ghi nhận các lượt gọi AI cùng hành động của nhân viên để hỗ trợ đánh giá và kiểm toán.

Phạm vi nghiệp vụ được nêu trong báo cáo là hỗ trợ IT nội bộ, tập trung vào sự cố kỹ thuật và yêu cầu dịch vụ phần mềm.

## Vai trò người dùng

| Vai trò                | Quyền và nhiệm vụ chính                                                                                                           | AI hỗ trợ theo role (đặc tả bổ sung)                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Requester / Customer   | Tạo ticket, theo dõi các ticket do mình tạo, trao đổi với nhân viên hỗ trợ và cung cấp thông tin bổ sung.                         | Hỏi đáp FAQ, làm rõ sự cố, soạn nháp ticket và giải thích trạng thái ticket của mình. |
| Support Agent          | Xem ticket được giao, xử lý sự cố, trao đổi với requester, dùng hoặc bỏ gợi ý AI, cập nhật trạng thái và chuyển cấp khi cần.      | Triage, tra cứu FAQ, gợi ý bước xử lý, soạn phản hồi và tóm tắt ticket.               |
| Team Lead / IT Manager | Điều phối và phân công ticket, xử lý ticket được chuyển cấp, theo dõi SLA, hiệu suất nhóm và chỉ số AI.                           | Tóm tắt SLA/hàng đợi, phát hiện rủi ro và đề xuất ưu tiên/phân công.                  |
| Admin                  | Quản lý tài khoản và vai trò, cấu hình danh mục/SLA, quản lý kho tri thức và xem thông tin kiểm toán theo quyền được cấp.         | Soạn/rà soát FAQ, gợi ý cấu hình và tóm tắt log; Admin duyệt trước khi lưu.           |
| AI Engine              | Tác nhân hệ thống thực hiện phân loại, đề xuất phản hồi và tóm tắt theo yêu cầu từ backend; không tự gửi phản hồi đến khách hàng. | Chỉ chạy tác vụ được backend ủy quyền trong phạm vi dữ liệu đã phân quyền.            |

### Xác thực và phân quyền

- Người dùng đăng nhập bằng email và mật khẩu.
- Báo cáo mô tả mật khẩu được băm bằng bcrypt; sau khi xác thực, backend cấp JWT.
- Quyền được kiểm tra theo vai trò ở giao diện và API.
- Tài khoản có thể được bật hoặc vô hiệu hóa.
- Requester chỉ được xem ticket của chính mình; Agent, Team Lead và Admin truy cập dữ liệu theo quyền được cấp.
- Yêu cầu không đủ quyền được từ chối; kịch bản kiểm thử trong báo cáo kỳ vọng trả HTTP 403 cho thao tác phân công của Agent.

## Chức năng

### 1. Quản lý hồ sơ requester

- Xem danh sách requester, thông tin liên hệ, phòng ban, trạng thái tài khoản và số lượng ticket.
- Tìm requester theo tên hoặc email.
- Xem hồ sơ chi tiết cùng lịch sử ticket liên quan.
- Admin hoặc Team Lead có thể cập nhật thông tin hồ sơ theo quyền.
- Hệ thống kiểm tra email trùng lặp khi thêm hoặc chỉnh sửa hồ sơ.

### 2. Tạo và quản lý ticket

Requester tạo ticket với các thông tin chính:

- Tiêu đề sự cố.
- Mô tả chi tiết.
- Thông tin liên hệ theo biểu mẫu.
- Tệp hoặc ảnh chụp màn hình/log đính kèm, cùng tên tệp và metadata liên quan.

Khi tiếp nhận ticket, hệ thống được mô tả là sẽ:

1. Kiểm tra dữ liệu đầu vào.
2. Chạy bước lọc PII trên nội dung.
3. Gọi AI để đề xuất danh mục, mức ưu tiên và điểm tin cậy.
4. Tạo mã ticket duy nhất.
5. Lưu requester, nội dung, nhãn và các mốc SLA.
6. Đưa ticket vào hàng chờ phân công hoặc gán cho Agent theo logic phân bổ.
7. Thông báo cho Agent được giao và gửi xác nhận cho requester nếu cấu hình thông báo được bật.

Ticket có thể được xem chi tiết cùng timeline bình luận, người phụ trách, mức ưu tiên, thời gian còn lại SLA và các thao tác được phép theo vai trò.

### 3. Danh mục sự cố

Báo cáo mô tả năm nhóm nghiệp vụ:

1. **Tài khoản & Xác thực** — quên mật khẩu, lỗi đăng nhập, 2FA, tài khoản bị khóa.
2. **Bug Phần mềm** — lỗi giao diện, lỗi tính năng, ứng dụng bị crash hoặc lỗi giao dịch.
3. **Hạ tầng Mạng** — VPN, kết nối nội bộ, timeout đến máy chủ.
4. **Cấp quyền & Tài nguyên** — quyền truy cập cơ sở dữ liệu, tài khoản phần mềm, dung lượng.
5. **Hướng dẫn Kỹ thuật** — tra cứu cấu hình, thao tác và tài liệu hướng dẫn.

Admin quản lý tên, mã và mô tả danh mục. Mô tả danh mục cũng có thể được dùng làm ngữ cảnh cho bước phân loại AI.

### 4. Phân công, tìm kiếm và chuyển cấp

- Team Lead có thể xem danh sách ticket chưa được giao và chỉ định Agent.
- Báo cáo cũng mô tả khả năng phân công tự động cho Agent thuộc nhóm chuyên trách.
- Có thể tìm ticket theo mã hoặc từ khóa.
- Có thể lọc theo trạng thái, danh mục, mức ưu tiên, nhân viên phụ trách và cảnh báo SLA.
- Agent có thể thêm ghi chú nội bộ và chuyển ticket phức tạp lên Team Lead hoặc cấp kỹ thuật L2.
- Ghi chú nội bộ được đánh dấu để requester không nhìn thấy.

### 5. Bình luận và trao đổi

- Agent và requester trao đổi trong timeline của ticket.
- Agent có thể yêu cầu requester cung cấp thêm thông tin; ticket chuyển sang trạng thái chờ khách hàng.
- Mỗi bình luận lưu người viết, thời điểm, nội dung và cờ phân biệt ghi chú nội bộ.
- Bình luận có thể ghi nhận việc sử dụng nội dung AI và việc Agent đã chỉnh sửa nội dung đó hay chưa.
- Phản hồi chỉ được gửi sau khi Agent chủ động xác nhận thao tác gửi.

### 6. Tệp đính kèm

- Requester có thể chọn ảnh có sẵn hoặc chụp ảnh trực tiếp trên thiết bị di động khi tạo ticket; người có quyền trên ticket cũng có thể bổ sung ảnh ở trang chi tiết.
- Hỗ trợ PNG, JPG/JPEG và WEBP; tối đa 5 ảnh cho mỗi ticket, mỗi ảnh tối đa 10 MB. Backend kiểm tra chữ ký nội dung, không chỉ dựa trên tên tệp.
- Ảnh được lưu trong thư mục uploads theo ticket; metadata gồm tên tệp, đường dẫn lưu trữ, kích thước và thời gian tải lên được lưu ở bảng attachments.
- Danh sách và nội dung ảnh được lấy qua API có xác thực. Requester chỉ xem ảnh thuộc ticket của mình; ảnh không được phục vụ qua URL tĩnh công khai.
- Docker Compose gắn named volume uploads_data tại backend/uploads để giữ ảnh qua các lần tạo lại container.

### 7. Quản lý kho tri thức FAQ

- Admin quản lý bài viết hướng dẫn kỹ thuật và câu hỏi thường gặp.
- Bài viết có tiêu đề, nội dung, danh mục liên quan và trạng thái phát hành.
- Kho tri thức giúp Agent tra cứu giải pháp và cung cấp ngữ cảnh cho AI Copilot.
- Theo mô tả hiện tại, nội dung được lưu trong MySQL và được tìm theo danh mục/từ khóa để đưa vào prompt.
- Trường embedding được nêu như phần mở rộng; báo cáo nói phiên bản hiện tại chưa dùng tìm kiếm vector/ngữ nghĩa.

### 8. Cập nhật trạng thái và vòng đời

Các trạng thái ở mức dữ liệu được mô tả trong báo cáo:

| Giá trị          | Ý nghĩa                                                     |
| ---------------- | ----------------------------------------------------------- |
| NEW              | Ticket mới được tạo, chưa xử lý hoặc chưa được phân công.   |
| PROCESSING       | Ticket đang được Agent xử lý.                               |
| WAITING_CUSTOMER | Đang chờ requester phản hồi hoặc bổ sung thông tin.         |
| RESOLVED         | Sự cố đã được xử lý, chờ hoặc chuẩn bị đóng theo quy trình. |
| CLOSED           | Ticket đã đóng.                                             |

Agent có thể cập nhật trạng thái khi gửi phản hồi. Khi đang chờ requester, báo cáo mô tả việc tạm dừng đồng hồ SLA, gửi nhắc sau 48 giờ và tự đóng sau 72 giờ không có tương tác. Cần xác nhận các quy tắc thời gian này với cấu hình thực tế.

Khi nhân viên xác nhận sự cố đã xử lý xong, ticket được chuyển sang RESOLVED rồi đánh dấu CLOSED sau khi hoàn tất xác nhận. Với lịch sử trao đổi kéo dài nhiều ngày hoặc đã chuyển qua nhiều cấp như L1 → L2, Agent/Team Lead có thể dùng AI Summarizer trên trang chi tiết để tóm tắt vấn đề cốt lõi, tiến trình đã xử lý và hành động tiếp theo. Trong mã nguồn hiện tại, thao tác tóm tắt được gọi theo yêu cầu từ giao diện; việc đóng ticket không tự kích hoạt tóm tắt.

## Quy trình xử lý ticket

1. **Tiếp nhận:** Requester nhập tiêu đề, mô tả và tệp minh họa.
2. **Tiền xử lý:** Hệ thống lọc thông tin nhạy cảm trước khi lưu/gửi dữ liệu qua dịch vụ AI.
3. **Phân loại:** AI đề xuất một trong các danh mục, mức ưu tiên P1–P4 và confidence score.
4. **Thiết lập SLA:** Backend đối chiếu chính sách SLA để tính hạn phản hồi đầu tiên và hạn giải quyết.
5. **Phân công:** Ticket được đưa vào hàng chờ Team Lead hoặc gán cho Agent theo nhóm phù hợp.
6. **Xử lý:** Agent đọc nội dung và lịch sử, tra cứu FAQ, cập nhật trạng thái hoặc chuyển cấp.
7. **Hỗ trợ AI:** Agent có thể yêu cầu AI soạn phản hồi hoặc tóm tắt lịch sử.
8. **Kiểm duyệt:** Agent chấp nhận, sửa hoặc bỏ bản nháp. AI không tự gửi tin cho requester.
9. **Gửi phản hồi:** Bình luận được lưu vào ticket; trạng thái và thông tin SLA được cập nhật.
10. **Giải quyết/đóng:** Ticket được chuyển sang Resolved rồi Closed theo quy trình vận hành.

## AI và bảo vệ dữ liệu

### AI Triage — phân loại và ưu tiên

AI đọc nội dung ticket đã qua bước lọc dữ liệu và trả kết quả có cấu trúc, gồm:

- Danh mục sự cố.
- Mức ưu tiên đề xuất P1–P4.
- Điểm tin cậy từ 0.0 đến 1.0.

Mức ưu tiên được dùng cùng chính sách SLA để đề xuất hạn phản hồi và hạn xử lý. Kết quả phân loại là đề xuất để quy trình nghiệp vụ sử dụng; các phần trong báo cáo cần được thống nhất về việc Agent có thể chỉnh sửa nhãn hay không.

### AI Copilot — gợi ý câu trả lời

- Backend lấy ngữ cảnh ticket và tài liệu FAQ liên quan để tạo prompt.
- AI sinh một bản nháp lịch sự, bám vào thông tin có trong ticket/tài liệu.
- Prompt yêu cầu không tự cam kết bồi thường, hoàn tiền hoặc thời hạn/chính sách không có căn cứ.
- Agent có thể áp dụng nguyên văn, chỉnh sửa rồi gửi, hoặc bỏ gợi ý và tự soạn.
- Mọi nội dung vẫn cần được Agent kiểm tra trước khi gửi khách hàng.

### AI Summarizer — tóm tắt lịch sử

Tóm tắt mô tả ticket và các bình luận dài thành các ý ngắn, tập trung vào:

- Vấn đề cốt lõi.
- Các bước đã thử hoặc đã xử lý.
- Tình trạng hiện tại và việc cần làm tiếp theo.

Bản tóm tắt giúp người tiếp nhận ca mới hoặc Team Lead nắm ngữ cảnh mà không phải đọc lại toàn bộ chuỗi trao đổi.

### AI hỗ trợ theo từng role

Phần này mở rộng ba tác vụ AI chung trong báo cáo thành các trợ lý theo vai trò. Đây là đặc tả chức năng đề xuất để đưa vào sản phẩm; chưa khẳng định các màn hình/API bên dưới đã được triển khai.

#### Nguyên tắc phân quyền chung

- Backend xác định role từ phiên đăng nhập/JWT và kiểm tra quyền trên từng dữ liệu, tác vụ AI và thao tác ghi. Ẩn nút trên giao diện không thay thế kiểm tra quyền ở backend.
- Trợ lý chỉ nhận ngữ cảnh người dùng đó được phép xem. AI không được dùng dữ liệu của role khác để trả lời.
- Requester chỉ được hỏi về ticket của chính mình và nội dung FAQ đã phát hành; không gửi ghi chú nội bộ hoặc ticket của người khác vào ngữ cảnh.
- AI trả lời, phân tích hoặc đề xuất. Tạo/cập nhật ticket, gửi phản hồi, phân công, đổi SLA/danh mục và cập nhật cấu hình chỉ xảy ra sau khi người dùng có quyền xem lại và xác nhận.
- Áp dụng PII masking trước khi gửi ngữ cảnh ra dịch vụ AI. Không đưa mật khẩu, JWT, API key hoặc secret cấu hình vào prompt.
- Ghi nhận loại tác vụ AI, ticket liên quan nếu có, model/provider, thời gian, lỗi và hành động chấp nhận/chỉnh sửa/bỏ qua theo chính sách audit của hệ thống.

#### Requester / Customer — trợ lý tự phục vụ

**Mục tiêu:** giúp người dùng tự tìm hướng dẫn an toàn và gửi báo cáo sự cố đầy đủ hơn.

- Trả lời câu hỏi về cách sử dụng dịch vụ bằng các bài FAQ đã phát hành. Khi không tìm thấy tài liệu phù hợp, nói rõ chưa có hướng dẫn thay vì tự tạo chính sách hoặc khẳng định không có căn cứ.
- Hỏi tiếp để làm rõ các dữ kiện cần cho xử lý, chẳng hạn ứng dụng/thiết bị gặp lỗi, thông báo lỗi, thời điểm xảy ra và các bước người dùng đã thử.
- Tạo bản nháp ticket gồm tiêu đề, mô tả đã tóm tắt, thông tin cần bổ sung và danh mục/mức ưu tiên gợi ý.
- Cho requester xem và sửa bản nháp trước khi gửi. AI không tự gửi ticket, không tự đóng ticket và không tự thay requester cập nhật nội dung đã gửi.
- Giải thích trạng thái, bước tiếp theo và mốc SLA của ticket do chính requester tạo, dựa trên dữ liệu hiện có; không suy đoán thời điểm xử lý nếu hệ thống không có thông tin đó.

**Giới hạn dữ liệu:** không đọc hồ sơ/ticket của người khác, ghi chú nội bộ, trao đổi riêng giữa nhân viên hoặc dữ liệu phân tích toàn đội.

#### Support Agent — trợ lý xử lý ticket

**Mục tiêu:** giảm thời gian phân loại, tra cứu và soạn phản hồi nhưng để Agent chịu trách nhiệm về quyết định cuối cùng.

- Tóm tắt mô tả và lịch sử trao đổi của ticket mà Agent được phép truy cập.
- Đề xuất danh mục, P1–P4 và confidence score; hiển thị căn cứ/ngữ cảnh liên quan khi có thể.
- Tìm bài FAQ liên quan theo danh mục/từ khóa và đề xuất các bước xử lý dựa trên tài liệu đó.
- Soạn phản hồi nháp theo ngữ cảnh ticket, FAQ và lịch sử; tránh tự cam kết thời gian, bồi thường, hoàn tiền hoặc chính sách không có nguồn.
- Đánh dấu thông tin còn thiếu, dấu hiệu cảm xúc tiêu cực, khả năng vi phạm SLA hoặc trường hợp nên chuyển cấp.
- Cho Agent chấp nhận, chỉnh sửa hoặc bỏ bản nháp. Chỉ gửi bình luận khi Agent chủ động nhấn gửi; ghi lại trạng thái sử dụng AI theo quy định audit.

**Giới hạn dữ liệu:** chỉ dùng ticket thuộc phạm vi quyền của Agent; giữ riêng ghi chú nội bộ và nội dung hiển thị cho requester. Gợi ý AI không được tự đổi trạng thái, phân công hoặc gửi trả lời.

#### Team Lead / IT Manager — trợ lý điều phối

**Mục tiêu:** giúp quản lý nhận ra rủi ro và phân bổ công việc dựa trên dữ liệu đội mà họ được phép xem.

- Tạo bản tóm tắt hàng đợi: ticket mới, ticket đang chờ, ticket gần/quá hạn SLA và ticket đã được chuyển cấp.
- Giải thích các chỉ số tổng hợp như SLA compliance, MTTFR, MTTR và tỷ lệ dùng gợi ý AI trong khoảng thời gian được chọn.
- Nhóm các ticket có dấu hiệu cùng nguyên nhân hoặc cùng dịch vụ để Team Lead kiểm tra; đây là gợi ý, không tự gộp hay sửa ticket.
- Đề xuất thứ tự ưu tiên xử lý và Agent phù hợp dựa trên danh mục, mức ưu tiên, tải công việc và nhóm chuyên trách nếu các dữ liệu này có trong hệ thống.
- Tóm tắt ticket được chuyển cấp để quản lý nắm vấn đề, bước đã thử và quyết định cần đưa ra.
- Trình bày lý do và dữ liệu đầu vào cho từng đề xuất để Team Lead có thể kiểm tra.

**Giới hạn dữ liệu:** chỉ dùng dữ liệu thuộc phạm vi nhóm/quyền quản lý. AI không tự phân công, thay đổi priority/SLA, đóng ticket hoặc thay đổi nhân sự; Team Lead phải xác nhận thao tác bằng chức năng hiện có.

#### Admin — trợ lý quản trị tri thức và cấu hình

**Mục tiêu:** giúp Admin duy trì FAQ, danh mục và chính sách nhất quán, đồng thời đọc log vận hành thuận tiện hơn.

- Soạn nháp bài FAQ từ tài liệu được cung cấp, gợi ý tiêu đề, danh mục và từ khóa tìm kiếm.
- Rà soát bài FAQ để tìm nội dung trùng lặp, thiếu bước, lỗi thời hoặc mâu thuẫn với bài khác; đưa ra đề xuất sửa thay vì tự xuất bản.
- Tóm tắt log AI theo tác vụ, provider/model, độ trễ và nhóm lỗi; chỉ sử dụng dữ liệu đã được lọc và giới hạn theo quyền.
- Phân tích các nhóm ticket tổng hợp để gợi ý danh mục còn thiếu hoặc điểm cần xem lại trong SLA.
- Giải thích tác động dự kiến của thay đổi danh mục/SLA bằng dữ liệu tổng hợp, khi dữ liệu đó sẵn có.
- Mọi thay đổi FAQ, danh mục, SLA, prompt hay cấu hình đều ở trạng thái bản nháp cho tới khi Admin xem lại và xác nhận.

**Giới hạn dữ liệu:** AI không được đọc/xuất giá trị secret, API key, mật khẩu hoặc JWT; không tự thay đổi role/permission, khóa tài khoản, cấu hình provider, chính sách SLA hay prompt đang chạy.

#### Ma trận quyền AI

| Role          | Ngữ cảnh được phép                                    | AI có thể đề xuất                                                          | Người xác nhận                                            |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| Requester     | FAQ đã phát hành và ticket của chính requester        | Câu trả lời FAQ, câu hỏi làm rõ, bản nháp ticket, phân loại/ưu tiên gợi ý  | Requester xác nhận trước khi tạo ticket                   |
| Support Agent | Ticket và FAQ trong phạm vi được giao/quyền truy cập  | Tóm tắt, phân loại, bước xử lý, phản hồi nháp, cảnh báo/escalation         | Agent xác nhận trước khi sửa trạng thái hoặc gửi phản hồi |
| Team Lead     | Ticket, SLA và số liệu trong phạm vi đội được quản lý | Watchlist, tóm tắt hiệu suất, thứ tự ưu tiên, đề xuất phân công/chuyển cấp | Team Lead xác nhận mọi thay đổi nghiệp vụ                 |
| Admin         | FAQ, danh mục, SLA và audit log được phép quản trị    | Bản nháp FAQ, gợi ý cấu hình, phát hiện bất thường, tóm tắt log            | Admin xác nhận trước khi lưu/xuất bản cấu hình            |

### Human-in-the-loop

AI chỉ tạo kết quả hỗ trợ. Nhân viên là người quyết định nội dung cuối cùng. Hệ thống được mô tả là lưu hành động của Agent với gợi ý AI theo các nhóm: chấp nhận, chỉnh sửa hoặc loại bỏ.

### PII masking

Báo cáo mô tả bộ lọc Regex chạy trước khi dữ liệu nhạy cảm được lưu hoặc truyền đến AI. Các loại thông tin được nhắc đến gồm mật khẩu, OTP, số định danh cá nhân, token, số thẻ ngân hàng, email, số điện thoại và địa chỉ IP. Chuỗi phát hiện được thay bằng placeholder đã che, ví dụ [REDACTED_PASSWORD].

Regex có thể bỏ sót định dạng không chuẩn; vì vậy không nên xem đây là bảo đảm rằng mọi dữ liệu nhạy cảm đều đã được loại bỏ. Không đưa khóa thật, token thật hoặc dữ liệu khách hàng thật vào README, log mẫu hay ảnh minh chứng.

### Fallback khi AI lỗi

Báo cáo đề xuất để luồng Helpdesk tiếp tục hoạt động khi AI timeout, mất mạng, quá giới hạn hoặc trả JSON lỗi:

- Hoàn tất thao tác tạo ticket mà không phụ thuộc vào phản hồi AI.
- Gán danh mục fallback và mức ưu tiên P3/Medium.
- Đánh dấu ticket chưa được AI xử lý và lưu lỗi vào ai_logs.
- Hiển thị thông báo để nhân viên xử lý thủ công.
- Khi confidence thấp, tạo bản nháp yêu cầu requester bổ sung thông tin thay vì bịa hướng xử lý.

Tên danh mục fallback trong báo cáo chưa đồng nhất với năm danh mục chính; cần chốt giá trị thực tế trước khi triển khai.

### Nhà cung cấp AI

Báo cáo nêu Google Gemini là dịch vụ chính và có nhắc Groq/Cohere là dịch vụ dự phòng. Một số phần khác lại nhắc OpenAI. README này không giả định cấu hình provider đã thống nhất; cần kiểm tra mã nguồn và file cấu hình triển khai trước khi sử dụng.

## Dashboard, SLA và báo cáo

### Dashboard tổng quan

Dashboard cho Team Lead/Admin được mô tả với:

- Tổng số ticket.
- Số ticket đang mở/đang xử lý.
- Số ticket vi phạm SLA.
- Số ticket có AI can thiệp và confidence trung bình.
- Biểu đồ số lượng theo mức ưu tiên P1–P4.
- Biểu đồ phân bố ticket theo trạng thái.
- Danh sách ticket cần xử lý ngay/SLA Watchlist.
- Thông tin hoạt động AI.

### SLA

- Admin cấu hình thời gian phản hồi lần đầu và thời gian giải quyết theo mức ưu tiên.
- Ticket lưu hạn phản hồi và hạn giải quyết để backend/dashboard đối chiếu.
- Dashboard dùng màu để biểu diễn trạng thái SLA: xanh còn hạn, vàng sắp quá hạn, đỏ đã vi phạm.
- Khi chờ requester, báo cáo mô tả việc tạm dừng đồng hồ SLA.
- Quy tắc phân loại ưu tiên và thời lượng SLA cần được đối chiếu với chính sách thực tế của tổ chức.

### Báo cáo hiệu suất

Các chỉ số được nêu trong báo cáo gồm:

- Tổng số ticket trong khoảng thời gian chọn.
- Tỷ lệ tuân thủ SLA.
- MTTFR — thời gian phản hồi lần đầu trung bình.
- MTTR — thời gian giải quyết trung bình.
- Tỷ lệ ticket theo danh mục.
- Ticket sắp đến hạn hoặc đã vi phạm SLA.
- Tỷ lệ phân loại AI chính xác.
- Tỷ lệ Agent chấp nhận câu trả lời nháp AI.
- Xuất báo cáo thống kê ra Excel.

## Kiến trúc và công nghệ

| Thành phần                   | Công nghệ được nêu trong báo cáo                                |
| ---------------------------- | --------------------------------------------------------------- |
| Frontend                     | React, TypeScript, Vite, Tailwind CSS                           |
| Gọi API và quản lý dữ liệu   | Axios, TanStack Query                                           |
| Biểu đồ                      | Recharts                                                        |
| Backend                      | Python 3.11, FastAPI, Pydantic, SQLAlchemy, Uvicorn             |
| Cơ sở dữ liệu                | MySQL 8.0                                                       |
| Lưu trữ tạm/xác thực         | Redis                                                           |
| AI                           | Gemini; báo cáo còn nhắc Groq, Cohere và OpenAI ở các phần khác |
| Đóng gói                     | Docker Compose                                                  |
| Reverse proxy khi triển khai | Nginx trên Ubuntu Linux                                         |

Mô hình tổng thể tách giao diện web, backend/API, cơ sở dữ liệu, Redis và dịch vụ AI. Frontend gửi yêu cầu đến backend; backend kiểm tra quyền, xử lý nghiệp vụ, truy vấn MySQL/Redis và gọi AI khi cần.

## Mô hình dữ liệu

Báo cáo mô tả các bảng dữ liệu chính sau:

| Bảng           | Vai trò và dữ liệu tiêu biểu                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| roles          | Mã vai trò, tên vai trò và mô tả quyền.                                                                                              |
| users          | Vai trò, họ tên, email, mật khẩu đã băm, phòng ban, số điện thoại, trạng thái hoạt động và thời điểm tạo.                            |
| categories     | Tên/mã danh mục và mô tả dùng cho nghiệp vụ, phân loại AI.                                                                           |
| sla_policies   | Mức ưu tiên, thời gian phản hồi tối đa và thời gian giải quyết tối đa.                                                               |
| tickets        | Mã ticket, tiêu đề, mô tả, requester, Agent phụ trách, danh mục, mức ưu tiên, confidence, trạng thái, các mốc SLA và bản tóm tắt AI. |
| comments       | Nội dung trao đổi, người viết, ghi chú nội bộ, cờ AI-generated, cờ Agent đã chỉnh sửa và thời điểm gửi.                              |
| attachments    | Tên tệp, URL/đường dẫn, kích thước, ticket/bình luận liên quan và thời điểm tải lên.                                                 |
| knowledge_base | Bài viết FAQ, danh mục, nội dung, trạng thái phát hành và trường embedding tùy chọn.                                                 |
| ai_logs        | Loại tác vụ, tên model, token vào/ra, thời gian xử lý, PII được phát hiện, hành động Agent và lỗi.                                   |

Các quan hệ chính được mô tả: ticket liên kết với requester, Agent, danh mục và chính sách SLA; bình luận và tệp đính kèm thuộc ticket; bài FAQ thuộc danh mục; log AI có thể liên kết ticket.

## API chính

Các nhóm đường dẫn API được nêu trong báo cáo:

| Đường dẫn                                                    | Mục đích                                             |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| /api/v1/auth                                                 | Đăng nhập và xác thực.                               |
| /api/v1/tickets                                              | Tạo, liệt kê, lọc và xem ticket.                     |
| /api/v1/tickets/{ticket_id}/attachments                      | POST tải ảnh minh chứng; GET liệt kê ảnh của ticket. |
| /api/v1/tickets/{ticket_id}/attachments/{attachment_id}/file | Tải/xem ảnh qua API đã xác thực.                     |
| /api/v1/tickets/{ticket_id}/classify                         | Yêu cầu AI phân loại ticket.                         |
| /api/v1/tickets/{ticket_id}/suggest-reply                    | Tạo câu trả lời nháp cho Agent kiểm duyệt.           |
| /api/v1/tickets/{ticket_id}/summarize                        | Tóm tắt lịch sử trao đổi.                            |
| /api/v1/dashboard                                            | Dữ liệu Dashboard.                                   |
| /api/v1/reports                                              | Dữ liệu thống kê/báo cáo.                            |

Danh sách ticket hỗ trợ lọc theo trạng thái, danh mục, mức ưu tiên và người phụ trách. Requester bị giới hạn vào ticket do mình tạo; nhân viên truy cập theo quyền.

Tài liệu API được mô tả là sinh theo OpenAPI/Swagger. Báo cáo nêu cả đường dẫn /docs và /api/v1/docs ở các phần khác nhau; cần xác nhận đường dẫn thực tế trong backend.

## Cài đặt và chạy

Báo cáo đưa ra quy trình chạy môi trường local bằng Docker Compose. Các bước dưới đây cần được đối chiếu với repository thực tế trước khi dùng vì báo cáo chưa cung cấp URL repository thật và còn để trống ảnh minh chứng cài đặt.

### Yêu cầu

- Docker và Docker Compose.
- Git.
- Các khóa/dịch vụ bên ngoài cần thiết nếu bật AI.
- Tệp môi trường local có thông tin kết nối cơ sở dữ liệu, Redis, JWT và AI provider.

### Các bước theo báo cáo

1. Clone repository của dự án.
2. Tạo file môi trường từ mẫu cấu hình và điền giá trị local.
3. Khởi động các dịch vụ bằng lệnh:

   docker-compose up --build -d

4. Chạy migration:

   alembic upgrade head

5. Tạo tài khoản quản trị và dữ liệu danh mục mẫu:

   python scripts/seed_data.py

6. Mở giao diện tại http://localhost:5173.
7. Mở tài liệu API tại http://localhost:8000/docs nếu backend đang expose đường dẫn như báo cáo mô tả.

Không commit file .env chứa secret. Chỉ dùng giá trị giả trong .env.example; cung cấp khóa thật qua secret store hoặc biến môi trường của máy triển khai.

### Biến môi trường được báo cáo liệt kê

| Tên                       | Mục đích                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| DATABASE_URL              | Chuỗi kết nối MySQL.                                                 |
| REDIS_URL                 | Chuỗi kết nối Redis.                                                 |
| JWT_SECRET_KEY            | Khóa ký JWT; phải thay bằng giá trị ngẫu nhiên riêng của môi trường. |
| GEMINI_API_KEY            | Khóa gọi dịch vụ Gemini nếu cấu hình Gemini.                         |
| PII_MASKING_ENABLED       | Bật/tắt bước lọc PII.                                                |
| DEFAULT_FALLBACK_CATEGORY | Danh mục dùng khi AI lỗi; cần thống nhất với taxonomy thực tế.       |
| DEFAULT_FALLBACK_PRIORITY | Ưu tiên mặc định khi AI lỗi; báo cáo nêu MEDIUM_P3.                  |

Không sử dụng secret hiển thị trong báo cáo làm cấu hình. Mọi giá trị ở README chỉ mô tả tên biến, không chứa khóa truy cập.

### Triển khai cloud được mô tả

Báo cáo mô tả ứng dụng đóng gói bằng Docker Compose, chạy trên Ubuntu Linux, dùng Nginx làm reverse proxy, MySQL 8.0 và biến môi trường để quản lý khóa. Trước khi đưa vào sử dụng thực tế cần xác minh HTTPS, firewall, backup/restore, logging, quyền truy cập máy chủ, secret management và giám sát vận hành.

## Kiểm thử

Báo cáo đưa ra các nhóm kịch bản sau:

| Mã        | Kịch bản                                                     | Kết quả mong đợi                                                           |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| TC_BIZ_01 | Requester tạo ticket hợp lệ.                                 | Ticket được lưu với trạng thái mới và trả thông báo thành công.            |
| TC_BIZ_02 | Agent gọi API phân công không đủ quyền.                      | API từ chối với HTTP 403.                                                  |
| TC_BIZ_03 | Agent gửi yêu cầu bổ sung thông tin.                         | Ticket chuyển sang trạng thái chờ requester.                               |
| TC_BIZ_04 | Ticket P1 vượt thời hạn SLA.                                 | Dashboard đánh dấu vi phạm SLA.                                            |
| TC_AI_01  | Mô tả ticket mơ hồ/thiếu dữ liệu.                            | Confidence thấp; AI hỏi thêm chi tiết, không bịa cách khắc phục.           |
| TC_AI_02  | Requester có cảm xúc tiêu cực.                               | AI giữ giọng lịch sự; mức ưu tiên được đánh giá theo quy tắc đã cấu hình.  |
| TC_AI_03  | Requester yêu cầu một cam kết không có trong FAQ/chính sách. | AI không tự hứa bồi thường hoặc đổi thiết bị.                              |
| TC_AI_04  | AI timeout, lỗi JSON hoặc không kết nối được.                | Backend không sập; luồng tạo ticket tiếp tục với fallback và ghi nhận lỗi. |

Các trường hợp trên là kịch bản kiểm thử được mô tả trong báo cáo, không tự thân chứng minh rằng toàn bộ kiểm thử đã được chạy. Báo cáo còn để chỗ trống yêu cầu chèn ảnh/log minh chứng và phụ lục AI tự ghi là các dòng mẫu. Cần đính kèm kết quả chạy thật trước khi công bố trạng thái PASS.

### Kiểm thử ảnh minh chứng

| Kịch bản                                               | Kết quả mong đợi                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| Requester tạo ticket kèm ảnh PNG/JPG/WEBP hợp lệ       | Ticket được tạo, ảnh được lưu và hiển thị trong chi tiết ticket.    |
| Tải tệp sai định dạng hoặc giả MIME bằng cách đổi đuôi | Backend từ chối tệp; không tạo metadata hoặc file lưu trữ.          |
| Tải ảnh lớn hơn 10 MB hoặc vượt quá 5 ảnh/ticket       | Backend trả lỗi có thể đọc được; UI cho phép bỏ ảnh lỗi và thử lại. |
| Requester truy cập ảnh của ticket người khác           | API từ chối với 403; không trả nội dung ảnh.                        |
| Tạo lại backend container                              | Ảnh đã tải vẫn còn trong named volume uploads_data.                 |

Các kịch bản ảnh minh chứng mô tả tiêu chí cần xác minh; chỉ ghi nhận PASS sau khi chạy với ứng dụng thực tế.

### Kiểm thử phân quyền AI theo role

Các kịch bản dưới đây bổ sung cho test case nghiệp vụ/AI ở trên. Kết quả cần xác minh cả giao diện lẫn API backend:

| Role          | Kịch bản                                                 | Kết quả mong đợi                                                                   |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Requester     | Hỏi AI về ticket của người dùng khác hoặc ghi chú nội bộ | Bị từ chối; nội dung trái quyền không được đưa vào prompt hoặc trả về.             |
| Requester     | Yêu cầu AI soạn ticket từ mô tả thiếu thông tin          | AI hỏi thêm dữ kiện; chỉ tạo ticket sau khi requester xem và xác nhận bản nháp.    |
| Support Agent | Yêu cầu trợ lý trên ticket ngoài phạm vi được phép       | Backend từ chối; dữ liệu ticket không rò vào nội dung AI/log phản hồi.             |
| Support Agent | Chấp nhận bản nháp AI nhưng chưa nhấn gửi                | Chỉ nội dung trong khung soạn thảo thay đổi; chưa gửi bình luận cho requester.     |
| Team Lead     | Yêu cầu tóm tắt số liệu ngoài phạm vi đội được quản lý   | Backend giới hạn hoặc từ chối truy vấn; không tiết lộ dữ liệu của đội khác.        |
| Team Lead     | Nhận đề xuất phân công hoặc đổi ưu tiên                  | Ticket không thay đổi cho đến khi Team Lead xác nhận qua chức năng được cấp quyền. |
| Admin         | Yêu cầu AI đọc API key/JWT hoặc secret cấu hình          | Secret không được đưa vào prompt, câu trả lời hoặc log.                            |
| Admin         | AI đề xuất sửa hoặc xuất bản FAQ/SLA                     | Thay đổi chỉ được lưu sau khi Admin xem lại và xác nhận.                           |

Các test này là tiêu chí nghiệm thu cho phần mở rộng role-based AI; cần chạy và lưu kết quả thật trước khi ghi nhận PASS.

### Mục tiêu chất lượng được nêu

- API thao tác dữ liệu cơ bản: không quá 500 ms.
- Tác vụ AI: mục tiêu không quá 3.5 giây.
- Fallback: kích hoạt trong dưới 4 giây.
- Uptime mục tiêu: ít nhất 99.5%.
- PII chuẩn: mục tiêu lọc đủ 100%.
- Requester không đọc/sửa ticket của người khác.
- Ghi log đầy đủ các giao dịch AI.

Đây là các chỉ tiêu thiết kế trong báo cáo; cần có kết quả đo thực tế để xác nhận. Báo cáo nêu chưa thực hiện kiểm thử tải/stress ở quy mô lớn.

## Giới hạn và hướng phát triển

### Giới hạn được báo cáo nêu

- Chất lượng gợi ý phụ thuộc vào độ đầy đủ/chính xác của FAQ.
- AI có thể không đưa ra hướng xử lý cụ thể khi nội dung vượt phạm vi tài liệu.
- Độ trễ và tính sẵn sàng phụ thuộc nhà cung cấp AI bên ngoài.
- Fallback chưa được kiểm thử với chuỗi lỗi kéo dài liên tục.
- PII masking dựa trên Regex có thể bỏ sót dữ liệu không theo mẫu.
- Chưa kiểm thử chịu tải quy mô lớn.

### Hướng phát triển

- Mở rộng FAQ và thêm xếp hạng lại tài liệu để tăng độ liên quan.
- Đo mức độ hài lòng CSAT sau khi đóng ticket.
- Gửi thông báo Slack khi ticket được phân công hoặc gần vi phạm SLA.
- Phát triển giao diện di động cho Agent.
- Tối ưu prompt/model theo từng ngành và đo độ chính xác có hệ thống.

## Các điểm cần xác nhận

Trước khi dùng README làm tài liệu kỹ thuật chính thức, cần đối chiếu báo cáo với source code và môi trường triển khai:

1. **Danh mục AI:** phần nghiệp vụ mô tả 5 nhóm, nhưng prompt mẫu lại liệt kê 4 nhóm cũ (Phần cứng, Phần mềm, Mạng, Tài khoản). Chốt một taxonomy và cập nhật prompt, dữ liệu mẫu, dashboard và fallback.
2. **Tên trạng thái:** báo cáo dùng cả NEW/PROCESSING/WAITING_CUSTOMER/RESOLVED/CLOSED và các nhãn Assigned, In Progress, Waiting for Customer. Đồng bộ enum, API và UI.
3. **Ngưỡng confidence:** có chỗ dùng dưới 0.4, có chỗ dùng dưới 50%. Chốt một ngưỡng.
4. **Provider/model AI:** thống nhất Gemini, Groq/Cohere hay OpenAI; ghi đúng provider/model đang được triển khai.
5. **RAG:** báo cáo nói có RAG nhưng mô tả phiên bản hiện tại tra cứu MySQL theo từ khóa/danh mục; không mô tả vector search như tính năng đã hoạt động nếu chưa triển khai.
6. **Fallback category:** thống nhất giữa nhãn General Inquiry, Uncategorized và danh mục “Chưa phân loại”.
7. **Thời gian SLA/AI:** mục tiêu AI ≤3.5 giây và timeout/fallback 4 giây cần được kiểm tra cùng cơ chế retry thực tế.
8. **API docs:** xác nhận endpoint tài liệu là /docs hay /api/v1/docs.
9. **Phân công và thông báo:** xác nhận tính năng auto-assign, email thông báo, gửi email xác nhận và xuất Excel có trong bản chạy hiện tại hay mới là thiết kế.
10. **Bằng chứng kiểm thử/triển khai:** bổ sung ảnh, log và kết quả đo thật; không coi placeholder trong báo cáo là minh chứng.
11. **Secret:** rà soát và xóa mọi khóa/secret khỏi báo cáo, README, ảnh chụp và lịch sử commit; thay khóa nếu giá trị đã từng được sử dụng.
