const User = require('../models/user.model');

// 데이터베이스 연동 전 임시로 사용하는 인메모리 저장소 (예시용).
const users = [
  new User({ id: 1, name: '홍길동', email: 'hong@example.com' }),
];

/**
 * 전체 사용자 목록을 조회한다.
 * @returns {Promise<User[]>} 사용자 배열
 */
async function getUsers() {
  // TODO: 실제 데이터베이스 조회 로직으로 교체
  return users;
}

/**
 * ID로 특정 사용자를 조회한다.
 * @param {string|number} id - 조회할 사용자 ID
 * @returns {Promise<User|undefined>} 조회된 사용자 (없으면 undefined)
 */
async function getUserById(id) {
  return users.find((user) => String(user.id) === String(id));
}

/**
 * 새로운 사용자를 생성한다.
 * @param {{name: string, email: string}} payload - 생성할 사용자 정보
 * @returns {Promise<User>} 생성된 사용자
 */
async function createUser(payload) {
  const newUser = new User({
    id: users.length + 1,
    name: payload.name,
    email: payload.email,
  });
  users.push(newUser);
  return newUser;
}

module.exports = { getUsers, getUserById, createUser };
