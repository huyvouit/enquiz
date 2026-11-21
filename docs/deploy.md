# Deploy EnQuiz (giai đoạn 4.0, phương án B)

Frontend trên **Firebase Hosting**, backend trên **Google Cloud Run**, DB trên **MongoDB Atlas**, ảnh và âm thanh trên **Cloud Storage**. Firebase Hosting chuyển `/api/**` sang Cloud Run ([fe/firebase.json](../fe/firebase.json)), nên frontend và API dùng chung một domain. Riêng socket Đấu trường đi thẳng tới Cloud Run (D19).

```
Trình duyệt ──► https://<SITE>.web.app
                  ├─ /api/**  ──► Cloud Run "enquiz-api" (asia-southeast1) ──► MongoDB Atlas
                  └─ còn lại  ──► fe/dist (SPA)                               └─► Cloud Storage (ảnh, âm thanh)
Trình duyệt ──► wss://enquiz-api-….run.app/live  (Đấu trường)
```

Các lệnh viết cho bash (Git Bash hoặc Cloud Shell), chạy từ thư mục gốc repo.

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

```bash
TAG=$(git rev-parse --short HEAD)
# be/.gcloudignore ngăn tải .env và node_modules lên Cloud Build
gcloud builds submit be --tag $REPO/api:$TAG

gcloud run deploy enquiz-api --image=$REPO/api:$TAG --region=$REGION \
  --service-account=$RUN_SA --allow-unauthenticated \
  --min-instances=0 --max-instances=1 --memory=512Mi \
  --session-affinity --timeout=3600 \
  --set-env-vars="^;^SEED_DEMO_DATA=false;TRUST_PROXY=2;LIVE_TRUST_PROXY=1;CORS_ORIGIN=https://$SITE.web.app;LIVE_CORS_ORIGINS=https://$SITE.web.app,https://$SITE.firebaseapp.com;STORAGE_DRIVER=gcs;GCS_BUCKET=$BUCKET;TTS_DRIVER=google;TTS_LANGUAGE=en-GB" \
  --set-secrets=JWT_SECRET=jwt-secret:latest,MONGODB_URI=mongodb-uri:latest,GOOGLE_TTS_API_KEY=tts-api-key:latest
```

Giải thích các tham số chính:

- **`--service-account`:** Cloud Run chạy bằng `enquiz-api`, chỉ có quyền ghi bucket và đọc ba secret, không dùng tài khoản mặc định có quyền Editor cả project.
- **`^;^` trong `--set-env-vars`:** đổi dấu tách thành `;`, để `LIVE_CORS_ORIGINS` chứa được dấu phẩy.
- **`TRUST_PROXY=2`, `LIVE_TRUST_PROXY=1`:** HTTP đi qua hai proxy (Firebase Hosting rồi Cloud Run), còn socket Đấu trường đi thẳng vào Cloud Run (một proxy). Tin nhiều proxy hơn thực tế thì client giả được IP bằng header `X-Forwarded-For`, và lách được giới hạn theo IP. Đã đo trên hạ tầng thật: với 1 thì HTTP thấy IP của Google; với 2 thì đúng IP thật. Ai gọi thẳng `run.app` vẫn giả được IP cho HTTP; giới hạn theo username (D14) vẫn chặn dò mật khẩu.
- **`--max-instances=1`:** giới hạn đăng nhập và phòng Đấu trường nằm trong RAM của từng instance. Nếu chạy nhiều instance thì cần chuyển sang Redis.
- **Chế độ tiết kiệm (mặc định):** `--min-instances=0` và CPU chỉ cấp khi có request. Không có ai dùng thì không tốn tiền. Mọi tính năng chạy bình thường, **trừ Đấu trường**: đồng hồ câu hỏi chỉ chạy khi CPU được cấp, và máy có thể bị tắt giữa trận.
- **Bật Đấu trường (D19)** trước giờ lớp chơi hoặc khi chạy bước 8 của mục 6, tắt lại khi xong:
  ```bash
  # Bật: luôn có một máy chạy, CPU luôn cấp (tính phí theo giờ, xem bảng giá Cloud Run)
  gcloud run services update enquiz-api --region=$REGION --min-instances=1 --no-cpu-throttling
  # Tắt: quay về chế độ tiết kiệm
  gcloud run services update enquiz-api --region=$REGION --min-instances=0 --cpu-throttling
  ```
  - `--session-affinity`: khi mạng trường chặn WebSocket và client lùi về long-polling, các request của một người vẫn tới cùng máy.
  - `--timeout=3600`: một kết nối WebSocket sống tối đa 60 phút; client tự nối lại.
  - `LIVE_CORS_ORIGINS`: origin được mở socket thẳng tới Cloud Run (Firebase Hosting không chuyển tiếp WebSocket).
- **Probe khởi động:** dùng probe TCP mặc định là đủ. NestJS chỉ mở cổng sau khi đã kết nối xong MongoDB.
- **Sự kiện chạy nền:** việc thêm/gỡ học sinh khỏi bài tập đã được chạy và chờ xong ngay trong request (D13), nên chạy đúng cả khi CPU chỉ cấp trong request.

## 5. Frontend lên Firebase Hosting

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
8. **Socket Đấu trường (5.0):** bật Đấu trường (mục 4) rồi chạy từ máy local, trong thư mục `be/`:
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
   - Thử tải một phòng 60 học sinh (tạo lớp và tài khoản thử, **chỉ chạy vào DB thử**, không vào dữ liệu thật): `node scripts/live-load.mjs --url $RUN_URL --players 60 --teacher <giáo viên thử>:<mật khẩu>`.
   - Xong thì tắt Đấu trường (mục 4) nếu chưa dùng thật.
9. **Header bảo mật và SEO** ([launch-checklist.md](launch-checklist.md) A6, B3):
   ```bash
   curl -sI https://$SITE.web.app/login | grep -iE 'content-security-policy|x-frame-options|strict-transport'
   curl -s https://$SITE.web.app/robots.txt
   curl -s https://$SITE.web.app/sitemap.xml
   ```
   Mở site bằng Chrome, F12 → Console: không có dòng `Refused to … Content Security Policy`. Dán link site vào Zalo hoặc Messenger: thấy ảnh và mô tả EnQuiz.

## Cập nhật và rollback

```bash
# Backend: build tag mới rồi deploy (env, secret và tài khoản chạy được giữ nguyên)
TAG=$(git rev-parse --short HEAD)
gcloud builds submit be --tag $REPO/api:$TAG
gcloud run deploy enquiz-api --image=$REPO/api:$TAG --region=$REGION

# Quay lại revision trước
gcloud run revisions list --service=enquiz-api --region=$REGION
gcloud run services update-traffic enquiz-api --region=$REGION --to-revisions=<REVISION>=100

# Frontend
cd fe && npm run build && firebase deploy --only hosting
# Rollback frontend: Firebase Console → Hosting → Release history → Rollback
```

## Chưa làm trong 4.0

Các mục còn lại xem [roadmap.md](roadmap.md):

- **Sentry:** cần tạo tài khoản.
- **Backup Atlas.**
- **Đồng ý của phụ huynh (Nghị định 13/2023):** chặn việc mở cho trường thật.
