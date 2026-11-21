# Deploy EnQuiz (giai đoạn 4.0, phương án B)

Frontend trên **Firebase Hosting**, backend trên **Google Cloud Run**, DB trên **MongoDB Atlas**, ảnh và âm thanh trên **Cloud Storage**. Firebase Hosting chuyển `/api/**` sang Cloud Run ([fe/firebase.json](../fe/firebase.json)), nên frontend và API dùng chung một domain. Riêng socket Đấu trường đi thẳng tới Cloud Run (D19).

```
Trình duyệt ──► https://<SITE>.web.app
                  ├─ /api/**  ──► Cloud Run "enquiz-api" (asia-southeast1) ──► MongoDB Atlas
                  └─ còn lại  ──► fe/dist (SPA)                               └─► Cloud Storage (ảnh, âm thanh)
Trình duyệt ──► wss://enquiz-api-….run.app/live  (Đấu trường)
```

Các lệnh viết cho bash (Git Bash hoặc Cloud Shell), chạy từ thư mục gốc repo.

**Git Bash trên Windows** tự đổi tham số bắt đầu bằng `/` thành đường dẫn Windows (`/api/v1/health` thành `/C:/Program Files/Git/api/v1/health`) mà không báo lỗi. Với tham số như vậy, chặn việc đổi cho riêng tham số đó: `MSYS2_ARG_CONV_EXCL="--path=" gcloud …`. Đừng dùng `MSYS_NO_PATHCONV=1`, vì nó làm hỏng chính đường dẫn để chạy `gcloud`.

**Không có khoá dài hạn nào.** Cloud Run chạy bằng tài khoản dịch vụ `enquiz-api` và ghi vào bucket bằng chính danh tính đó (`STORAGE_DRIVER=gcs`, D18). Tổ chức Google Cloud mới mặc định chặn tạo khoá cho tài khoản dịch vụ (`iam.disableServiceAccountKeyCreation`), nên cách dùng khoá HMAC với `STORAGE_DRIVER=s3` không chạy được ở đây. Các secret còn lại (JWT, chuỗi kết nối Mongo, khoá TTS) nằm trong Secret Manager.

## 0. Chuẩn bị

