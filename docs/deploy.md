# Deploy EnQuiz (giai đoạn 4.0, phương án B)

Frontend trên **Firebase Hosting**, backend trên **Google Cloud Run**, DB trên **MongoDB Atlas**, ảnh trên **Cloud Storage**. Firebase Hosting chuyển `/api/**` sang Cloud Run ([fe/firebase.json](../fe/firebase.json)), nên frontend và API dùng chung một domain.

```
Trình duyệt ──► https://<PROJECT_ID>.web.app
                  ├─ /api/**  ──► Cloud Run "enquiz-api" (asia-southeast1) ──► MongoDB Atlas
                  └─ còn lại  ──► fe/dist (SPA)                               └─► Cloud Storage (ảnh)
```

Các lệnh viết cho bash (Git Bash hoặc Cloud Shell), chạy từ thư mục gốc repo.

## 0. Chuẩn bị

- Tài khoản Google Cloud **có gắn thanh toán** (Cloud Run có hạn mức miễn phí, nhưng vẫn bắt buộc gắn thẻ).
- Đã cài [gcloud CLI](https://cloud.google.com/sdk/docs/install) và Firebase CLI (`npm i -g firebase-tools`).
- Tài khoản [MongoDB Atlas](https://www.mongodb.com/atlas).

```bash
PROJECT_ID=enquiz-prod            # đổi thành ID project của bạn
REGION=asia-southeast1            # Singapore, gần Việt Nam nhất
BUCKET=$PROJECT_ID-images
REPO=$REGION-docker.pkg.dev/$PROJECT_ID/enquiz

gcloud auth login
gcloud projects create $PROJECT_ID   # bỏ qua nếu đã có project
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com texttospeech.googleapis.com
gcloud artifacts repositories create enquiz --repository-format=docker --location=$REGION
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
RUN_SA=$PROJECT_NUMBER-compute@developer.gserviceaccount.com   # tài khoản chạy Cloud Run
```

## 1. MongoDB Atlas

1. Tạo cluster (M0 miễn phí để thử). Nếu có thể, chọn region Singapore.
2. **Database Access:** tạo user và mật khẩu riêng cho ứng dụng.
3. **Network Access:** thêm `0.0.0.0/0`, vì Cloud Run không có IP ra cố định. Khi đó chỉ còn mật khẩu DB bảo vệ, nên mật khẩu phải dài và ngẫu nhiên.
4. Lấy chuỗi kết nối và thêm tên DB, ví dụ `mongodb+srv://enquiz:<pass>@cluster0.xxxx.mongodb.net/enquiz?retryWrites=true&w=majority`.
5. **Backup:** M0 không có backup tự động. Hoặc nâng gói, hoặc chạy `mongodump` định kỳ.

Nạp kho câu hỏi và tạo admin đầu tiên **từ máy local** (cả hai lệnh đều chạy lại an toàn). Máy local để `TTS_DRIVER` mặc định (`none`), nên câu nghe được nạp **chưa có âm thanh**; sau khi deploy, admin bấm "Tạo âm thanh" (bước 6 của mục kiểm tra). Nhờ vậy máy local không cần khoá TTS hay khoá Storage.

```bash
cd be
export MONGODB_URI='mongodb+srv://...'          # chuỗi ở bước 4
export JWT_SECRET=local-cli-only-0123456789      # CLI chỉ cần một giá trị hợp lệ
npm run seed:content
npm run create:admin -- admin "Quản trị viên"    # in mật khẩu MỘT lần, lưu lại ngay
unset MONGODB_URI JWT_SECRET
cd ..
```

## 2. Cloud Storage cho ảnh và âm thanh

```bash
gcloud storage buckets create gs://$BUCKET --location=$REGION --uniform-bucket-level-access
# Ảnh (images/) và âm thanh câu nghe (audio/) là công khai: học sinh tải trực tiếp
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=allUsers --role=roles/storage.objectViewer

# Tài khoản riêng chỉ được ghi vào bucket này, kèm khoá HMAC (API tương thích S3)
gcloud iam service-accounts create enquiz-storage
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:enquiz-storage@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
gcloud storage hmac create enquiz-storage@$PROJECT_ID.iam.gserviceaccount.com
# → ghi lại accessId và secret cho bước 3
```

Nếu tổ chức chặn `allUsers` (Public Access Prevention), ảnh và âm thanh sẽ không tải được. Khi đó cần tắt chính sách này cho riêng bucket.

**Khoá Text-to-Speech (D16):** tạo API key và **giới hạn chỉ cho Text-to-Speech API**: Console → APIs & Services → Credentials → Create credentials → API key → API restrictions: Cloud Text-to-Speech API. Ghi lại khoá cho bước 3.

## 3. Secret Manager

```bash
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create jwt-secret --data-file=-
printf '%s' 'mongodb+srv://...'   | gcloud secrets create mongodb-uri --data-file=-
printf '%s' '<HMAC accessId>'     | gcloud secrets create gcs-hmac-id --data-file=-
printf '%s' '<HMAC secret>'       | gcloud secrets create gcs-hmac-secret --data-file=-
printf '%s' '<TTS API key>'       | gcloud secrets create tts-api-key --data-file=-

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$RUN_SA --role=roles/secretmanager.secretAccessor
```

`JWT_SECRET` của production phải **khác** giá trị dùng khi dev.

## 4. Backend lên Cloud Run

```bash
TAG=$(git rev-parse --short HEAD)
# be/.gcloudignore ngăn tải .env và node_modules lên Cloud Build
gcloud builds submit be --tag $REPO/api:$TAG

gcloud run deploy enquiz-api --image=$REPO/api:$TAG --region=$REGION \
  --allow-unauthenticated --min-instances=1 --max-instances=1 --memory=512Mi \
  --no-cpu-throttling --session-affinity --timeout=3600 \
  --set-env-vars=SEED_DEMO_DATA=false,TRUST_PROXY=1,CORS_ORIGIN=https://$PROJECT_ID.web.app,LIVE_CORS_ORIGINS=https://$PROJECT_ID.web.app,STORAGE_DRIVER=s3,S3_BUCKET=$BUCKET,S3_REGION=auto,S3_ENDPOINT=https://storage.googleapis.com,S3_PUBLIC_URL=https://storage.googleapis.com/$BUCKET,TTS_DRIVER=google,TTS_LANGUAGE=en-GB \
  --set-secrets=JWT_SECRET=jwt-secret:latest,MONGODB_URI=mongodb-uri:latest,AWS_ACCESS_KEY_ID=gcs-hmac-id:latest,AWS_SECRET_ACCESS_KEY=gcs-hmac-secret:latest,GOOGLE_TTS_API_KEY=tts-api-key:latest
```

Giải thích các tham số chính:

- **`--max-instances=1`:** giới hạn đăng nhập đếm trong RAM của từng instance. Nếu chạy nhiều instance thì cần chuyển bộ đếm sang Redis.
- **Đấu trường trực tuyến (Giai đoạn 5, D19):**
  - `--min-instances=1`: luôn có một máy chạy, không tắt giữa trận. Trạng thái phòng đấu nằm trong RAM của máy đó.
  - `--no-cpu-throttling`: CPU luôn được cấp, để đồng hồ câu hỏi chạy cả khi không có request HTTP.
  - `--session-affinity`: khi mạng trường chặn WebSocket và client lùi về long-polling, các request của một người vẫn tới cùng máy.
  - `--timeout=3600`: một kết nối WebSocket sống tối đa 60 phút; client tự nối lại.
  - `LIVE_CORS_ORIGINS`: origin được mở socket thẳng tới Cloud Run (Firebase Hosting không chuyển tiếp WebSocket). Có thêm domain `*.firebaseapp.com` thì đặt riêng, vì dấu phẩy trùng dấu tách của `--set-env-vars`:
    ```bash
    gcloud run services update enquiz-api --region=$REGION \
      --update-env-vars="^;^LIVE_CORS_ORIGINS=https://$PROJECT_ID.web.app,https://$PROJECT_ID.firebaseapp.com"
    ```
  - **Chi phí:** một instance chạy liên tục, CPU luôn cấp, bị tính phí theo giờ. Ước tính bằng bảng giá Cloud Run trước khi bật. Khi chưa dùng Đấu trường, có thể tạm để `--min-instances=0` và bỏ `--no-cpu-throttling`.
- **Probe khởi động:** dùng probe TCP mặc định là đủ. NestJS chỉ mở cổng sau khi đã kết nối xong MongoDB.
- **Sự kiện chạy nền:** việc thêm/gỡ học sinh khỏi bài tập đã được chạy và chờ xong ngay trong request (D13). "CPU luôn cấp" ở trên là vì Đấu trường, không phải vì việc này.

## 5. Frontend lên Firebase Hosting

```bash
firebase login
firebase projects:addfirebase $PROJECT_ID   # gắn Firebase vào project GCP (một lần)
cd fe
firebase use --add $PROJECT_ID              # tạo .firebaserc; commit file này
# VITE_API_BASE_URL giữ mặc định /api/v1 (đi qua rewrite của Firebase).
# Socket Đấu trường đi thẳng tới Cloud Run (D19):
export VITE_LIVE_URL=$(gcloud run services describe enquiz-api --region=$REGION --format='value(status.url)')
npm ci && npm run build
firebase deploy --only hosting
cd ..
```

`serviceId` và `region` trong `fe/firebase.json` phải khớp với service Cloud Run (`enquiz-api`, `asia-southeast1`).

## 6. Kiểm tra sau khi deploy

1. Mở `https://$PROJECT_ID.web.app/api/v1/health`. Kết quả phải là `{"status":"ok","clientIp":"…"}`.
2. **So `clientIp` với IP thật của bạn** (ví dụ xem ở https://ifconfig.me).
   - Nếu `clientIp` là IP của Google, tăng số proxy lên: `gcloud run services update enquiz-api --region=$REGION --update-env-vars=TRUST_PROXY=2`, rồi kiểm tra lại.
   - Nếu để sai, mọi người sẽ dùng chung một bộ đếm giới hạn đăng nhập.
3. Đăng nhập bằng admin ở bước 1. Đăng ký thử một giáo viên, rồi duyệt tài khoản đó.
4. Giáo viên upload một ảnh câu hỏi. Ảnh phải có URL `https://storage.googleapis.com/<bucket>/images/…` và hiển thị được. Nếu lỗi, xem log:
   ```bash
   gcloud run services logs read enquiz-api --region=$REGION --limit=50
   ```
   Việc chạy `@nestjs/storage` với Cloud Storage chưa từng được thử. Nếu không chạy được, thay thư viện ở 4.1.
5. Xuất thử bảng điểm Excel và PDF, kiểm tra tiếng Việt có dấu hiển thị đúng.
6. **Âm thanh câu nghe:** admin vào Kho câu hỏi, bấm **🔊 Tạo âm thanh** cho tới khi thanh báo biến mất. Mở một trạm có câu nghe bằng tài khoản học sinh: nút 🔊 phát được, và dữ liệu `/play` (tab Network) **không có** chữ của câu đọc. Nếu báo lỗi, xem log Cloud Run: thường là khoá chưa được phép gọi Text-to-Speech API.
7. Đăng nhập thử **11 lần sai** với cùng một username. Lần thứ 11 phải bị chặn (429). Đăng nhập bằng username khác thì vẫn bình thường.
8. **Socket Đấu trường (5.0):** chạy từ máy local, trong thư mục `be/`:
   ```bash
   RUN_URL=$(gcloud run services describe enquiz-api --region=$REGION --format='value(status.url)')
   # Ẩn danh, 60 kết nối cùng lúc: phải "connected 60/60", transport websocket
   node scripts/live-check.mjs --url $RUN_URL --clients 60 --origin https://$PROJECT_ID.web.app
   # Bằng tài khoản học sinh: "server sees" có role student, clientIp là IP thật của bạn
   LIVE_TOKEN=<accessToken lấy từ /auth/login> node scripts/live-check.mjs --url $RUN_URL
   # Giữ 65 phút: mỗi kết nối bị Cloud Run cắt một lần ở phút 60 rồi tự nối lại
   node scripts/live-check.mjs --url $RUN_URL --hold 65
   ```
   - `clientIp` khác IP thật thì chỉnh `TRUST_PROXY` như bước 2 (socket đọc `X-Forwarded-For` theo cùng biến).
   - Trình duyệt báo lỗi CORS khi mở socket: kiểm tra `LIVE_CORS_ORIGINS` có đúng domain đang mở trang không.
   - Thử tải một phòng 60 học sinh (tạo lớp và tài khoản thử, **chỉ chạy vào DB thử**, không vào dữ liệu thật): `node scripts/live-load.mjs --url $RUN_URL --players 60 --teacher <giáo viên thử>:<mật khẩu>`.

## Cập nhật và rollback

```bash
# Backend: build tag mới rồi deploy (env và secret được giữ nguyên)
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
