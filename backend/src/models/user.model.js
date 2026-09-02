const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 회원(User) 도메인 모델.
 * 회원 1명당 1행이며, 간편로그인 연결 정보는 SocialAccount(1:N)에서 별도로 관리한다.
 * 따라서 한 회원이 카카오/네이버/구글을 동시에 연결하거나 개별적으로 해지할 수 있다.
 */
class User extends Model {
  /**
   * 이 회원이 사용 가능한 로그인 수단이 비밀번호인지 여부.
   * 간편로그인 연결 해지 시 "마지막 로그인 수단"인지 판단하는 데 사용한다.
   * @returns {boolean}
   */
  hasPassword() {
    return Boolean(this.password);
  }

  /**
   * 운영자 권한 보유 여부.
   * @returns {boolean}
   */
  isAdmin() {
    return this.role === 'admin';
  }
}

User.init(
  {
    // 회원 고유 식별자
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 이메일 (일반 로그인 아이디). 간편로그인 최초 가입 시에는 SNS가 제공한 이메일을 사용한다.
    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },

    // 비밀번호 (bcrypt 해시 값). 간편로그인으로만 가입한 회원은 비밀번호가 없으므로 null 허용
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // 회원 이름 (실명 등, 가입 시 입력값)
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    // 닉네임 (마이페이지에서 수정 가능한 표시 이름)
    nickname: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    // 프로필 이미지 경로 (예: /uploads/profiles/xxxx.jpg). 미등록 시 null
    profileImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    // 로그인 세션 유지를 위한 Refresh Token (bcrypt 해시로 저장, 로그아웃 시 null 처리)
    refreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    // 권한 (user: 일반 회원, admin: 축제/문화재 데이터를 관리하는 운영자)
    // 신규 가입은 항상 user이며, admin 승격은 별도 스크립트(npm run admin:grant)로만 가능하다.
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
    },

    // 계정 상태 (active: 정상, withdrawn: 탈퇴)
    status: {
      type: DataTypes.ENUM('active', 'withdrawn'),
      allowNull: false,
      defaultValue: 'active',
    },

    // 탈퇴 처리 시각
    withdrawnAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    // createdAt / updatedAt 컬럼 자동 관리
    timestamps: true,
  }
);

module.exports = User;
