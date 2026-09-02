'use strict';

/**
 * 초기 스키마 마이그레이션 (베이스라인).
 *
 * 그동안 sequelize.sync()로 테이블을 만들어 왔는데, sync()는 기존 테이블에
 * 새 컬럼을 추가하지 않아 스키마를 바꿀 때마다 README에 수동 ALTER SQL을 적어야 했다.
 * 이 파일은 현재 모델 정의와 동일한 스키마를 만드는 기준점이며,
 * 앞으로의 스키마 변경은 새 마이그레이션 파일로 추가한다.
 *
 * 실행: npm run db:migrate
 */

// 모든 테이블이 공통으로 갖는 타임스탬프 컬럼
const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

// 기본 키 (자동 증가 정수)
const primaryKey = (Sequelize) => ({
  type: Sequelize.INTEGER,
  primaryKey: true,
  autoIncrement: true,
  allowNull: false,
});

/**
 * 외래키 컬럼 정의를 만든다.
 * @param {object} Sequelize
 * @param {string} table - 참조할 테이블
 * @param {{allowNull?: boolean, onDelete?: string}} [options]
 */
const foreignKey = (Sequelize, table, { allowNull = false, onDelete = 'CASCADE' } = {}) => ({
  type: Sequelize.INTEGER,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    // 외래키 때문에 참조되는 테이블(sidos, users, festivals)을 먼저 만든다.

    // 광역시도 마스터
    await queryInterface.createTable('sidos', {
      id: primaryKey(Sequelize),
      code: { type: Sequelize.STRING(2), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      ...timestamps(Sequelize),
    });

    // 회원
    await queryInterface.createTable('users', {
      id: primaryKey(Sequelize),
      email: { type: Sequelize.STRING(191), allowNull: false, unique: true },
      password: { type: Sequelize.STRING(255), allowNull: true },
      name: { type: Sequelize.STRING(50), allowNull: false },
      nickname: { type: Sequelize.STRING(30), allowNull: true },
      profile_image_url: { type: Sequelize.STRING(500), allowNull: true },
      refresh_token: { type: Sequelize.STRING(500), allowNull: true },
      push_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      push_token: { type: Sequelize.STRING(255), allowNull: true },
      role: {
        type: Sequelize.ENUM('user', 'admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      status: {
        type: Sequelize.ENUM('active', 'withdrawn'),
        allowNull: false,
        defaultValue: 'active',
      },
      withdrawn_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });

    // 문화재 (시도 참조)
    await queryInterface.createTable('heritages', {
      id: primaryKey(Sequelize),
      sido_id: foreignKey(Sequelize, 'sidos', { onDelete: 'NO ACTION' }),
      name: { type: Sequelize.STRING(200), allowNull: false },
      designation_type: {
        type: Sequelize.ENUM(
          '국가지정문화재',
          '시도지정문화재',
          '문화재자료',
          '등록문화재',
          '향토문화유적'
        ),
        allowNull: false,
        defaultValue: '국가지정문화재',
      },
      category_code: { type: Sequelize.STRING(20), allowNull: true },
      management_no: { type: Sequelize.STRING(30), allowNull: true },
      designated_date: { type: Sequelize.DATEONLY, allowNull: true },
      address: { type: Sequelize.STRING(255), allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.STRING(500), allowNull: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('heritages', ['sido_id'], { name: 'heritages_sido_id' });
    await queryInterface.addIndex('heritages', ['name'], { name: 'heritages_name' });
    // 공공데이터 재수집 시 중복 적재를 막는 원본 자연키
    await queryInterface.addIndex('heritages', ['category_code', 'management_no', 'sido_id'], {
      name: 'uq_heritage_source_key',
      unique: true,
    });

    // 지역축제 (시도 참조)
    await queryInterface.createTable('festivals', {
      id: primaryKey(Sequelize),
      sido_id: foreignKey(Sequelize, 'sidos', { onDelete: 'NO ACTION' }),
      name: { type: Sequelize.STRING(200), allowNull: false },
      sigungu: { type: Sequelize.STRING(50), allowNull: true },
      location: { type: Sequelize.STRING(255), allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      host_organization: { type: Sequelize.STRING(100), allowNull: true },
      manage_organization: { type: Sequelize.STRING(100), allowNull: true },
      grade: { type: Sequelize.STRING(50), allowNull: true },
      homepage_url: { type: Sequelize.STRING(500), allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('festivals', ['sido_id'], { name: 'festivals_sido_id' });
    await queryInterface.addIndex('festivals', ['name'], { name: 'festivals_name' });
    // 캘린더/기간 조회에서 사용
    await queryInterface.addIndex('festivals', ['start_date', 'end_date'], {
      name: 'festivals_start_date_end_date',
    });

    // 간편로그인 연결 (회원 참조)
    await queryInterface.createTable('social_accounts', {
      id: primaryKey(Sequelize),
      user_id: foreignKey(Sequelize, 'users'),
      provider: { type: Sequelize.ENUM('naver', 'kakao', 'google'), allowNull: false },
      provider_id: { type: Sequelize.STRING(255), allowNull: false },
      provider_email: { type: Sequelize.STRING(191), allowNull: true },
      ...timestamps(Sequelize),
    });

    // 하나의 SNS 계정은 한 회원에게만 연결된다.
    await queryInterface.addIndex('social_accounts', ['provider', 'provider_id'], {
      name: 'uq_social_provider_provider_id',
      unique: true,
    });
    // 한 회원은 같은 제공자를 중복 연결할 수 없다.
    await queryInterface.addIndex('social_accounts', ['user_id', 'provider'], {
      name: 'uq_social_user_provider',
      unique: true,
    });

    // 위시리스트 (회원/축제 참조)
    await queryInterface.createTable('festival_wishlists', {
      id: primaryKey(Sequelize),
      user_id: foreignKey(Sequelize, 'users'),
      festival_id: foreignKey(Sequelize, 'festivals'),
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('festival_wishlists', ['user_id', 'festival_id'], {
      name: 'uq_wishlist_user_festival',
      unique: true,
    });

    // 내 일정 (회원/축제 참조)
    await queryInterface.createTable('festival_schedules', {
      id: primaryKey(Sequelize),
      user_id: foreignKey(Sequelize, 'users'),
      festival_id: foreignKey(Sequelize, 'festivals'),
      visit_date: { type: Sequelize.DATEONLY, allowNull: false },
      memo: { type: Sequelize.STRING(500), allowNull: true },
      ...timestamps(Sequelize),
    });

    // 같은 축제를 같은 날짜로 중복 등록할 수 없다.
    await queryInterface.addIndex('festival_schedules', ['user_id', 'festival_id', 'visit_date'], {
      name: 'uq_schedule_user_festival_date',
      unique: true,
    });
    // 내 일정을 기간으로 조회할 때 사용
    await queryInterface.addIndex('festival_schedules', ['user_id', 'visit_date'], {
      name: 'idx_schedule_user_visit_date',
    });

    // 알림 (회원 참조, 축제는 선택)
    await queryInterface.createTable('notifications', {
      id: primaryKey(Sequelize),
      user_id: foreignKey(Sequelize, 'users'),
      type: {
        type: Sequelize.ENUM('schedule_reminder', 'festival_start', 'notice'),
        allowNull: false,
      },
      title: { type: Sequelize.STRING(100), allowNull: false },
      body: { type: Sequelize.STRING(500), allowNull: false },
      festival_id: foreignKey(Sequelize, 'festivals', { allowNull: true }),
      dedupe_key: { type: Sequelize.STRING(191), allowNull: false },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });

    // 배치 재실행 시 같은 알림이 중복 생성되는 것을 막는다.
    await queryInterface.addIndex('notifications', ['user_id', 'dedupe_key'], {
      name: 'uq_notification_user_dedupe',
      unique: true,
    });
    // 알림함을 최신순으로 조회할 때 사용
    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], {
      name: 'idx_notification_user_created',
    });
  },

  async down(queryInterface) {
    // 외래키 제약 때문에 참조하는 쪽(자식 테이블)부터 지운다.
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('festival_schedules');
    await queryInterface.dropTable('festival_wishlists');
    await queryInterface.dropTable('social_accounts');
    await queryInterface.dropTable('festivals');
    await queryInterface.dropTable('heritages');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('sidos');
  },
};
