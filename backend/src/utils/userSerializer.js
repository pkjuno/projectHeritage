/**
 * User 모델 인스턴스에서 password, refreshToken 같은 민감 정보를 제거하고
 * 클라이언트에 안전하게 내려줄 수 있는 형태로 변환한다.
 * 연결된 간편로그인(socialAccounts)이 함께 조회된 경우 그대로 포함한다.
 * @param {import('../models/user.model')} user - Sequelize User 인스턴스
 * @returns {object} 민감 정보가 제거된 회원 정보
 */
function toSafeUser(user) {
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const { password, refreshToken, ...safeUser } = plain;

  return {
    ...safeUser,
    // 비밀번호 보유 여부는 마이페이지에서 "간편로그인 해지 가능 여부"를 판단하는 데 필요하다.
    hasPassword: Boolean(password),
  };
}

module.exports = { toSafeUser };
