const config = require('../config');

/**
 * 푸시 발송 어댑터.
 *
 * 실제 발송(FCM 등)은 서비스 계정 키가 있어야 동작하므로, 전송 수단을 여기 한 곳으로 모아
 * 상위 로직(알림 생성/스케줄러)이 전송 방식에 의존하지 않도록 분리했다.
 * FCM을 붙일 때는 sendPush 안의 TODO 부분만 구현하면 되고, 나머지 코드는 그대로 둔다.
 */

/**
 * 푸시 1건을 발송한다.
 *
 * @param {{token: string, title: string, body: string, data?: Record<string, string>}} message
 * @returns {Promise<boolean>} 발송 성공 여부
 */
async function sendPush({ token, title, body, data = {} }) {
  if (!token) return false;

  // TODO: 실제 FCM 연동 지점.
  //   firebase-admin 설치 후 서비스 계정 키(FIREBASE_SERVICE_ACCOUNT)로 초기화하고
  //   admin.messaging().send({ token, notification: { title, body }, data }) 를 호출한다.
  //   현재는 키가 없어 실제 발송 대신 로그만 남긴다.
  if (config.env !== 'test') {
    console.log(`[Push] (미발송/로그) to=${token.slice(0, 12)}… title="${title}" body="${body}"`, data);
  }

  // 전송 수단이 아직 연결되지 않았으므로 "보내지 못했다"고 정직하게 반환한다.
  // 이렇게 해야 알림 레코드의 sentAt이 비어 있어 나중에 재발송 대상을 찾을 수 있다.
  return false;
}

module.exports = { sendPush };
