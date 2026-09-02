/**
 * 지정한 ms만큼 대기한다. 공공 API에 대한 예의상 요청 사이 간격을 둘 때 사용한다.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 지수 백오프를 적용한 GET 요청 함수.
 * 공공 Open API는 순간적인 5xx/타임아웃이 잦기 때문에 배치 스크립트에서는 재시도가 필수적이다.
 * @param {string} url - 쿼리스트링까지 포함한 전체 요청 URL
 * @param {{retries?: number, retryDelayMs?: number}} [options]
 * @returns {Promise<string>} 응답 본문(raw text)
 */
async function fetchWithRetry(url, { retries = 3, retryDelayMs = 1000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      console.warn(`[Importer] 요청 실패 (${attempt}/${retries}) ${url} : ${error.message}`);

      if (attempt < retries) {
        // 시도할수록 대기 시간을 늘린다 (1초 -> 2초 -> 3초 ...)
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw new Error(`공공 API 요청에 최종 실패했습니다: ${lastError.message}`);
}

module.exports = { fetchWithRetry, sleep };
