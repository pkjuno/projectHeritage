const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const config = require('../config');
const AppError = require('../utils/AppError');

// 프로필 이미지 저장 디렉터리 (예: <프로젝트 루트>/uploads/profiles)
const PROFILE_IMAGE_DIR = path.join(process.cwd(), config.upload.dir, 'profiles');

// 허용할 이미지 MIME 타입과 확장자 매핑.
// 클라이언트가 보낸 파일명을 그대로 쓰지 않고 이 표를 통해 확장자를 결정한다. (경로 조작 방지)
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// 서버 기동 시 저장 디렉터리를 미리 만들어 둔다.
fs.mkdirSync(PROFILE_IMAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  // 저장 위치
  destination(req, file, cb) {
    cb(null, PROFILE_IMAGE_DIR);
  },

  // 저장 파일명 - 원본 파일명은 신뢰하지 않고 무작위 값으로 새로 만든다.
  filename(req, file, cb) {
    const extension = ALLOWED_MIME_TYPES[file.mimetype] ?? '';
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

/**
 * 이미지 파일만 업로드를 허용하는 필터.
 */
function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(new AppError(400, '이미지 파일(jpg, png, webp, gif)만 업로드할 수 있습니다.'));
    return;
  }
  cb(null, true);
}

// 게시글 첨부 이미지 저장 디렉터리
const POST_IMAGE_DIR = path.join(process.cwd(), config.upload.dir, 'posts');
fs.mkdirSync(POST_IMAGE_DIR, { recursive: true });

const postImageStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, POST_IMAGE_DIR);
  },
  // 프로필과 같은 이유로 원본 파일명을 쓰지 않는다.
  filename(req, file, cb) {
    const extension = ALLOWED_MIME_TYPES[file.mimetype] ?? '';
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

/**
 * 게시글 첨부 이미지 업로드 미들웨어. "images" 필드로 여러 장을 받는다.
 *
 * 개수 제한을 두는 이유: 제한이 없으면 한 번의 요청으로 디스크를 채울 수 있다.
 * 장당 용량은 프로필 이미지와 같은 설정을 쓴다.
 */
const uploadPostImages = multer({
  storage: postImageStorage,
  fileFilter,
  limits: { fileSize: config.upload.maxImageSizeBytes, files: config.upload.maxPostImages },
}).array('images', config.upload.maxPostImages);

// 프로필 이미지 업로드 미들웨어. 요청의 "image" 필드 하나만 받는다.
const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxImageSizeBytes, files: 1 },
}).single('image');

/**
 * 저장된 프로필 이미지 파일명을 클라이언트에 노출할 URL 경로로 변환한다.
 * @param {string} filename
 * @returns {string} 예: /uploads/profiles/xxxx.jpg
 */
function toProfileImageUrl(filename) {
  return `${config.upload.urlPath}/profiles/${filename}`;
}

/**
 * URL 경로에 해당하는 실제 파일을 삭제한다. (프로필 이미지 교체/삭제 시 사용)
 * 파일이 없거나 외부 URL이면 조용히 무시한다.
 * @param {string|null} imageUrl - DB에 저장된 profileImageUrl 값
 * @returns {Promise<void>}
 */
async function removeProfileImageFile(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith(`${config.upload.urlPath}/profiles/`)) return;

  // URL의 마지막 경로 조각만 사용해 상위 디렉터리 접근(../)을 차단한다.
  const filename = path.basename(imageUrl);
  const filePath = path.join(PROFILE_IMAGE_DIR, filename);

  await fs.promises.rm(filePath, { force: true });
}

module.exports = {
  uploadProfileImage,
  uploadPostImages,
  toProfileImageUrl,
  removeProfileImageFile,
  PROFILE_IMAGE_DIR,
  POST_IMAGE_DIR,
};
