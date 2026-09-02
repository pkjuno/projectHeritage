/**
 * User 도메인 모델.
 * 실제 프로젝트에서는 ORM(Sequelize, Mongoose 등)의 스키마 정의로 대체된다.
 * 지금은 계층 구조를 보여주기 위한 순수 JS 클래스로 정의한다.
 */
class User {
  /**
   * @param {object} params
   * @param {string|number} params.id - 사용자 고유 식별자
   * @param {string} params.name - 사용자 이름
   * @param {string} params.email - 사용자 이메일
   */
  constructor({ id, name, email }) {
    this.id = id;
    this.name = name;
    this.email = email;
  }
}

module.exports = User;