- Tài khoản Google Cloud **có gắn thanh toán** (Cloud Run có hạn mức miễn phí, nhưng vẫn bắt buộc gắn thẻ).
- Đã cài [gcloud CLI](https://cloud.google.com/sdk/docs/install) và Firebase CLI (`npm i -g firebase-tools`), đã chạy `gcloud auth login` và `firebase login`.
- Tài khoản [MongoDB Atlas](https://www.mongodb.com/atlas).

```bash
# Giá trị thật chỉ đặt trong terminal của bạn, không ghi vào repo (repo public).
PROJECT_ID=<project-id>                     # ID project GCP (không phải tên hiển thị)
SITE=<site-id>                              # site Firebase Hosting: https://$SITE.web.app
REGION=asia-southeast1                      # Singapore, gần Việt Nam nhất
BUCKET=<bucket-name>                        # tên bucket là duy nhất trên toàn Google Cloud
REPO=$REGION-docker.pkg.dev/$PROJECT_ID/enquiz
RUN_SA=enquiz-api@$PROJECT_ID.iam.gserviceaccount.com   # tài khoản chạy Cloud Run

gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com texttospeech.googleapis.com \
  apikeys.googleapis.com
gcloud artifacts repositories create enquiz --repository-format=docker --location=$REGION
gcloud iam service-accounts create enquiz-api --display-name="EnQuiz API (Cloud Run)"
# Cloud Build chạy bằng tài khoản Compute mặc định; tổ chức mới không tự cấp quyền
# cho nó, nên `gcloud builds submit` báo 403 nếu thiếu dòng này
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT_ID   --member=serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com   --role=roles/cloudbuild.builds.builder

firebase projects:addfirebase $PROJECT_ID     # gắn Firebase vào project (một lần)
firebase hosting:sites:create $SITE --project $PROJECT_ID
```

API vừa bật có thể mất vài phút mới dùng được; lệnh tạo kho báo `SERVICE_DISABLED` thì chạy lại sau ít phút.

## 1. MongoDB Atlas

1. Tạo cluster riêng cho production (M0 miễn phí để thử), region Singapore nếu có.
2. **Database Access:** tạo user riêng cho ứng dụng, mật khẩu dài và ngẫu nhiên (nút *Autogenerate*).
3. **Network Access:** thêm `0.0.0.0/0`, vì Cloud Run không có IP ra cố định. Khi đó chỉ còn mật khẩu DB bảo vệ, nên mật khẩu phải dài và ngẫu nhiên.
4. Lấy chuỗi kết nối và thêm tên DB, ví dụ `mongodb+srv://enquiz:<pass>@cluster0.xxxx.mongodb.net/enquiz?retryWrites=true&w=majority`. Chuỗi Atlas đưa ra không có tên DB (`.net/?retry…`); thiếu nó thì dữ liệu nằm trong DB tên `test`.
5. Cất chuỗi này vào Secret Manager **mà không dán vào chat hay file**: Console → Security → Secret Manager → *Create secret*, tên `mongodb-uri`, dán chuỗi vào ô *Secret value*. Hoặc trong terminal của bạn:
   ```bash
   read -rs MONGO && printf '%s' "$MONGO" | gcloud secrets create mongodb-uri --data-file=- && unset MONGO
   ```
6. **Backup:** M0 không có backup tự động. Hoặc nâng gói, hoặc chạy `mongodump` định kỳ.

Nạp kho câu hỏi và tạo admin đầu tiên **từ máy local** (cả hai lệnh đều chạy lại an toàn). Hai lệnh này luôn tắt dữ liệu demo (`src/cli/cli-env.ts`), dù `be/.env` trên máy đặt `SEED_DEMO_DATA=true`: trước bản sửa, chạy vào DB trống sẽ tạo luôn tài khoản demo có mật khẩu công khai (`admin`/`admin123`) và quiz demo. Máy local để `TTS_DRIVER` mặc định (`none`), nên câu nghe được nạp **chưa có âm thanh**; sau khi deploy, admin bấm "Tạo âm thanh" (bước 6 của mục kiểm tra).

```bash
cd be
export MONGODB_URI=$(gcloud secrets versions access latest --secret=mongodb-uri)
export JWT_SECRET=local-cli-only-0123456789      # CLI chỉ cần một giá trị hợp lệ
npm run seed:content
# Tự đặt mật khẩu (gõ ẩn, ≥ 12 ký tự); bỏ dòng này thì máy sinh ngẫu nhiên và in ra MỘT lần
read -rsp "Mật khẩu admin: " ADMIN_PASSWORD && echo && export ADMIN_PASSWORD
# Tránh username dễ đoán như "admin"
npm run create:admin -- <username> "<Họ tên>"
unset ADMIN_PASSWORD
unset MONGODB_URI JWT_SECRET
cd ..
```

## 2. Cloud Storage cho ảnh và âm thanh

```bash
gcloud storage buckets create gs://$BUCKET --location=$REGION --uniform-bucket-level-access
# Ảnh (images/) và âm thanh câu nghe (audio/) là công khai: học sinh tải trực tiếp
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=allUsers --role=roles/storage.objectViewer
# Chỉ tài khoản chạy Cloud Run được ghi
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$RUN_SA --role=roles/storage.objectAdmin
```

Nếu tổ chức chặn `allUsers` (Public Access Prevention), ảnh và âm thanh sẽ không tải được. Khi đó cần tắt chính sách này cho riêng bucket.

**CORS cho cache của app (6.3):** service worker chỉ cache ảnh/âm thanh khi bucket trả header CORS (response "opaque" chiếm hàng MB quota mỗi file trong Chrome). Thiếu CORS thì file vẫn tải bình thường, chỉ không được cache. Bật một lần:
```bash
cat > cors.json <<'EOF'
[{"origin": ["*"], "method": ["GET", "HEAD"], "responseHeader": ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"], "maxAgeSeconds": 3600}]
EOF
gcloud storage buckets update gs://$BUCKET --cors-file=cors.json
```
`"*"` là đủ an toàn: bucket vốn đã công khai, và app gửi request không kèm cookie.

## 3. Secret Manager

```bash
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create jwt-secret --data-file=-

# Khoá Text-to-Speech (D16), chỉ được gọi Text-to-Speech API; khoá đi thẳng vào Secret Manager
gcloud services api-keys create --display-name="EnQuiz TTS" \
  --api-target=service=texttospeech.googleapis.com --format=none
TTS_KEY=$(gcloud services api-keys list --filter="displayName='EnQuiz TTS'" --format='value(name)')
gcloud services api-keys get-key-string $TTS_KEY --format='value(keyString)' | tr -d '\r\n' \
  | gcloud secrets create tts-api-key --data-file=-

# mongodb-uri đã tạo ở bước 1. Chỉ enquiz-api được đọc ba secret này
for s in jwt-secret mongodb-uri tts-api-key; do
  gcloud secrets add-iam-policy-binding $s --member=serviceAccount:$RUN_SA \
    --role=roles/secretmanager.secretAccessor
done
```

`JWT_SECRET` của production phải **khác** giá trị dùng khi dev.

## 4. Backend lên Cloud Run

> Chỉ dùng cho **lần dựng hạ tầng đầu tiên**. Các lần sau: [Phát hành theo phiên bản](#phát-hành-theo-phiên-bản), có bước chủ dự án xác nhận.

```bash
TAG=$(git rev-parse --short HEAD)
# be/.gcloudignore ngăn tải .env và node_modules lên Cloud Build
gcloud builds submit be --tag $REPO/api:$TAG

gcloud run deploy enquiz-api --image=$REPO/api:$TAG --region=$REGION \
  --service-account=$RUN_SA --allow-unauthenticated \
  --min-instances=0 --max-instances=1 --concurrency=500 --memory=512Mi \
  --session-affinity --timeout=3600 \
  --set-env-vars="^;^SEED_DEMO_DATA=false;TRUST_PROXY=2;LIVE_TRUST_PROXY=1;CORS_ORIGIN=https://$SITE.web.app;LIVE_CORS_ORIGINS=https://$SITE.web.app,https://$SITE.firebaseapp.com;STORAGE_DRIVER=gcs;GCS_BUCKET=$BUCKET;TTS_DRIVER=google;TTS_LANGUAGE=en-GB" \
  --set-secrets=JWT_SECRET=jwt-secret:latest,MONGODB_URI=mongodb-uri:latest,GOOGLE_TTS_API_KEY=tts-api-key:latest
```

Giải thích các tham số chính:

- **`--service-account`:** Cloud Run chạy bằng `enquiz-api`, chỉ có quyền ghi bucket và đọc ba secret, không dùng tài khoản mặc định có quyền Editor cả project.
- **`^;^` trong `--set-env-vars`:** đổi dấu tách thành `;`, để `LIVE_CORS_ORIGINS` chứa được dấu phẩy.
- **`TRUST_PROXY=2`, `LIVE_TRUST_PROXY=1`:** HTTP đi qua hai proxy (Firebase Hosting rồi Cloud Run), còn socket Đấu trường đi thẳng vào Cloud Run (một proxy). Tin nhiều proxy hơn thực tế thì client giả được IP bằng header `X-Forwarded-For`, và lách được giới hạn theo IP. Đã đo trên hạ tầng thật: với 1 thì HTTP thấy IP của Google; với 2 thì đúng IP thật. Ai gọi thẳng `run.app` vẫn giả được IP cho HTTP; giới hạn theo username (D14) vẫn chặn dò mật khẩu.
- **`--max-instances=1`:** giới hạn đăng nhập và phòng Đấu trường nằm trong RAM của từng instance. Nếu chạy nhiều instance thì cần chuyển sang Redis.
- **`--concurrency=500`:** số request một máy nhận cùng lúc (mặc định 80). Mỗi WebSocket đang mở tính là một request, và chỉ có một máy, nên với 80 thì một phòng 60 em cộng màn chiếu và các request REST bị Cloud Run trả **429** (đã gặp khi thử tải). Node giữ hàng trăm socket rảnh được; thông số này không tốn thêm tiền.
- **Chế độ tiết kiệm (mặc định, dùng cả cho Đấu trường):** `--min-instances=0` và CPU chỉ cấp khi có request. Không có ai dùng thì máy tắt, không tốn tiền. Kết nối WebSocket đang mở là một request, nên trong trận CPU luôn được cấp và đồng hồ câu hỏi chạy bình thường. Đã thử trên hạ tầng thật: phòng 60 học sinh chạy trọn (bước 8). Rủi ro còn lại:
  - người đầu tiên vào sau lúc rảnh chờ máy khởi động vài giây;
  - phòng nằm trong RAM: nếu **mọi** kết nối đều đứt và máy rảnh đủ lâu để bị tắt, phòng mất.
- **Luôn bật một máy (tuỳ chọn, D19 ban đầu):** chỉ cần nếu chế độ tiết kiệm gây lỗi khi lớp chơi thật. Tính phí theo từng giây máy chạy, kể cả lúc không ai dùng (khoảng 0,07 USD/giờ, kiểm tra bảng giá); quên tắt cả tháng là hàng chục USD.
  ```bash
  # Bật trước giờ học
  gcloud run services update enquiz-api --region=$REGION --min-instances=1 --no-cpu-throttling
  # Tắt ngay sau giờ học
  gcloud run services update enquiz-api --region=$REGION --min-instances=0 --cpu-throttling
  ```
  - `--session-affinity`: khi mạng trường chặn WebSocket và client lùi về long-polling, các request của một người vẫn tới cùng máy.
  - `--timeout=3600`: một kết nối WebSocket sống tối đa 60 phút; client tự nối lại.
  - `LIVE_CORS_ORIGINS`: origin được mở socket thẳng tới Cloud Run (Firebase Hosting không chuyển tiếp WebSocket).
- **Probe khởi động:** dùng probe TCP mặc định là đủ. NestJS chỉ mở cổng sau khi đã kết nối xong MongoDB.
- **Sự kiện chạy nền:** việc thêm/gỡ học sinh khỏi bài tập đã được chạy và chờ xong ngay trong request (D13), nên chạy đúng cả khi CPU chỉ cấp trong request.

## 5. Frontend lên Firebase Hosting

> Chỉ dùng cho **lần dựng hạ tầng đầu tiên**. Các lần sau: [Phát hành theo phiên bản](#phát-hành-theo-phiên-bản), có bước chủ dự án xác nhận.

`fe/firebase.json` deploy tới target `app`. Target này được gắn với site thật trong `fe/.firebaserc`; file đó **không commit** (đã `.gitignore`), vì chứa ID project.

```bash
cd fe
firebase use --add $PROJECT_ID              # tạo .firebaserc (một lần trên mỗi máy)
firebase target:apply hosting app $SITE     # gắn target "app" với site (một lần)
# VITE_API_BASE_URL giữ mặc định /api/v1 (đi qua rewrite của Firebase).
# Socket Đấu trường đi thẳng tới Cloud Run (D19):
export VITE_LIVE_URL=$(gcloud run services describe enquiz-api --region=$REGION --format='value(status.url)')
# Địa chỉ site cho link chia sẻ (Open Graph) và sitemap.xml
export VITE_SITE_URL=https://$SITE.web.app
npm ci && npm run build
firebase deploy --only hosting
cd ..
```

`serviceId` và `region` trong `fe/firebase.json` phải khớp với service Cloud Run (`enquiz-api`, `asia-southeast1`).

## 6. Kiểm tra sau khi deploy

1. Mở `https://$SITE.web.app/api/v1/health`. Kết quả phải là `{"status":"ok","clientIp":"…"}`.
2. **So `clientIp` với IP thật của bạn** (ví dụ xem ở https://ifconfig.me).
   - Nếu `clientIp` là IP của Google, tăng `TRUST_PROXY` thêm 1 (`gcloud run services update enquiz-api --region=$REGION --update-env-vars=TRUST_PROXY=3`), rồi kiểm tra lại.
   - Nếu để sai, mọi người sẽ dùng chung một bộ đếm giới hạn đăng nhập.
   - Mạng có nhiều IP ra ngoài (trường, công ty) thì `ifconfig.me` có thể hiện IP khác giữa các lần; chỉ cần `clientIp` là một trong các IP đó.
3. Đăng nhập bằng admin ở bước 1. Đăng ký thử một giáo viên, rồi duyệt tài khoản đó.
4. Giáo viên upload một ảnh câu hỏi. Ảnh phải có URL `https://storage.googleapis.com/<bucket>/images/…` và hiển thị được. Nếu lỗi, xem log:
   ```bash
   gcloud run services logs read enquiz-api --region=$REGION --limit=50
   ```
5. Xuất thử bảng điểm Excel và PDF, kiểm tra tiếng Việt có dấu hiển thị đúng.
6. **Âm thanh câu nghe:** admin vào Kho câu hỏi, bấm **🔊 Tạo âm thanh** cho tới khi thanh báo biến mất. Mở một trạm có câu nghe bằng tài khoản học sinh: nút 🔊 phát được, và dữ liệu `/play` (tab Network) **không có** chữ của câu đọc. Nếu báo lỗi, xem log Cloud Run: thường là khoá chưa được phép gọi Text-to-Speech API.
7. Đăng nhập thử **11 lần sai** với cùng một username. Lần thứ 11 phải bị chặn (429). Đăng nhập bằng username khác thì vẫn bình thường.
8. **Socket Đấu trường (5.0):** chạy từ máy local, trong thư mục `be/` (chế độ tiết kiệm là đủ):
   ```bash
   RUN_URL=$(gcloud run services describe enquiz-api --region=$REGION --format='value(status.url)')
   # Ẩn danh, 60 kết nối cùng lúc: phải "connected 60/60", transport websocket
   node scripts/live-check.mjs --url $RUN_URL --clients 60 --origin https://$SITE.web.app
   # Bằng tài khoản học sinh: "server sees" có role student, clientIp là IP thật của bạn
   LIVE_TOKEN=<accessToken lấy từ /auth/login> node scripts/live-check.mjs --url $RUN_URL
   # Giữ 65 phút: mỗi kết nối bị Cloud Run cắt một lần ở phút 60 rồi tự nối lại
   node scripts/live-check.mjs --url $RUN_URL --hold 65
   ```
   - `clientIp` khác IP thật thì chỉnh `LIVE_TRUST_PROXY` (socket đi thẳng vào Cloud Run, thường là 1).
   - Trình duyệt báo lỗi CORS khi mở socket: kiểm tra `LIVE_CORS_ORIGINS` có đúng domain đang mở trang không.
   - Thử tải một phòng 60 học sinh: `node scripts/live-load.mjs --url $RUN_URL --players 60 --teacher <giáo viên>:<mật khẩu>`. `--url` phải là địa chỉ Cloud Run (script dùng một địa chỉ cho cả REST và socket; Firebase không chuyển tiếp WebSocket). Script tạo một lớp "Tải thử …" với 60 tài khoản: chạy trước khi có dữ liệu thật, rồi xoá lớp và tài khoản đó.
   - Kết quả lần đầu (2026-11-21, từ Việt Nam): 60/60 kết nối, nhận trả lời median ~80 ms; phòng 60 em: câu hỏi tới đủ 60 máy sau 86–114 ms, nhận câu trả lời median ~72 ms, 60/60 máy tới bục vinh quang.
9. **Header bảo mật và SEO** ([launch-checklist.md](launch-checklist.md) A6, B3):
   ```bash
   curl -sI https://$SITE.web.app/login | grep -iE 'content-security-policy|x-frame-options|strict-transport'
   curl -s https://$SITE.web.app/robots.txt
   curl -s https://$SITE.web.app/sitemap.xml
   ```
   Mở site bằng Chrome, F12 → Console: không có dòng `Refused to … Content Security Policy`. Dán link site vào Zalo hoặc Messenger: thấy ảnh và mô tả EnQuiz.

## Giữ chi phí bằng 0 (hạn mức miễn phí)

Với lượng dùng thử nghiệm, mọi dịch vụ nằm trong hạn mức miễn phí, **miễn là**:

- Cloud Run ở chế độ tiết kiệm (`--min-instances=0`, CPU chỉ cấp khi có request); Đấu trường chạy được ở chế độ này. "Luôn bật một máy" (mục 4) tính phí theo giờ: chỉ dùng khi thật cần, xong tắt ngay.
- Không bật Cloud Armor, load balancer, IP tĩnh hay domain trả phí.

Ngân sách trên Google Cloud **chỉ gửi email**, không tự chặn chi phí. Đặt cảnh báo ở mức thấp, chỉ cho project này (đơn vị tiền phải trùng với tài khoản thanh toán, ví dụ `VND`):

```bash
BILLING=$(gcloud billing projects describe $PROJECT_ID --format='value(billingAccountName)' | sed 's#billingAccounts/##')
gcloud services enable billingbudgets.googleapis.com
gcloud billing budgets create --billing-account=$BILLING --display-name="EnQuiz - canh bao chi phi"   --budget-amount=25000VND --filter-projects=projects/$PROJECT_ID   --threshold-rule=percent=0.01 --threshold-rule=percent=0.5 --threshold-rule=percent=1.0   --threshold-rule=percent=1.0,basis=forecasted-spend
```

Tự dọn những thứ tăng dần theo thời gian:

```bash
# Kho image: giữ 3 bản mới nhất, xoá bản cũ hơn 7 ngày (hạn mức miễn phí 0,5 GB)
cat > /tmp/ar-cleanup.json <<'JSON'
[
  {"name": "keep-latest-3", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 3}},
  {"name": "delete-older", "action": {"type": "Delete"}, "condition": {"olderThan": "604800s"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies enquiz --location=$REGION --policy=/tmp/ar-cleanup.json --no-dry-run
# File nguồn Cloud Build tải lên: xoá sau 7 ngày
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":7}}]}' > /tmp/lifecycle.json
gcloud storage buckets update gs://${PROJECT_ID}_cloudbuild --lifecycle-file=/tmp/lifecycle.json
```

Những khoản có thể phát sinh vài đồng dù dùng ít:

- Bucket ảnh và âm thanh ở `asia-southeast1`: hạn mức lưu trữ miễn phí của Cloud Storage chỉ áp dụng cho vài region ở Mỹ. Ảnh đã được thu nhỏ trước khi upload (B2), nên vài trăm ảnh vẫn dưới 100 MB, tức dưới 0,01 USD/tháng.
- Lưu lượng tải ảnh, âm thanh từ bucket về Việt Nam khi có nhiều học sinh dùng.
- Text-to-Speech: miễn phí 4 triệu ký tự/tháng (giọng Standard). Âm thanh được tạo một lần rồi lưu lại.

Mỗi tháng xem Billing → Reports, lọc theo project, để chắc vẫn bằng 0.

## Phát hành theo phiên bản

Quyết định D21 ([phase-6-plan.md](phase-6-plan.md)). Mỗi lần đưa code mới lên production là **một phiên bản**: số trong file `VERSION` (SemVer), mục tương ứng trong `CHANGELOG.md`, git tag `vX.Y.Z`, image `api:X.Y.Z`, Cloud Run revision tag `vX-Y-Z` và kênh xem trước Firebase `vX-Y-Z`. **Mọi lần phát hành phải được chủ dự án xác nhận** trước khi nhận traffic.

Chuẩn bị một lần trên máy phát hành: `cp .env.release.example .env.release` rồi điền giá trị thật (file này không commit).

1. **Chuẩn bị phiên bản** (PR như mọi thay đổi khác): tăng `VERSION`, thêm mục `## [X.Y.Z] – <ngày>` vào `CHANGELOG.md` (thay đổi chính, PR, việc cần làm khi deploy). Merge vào `main`.
2. **Deploy không traffic**, trên `main` đã cập nhật:
   ```bash
   scripts/release.sh prepare
   ```
   - Kiểm tra: đúng dạng `VERSION`, có mục CHANGELOG, đang ở `main` và trùng `origin/main`, tag chưa tồn tại.
   - Build image `api:X.Y.Z`; deploy revision **0% traffic** có tag `vX-Y-Z` (đặt `APP_VERSION`, `GIT_COMMIT`); build frontend và deploy vào kênh xem trước `vX-Y-Z` (giữ 30 ngày).
   - Tự kiểm tra `/api/v1/health` của revision và `version.json` của kênh xem trước đúng phiên bản; in hai URL thử.
   - Site trên kênh xem trước vẫn gọi API của bản **đang chạy** (rewrite của Firebase trỏ vào traffic chính). API mới thử qua URL của revision.
3. **Kiểm tra** trên hai URL thử (đăng nhập, luồng chính của thay đổi).
4. **Hỏi chủ dự án**, kèm mục CHANGELOG và hai URL thử. Chỉ khi được đồng ý:
   ```bash
   scripts/release.sh promote
   ```
   Chuyển 100% traffic sang revision `vX-Y-Z`, đưa kênh xem trước lên site chính (`hosting:clone`), kiểm tra `/api/v1/health` và `/version.json` của site chính, rồi đẩy git tag `vX.Y.Z`.
5. Ghi kết quả (phiên bản, revision) vào bảng dưới.

Xem production đang chạy gì: `scripts/release.sh status`. Chạy thử không đụng hạ tầng: `DRY_RUN=1 scripts/release.sh prepare`.

**Rollback theo phiên bản** (đã thử chuyển traffic 2026-11-21: ~25 giây, `/health` không gián đoạn):
```bash
scripts/release.sh rollback <X.Y.Z trước đó>
```
Chuyển traffic về revision có tag của phiên bản đó và đưa kênh xem trước của nó lên lại site chính. Kênh xem trước hết hạn sau 30 ngày: khi đó rollback frontend trên Firebase Console → Hosting → Release history. Rollback cũng đổi phiên bản Đấu trường: trận đang diễn ra trên máy cũ vẫn tiếp tục cho tới khi các kết nối đóng.

Bản đang chạy trước `v1.0.0` không có tag. Muốn quay về bản đó: `gcloud run services update-traffic enquiz-api --region=$REGION --to-revisions=<revision cũ>=100` và rollback frontend trên Console.

| Phiên bản | Ngày | Cloud Run revision | Ghi chú |
| --- | --- | --- | --- |
| (trước v1.0.0) | 2026-11-21 | `enquiz-api-00006` | image `85ab510`, deploy bằng tay |

### App cài được (PWA) và cập nhật trên máy người dùng (6.3, 6.4)

- **Service worker** (`fe/sw/sw.ts`) giữ sẵn vỏ app của bản đang dùng. Bản mới được tải ngầm, rồi người dùng thấy thanh **"EnQuiz có bản mới – Cập nhật"**. Thanh này không hiện trong phòng thi, khi đang chơi quiz hay đang ở trận Đấu trường. Vì vậy sau `promote`, các máy đang mở vẫn chạy bản cũ tới khi người dùng bấm Cập nhật hoặc mở lại app.
- **Ép cập nhật:** khi API đổi không tương thích với frontend cũ, phát hành bằng `MIN_CLIENT_VERSION=<phiên bản này> scripts/release.sh prepare`. `/api/v1/health` trả `minClientVersion`. App cũ hơn sẽ tự cập nhật ngay khi người dùng rời bài thi, quiz hoặc trận đấu, mỗi tab tối đa một lần. Không đặt biến này thì giữ giá trị hiện có của service (mặc định `0.0.0`).
- **Không cache API:** service worker không chặn `/api` hay socket. Kiểm tra: DevTools → Application → Cache Storage chỉ có `workbox-precache-…` và `enquiz-media`.
- **`sw.js`, `manifest.webmanifest`** có `Cache-Control: no-cache` (`firebase.json`), để máy người dùng thấy bản mới ngay.
- **Lối thoát khi service worker lỗi** (ví dụ ai cũng kẹt ở bản hỏng): phát hành một bản PATCH có `selfDestroying: true` trong `VitePWA({...})` (`fe/vite.config.ts`). Bản này gỡ service worker và xoá cache trên mọi máy ở lần mở tiếp theo. Sửa xong lỗi thì phát hành bản tiếp theo bỏ cờ này đi.

## Vận hành: backup, theo dõi lỗi, kiểm tra sống

### Backup DB (Atlas M0 không có backup tự động)

```bash
cd be
# Chỉ đọc DB; ghi be/backups/<db>-<thời điểm>.ndjson.gz (đã .gitignore)
MONGODB_URI=$(gcloud secrets versions access latest --secret=mongodb-uri) npm run backup:db
```

- Chạy **hằng tuần** và trước mỗi lần sửa dữ liệu bằng tay. File chứa dữ liệu học sinh và mật khẩu đã băm: giữ ở nơi riêng tư (ổ mã hoá, Drive cá nhân), không gửi qua chat.
- Khôi phục vào một DB trống (cluster mới, DB thử):
  ```bash
  MONGODB_URI=<DB đích> npm run restore:db -- backups/<file>.ndjson.gz
  # Thay dữ liệu DB đang có: phải gõ lại tên DB đích
  MONGODB_URI=<DB đích> npm run restore:db -- backups/<file>.ndjson.gz --replace <tên DB>
  ```
- Đã thử khôi phục: dữ liệu giống hệt bản gốc (kể cả ObjectId, Date) và đủ index.

### Error Reporting (lỗi của backend)

Trên Cloud Run, backend ghi log dạng JSON có `severity` (`CloudLogger`, bật khi có biến `K_SERVICE` mà Cloud Run tự đặt). Lỗi có stack trace được Cloud Error Reporting gom nhóm.

```bash
gcloud services enable clouderrorreporting.googleapis.com
```

- Xem: Console → Error Reporting. Bật email khi có lỗi mới: Error Reporting → *Configure notifications* → chọn kênh email.
- Lọc log theo mức: Logs Explorer, `severity>=ERROR`.

### Uptime check (site còn sống không)

Mỗi 15 phút, từ 3 vùng, gọi `/api/v1/health` qua Firebase (kiểm tra cả Hosting lẫn Cloud Run). Nằm trong hạn mức miễn phí.

```bash
gcloud services enable monitoring.googleapis.com
MSYS2_ARG_CONV_EXCL="--path=" gcloud monitoring uptime create enquiz-health \
  --resource-type=uptime-url --resource-labels=host=$SITE.web.app,project_id=$PROJECT_ID \
  --path=/api/v1/health --protocol=https --period=15 \
  --regions=asia-pacific,usa-oregon,europe \
  --matcher-content='"status":"ok"' --matcher-type=contains-string
```

Gửi email khi uptime check thất bại: Console → Monitoring → Uptime checks → `enquiz-health` → *Create alert*, chọn kênh email.

## Chưa làm trong 4.0

Các mục còn lại xem [roadmap.md](roadmap.md):

- **Sentry:** chưa cần; Error Reporting ở trên đã gom lỗi backend. Lỗi ở trình duyệt chưa được thu.
- **Lịch backup tự động** (Cloud Scheduler + Cloud Run job): hiện chạy tay hằng tuần.
- **Đồng ý của phụ huynh (Nghị định 13/2023):** chặn việc mở cho trường thật.
