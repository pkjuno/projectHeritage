/**
 * User 모델 인스턴스에서 password, refreshToken 같은 민감 정보를 제거하고
 * 클라이언트에 안전하게 내려줄 수 있는 형태로 변환한다.
 * @param {import('../models/user.model')} user - Sequelize User 인스턴스
 * @returns {object} 민감 정보가 제거된 사용자 정보
 */
function toSafeUser(user) {
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const { password, refreshToken, ...safeUser } = plain;
  return safeUser;
}

module.exports = { toSafeUser };
