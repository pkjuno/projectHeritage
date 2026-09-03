const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * 업로드된 이미지의 저장소.
 *
 * === 왜 한 겹 씌우는가 ===
 * 지금은 서버의 로컬 디스크에 저장한다. 이 방식은 **서버가 두 대가 되는 순간 깨진다.**
 * A 서버에 올린 파일을 B 서버가 서빙할 수 없기 때문이다.
 * 언젠가 S3 같은 외부 저장소로 옮겨야 하는데, 그때 서비스와 컨트롤러를 뒤지지 않도록
 * 파일을 다루는 코드를 여기 한 곳에만 둔다.
 *
 * S3로 옮길 때 고쳐야 할 곳은 이 파일뿐이다. save/remove의 시그니처만 지키면 된다.
 * (DB의 post_images.url은 이미 전체 URL이 들어갈 수 있는 길이로 잡혀 있다)
 */

// 게시글 첨부 이미지 저장 디렉터리
const POST_IMAGE_DIR = path.join(process.cwd(), config.upload.dir, 'posts');

// 서버 기동 시 디렉터리를 미리 만들어 둔다.
fs.mkdirSync(POST_IMAGE_DIR, { recursive: true });

/**
 * multer가 디스크에 저장한 파일을 외부에 노출할 URL로 바꾼다.
 * @param {string} filename
 * @returns {string} 예: /uploads/posts/xxxx.jpg
 */
function toUrl(filename) {
  return `${config.upload.urlPath}/posts/${filename}`;
}

/**
 * 저장된 이미지를 삭제한다.
 *
 * 파일이 없거나 우리가 저장한 경로가 아니면 조용히 넘어간다.
 * (이미 지워졌거나 외부 URL인 경우 — 어느 쪽도 오류로 다룰 일이 아니다)
 *
 * @param {string|null} url - DB에 저장된 post_images.url 값
 * @returns {Promise<void>}
 */
async function remove(url) {
  if (!url || !url.startsWith(`${config.upload.urlPath}/posts/`)) return;

  // URL의 마지막 조각만 쓴다. 전체 경로를 신뢰하면 '../'로 상위 디렉터리에 접근할 수 있다.
  const filename = path.basename(url);
  await fs.promises.rm(path.join(POST_IMAGE_DIR, filename), { force: true });
}

/**
 * 여러 이미지를 한 번에 삭제한다. (글 삭제 시)
 *
 * 하나가 실패해도 나머지는 지운다. 파일 정리 실패로 글 삭제가 막히면 안 된다.
 * @param {string[]} urls
 * @returns {Promise<void>}
 */
async function removeAll(urls) {
  await Promise.all(
    urls.map((url) =>
      remove(url).catch((error) => {
        console.error('[이미지] 삭제 실패:', url, error.message);
      })
    )
  );
}

module.exports = { toUrl, remove, removeAll, POST_IMAGE_DIR };
