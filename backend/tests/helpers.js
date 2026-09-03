const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/user.model');
const Sido = require('../src/models/sido.model');
const Festival = require('../src/models/festival.model');
const { seedSidos } = require('../src/seeders/sido.seed');
const { seedBoardCategories } = require('../src/seeders/boardCategory.seed');

/**
 * 테스트에서 반복적으로 쓰는 도우미 모음.
 */

/**
 * 테스트 데이터를 모두 지운다. 각 테스트가 서로 영향을 주지 않도록 beforeEach에서 호출한다.
 *
 * 외래키 제약 때문에 자식 테이블부터 지워야 하므로, 순서 실수를 방지하기 위해
 * FOREIGN_KEY_CHECKS를 잠시 꺼두고 TRUNCATE 한다. (DELETE보다 빠르고 AUTO_INCREMENT도 초기화된다)
 * @returns {Promise<void>}
 */
async function resetDatabase() {
  const tables = [
    'post_shares',
    'post_views',
    'comment_likes',
    'post_reactions',
    'post_comments',
    'posts',
    'board_categories',
    'notifications',
    'festival_schedules',
    'festival_wishlists',
    'social_accounts',
    'users',
    'festivals',
    'heritages',
    'sidos',
  ];

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await sequelize.query(`TRUNCATE TABLE \`${table}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  // 마스터 데이터는 다른 데이터의 기준이 되므로 항상 다시 채워둔다.
  await seedSidos();
  await seedBoardCategories();
}

/**
 * 회원을 가입시키고 로그인해 Access Token까지 받아온다.
 * @param {{email?: string, password?: string, name?: string, role?: 'user'|'admin'}} [options]
 * @returns {Promise<{user: User, token: string, email: string, password: string}>}
 */
async function createUserAndLogin({
  email = `user${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`,
  password = 'pass1234',
  name = '테스트회원',
  role = 'user',
} = {}) {
  await request(app).post('/api/auth/signup').send({ email, password, name }).expect(201);

  // 운영자 권한은 API로 부여할 수 없으므로 DB에서 직접 바꾼다. (실서비스에서는 admin:grant 스크립트)
  const user = await User.findOne({ where: { email } });
  if (role !== 'user') {
    user.role = role;
    await user.save();
  }

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return { user, token: loginResponse.body.data.accessToken, email, password };
}

/**
 * 테스트용 축제를 만든다. 기본값은 서울에서 열리는 3일짜리 축제.
 * @param {object} [overrides] - 덮어쓸 필드
 * @returns {Promise<Festival>}
 */
async function createFestival(overrides = {}) {
  const sido = await Sido.findOne({ where: { code: overrides.sidoCode ?? '11' } });
  delete overrides.sidoCode;

  return Festival.create({
    sidoId: sido.id,
    name: '테스트축제',
    location: '테스트장소',
    startDate: '2026-11-05',
    endDate: '2026-11-07',
    ...overrides,
  });
}

/**
 * 인증 헤더를 만든다.
 * @param {string} token
 * @returns {{Authorization: string}}
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { request, app, resetDatabase, createUserAndLogin, createFestival, authHeader };
