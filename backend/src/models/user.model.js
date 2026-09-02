const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 회원(User) 도메인 모델.
 * 일반 회원가입(local)과 SNS 간편로그인(naver/kakao/google) 계정을 함께 관리한다.
 */
class User extends Model {}

User.init(
  {
    // 회원 고유 식별자
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 이메일 (로그인 아이디로 사용, SNS 로그인 시 provider에서 제공하는 이메일)
    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },

    // 비밀번호 (bcrypt 해시 값). SNS 전용 계정은 비밀번호가 없으므로 null 허용
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // 회원 이름/닉네임
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    // 가입 경로 (local: 자체 회원가입, naver/kakao/google: 간편로그인)
    provider: {
      type: DataTypes.ENUM('local', 'naver', 'kakao', 'google'),
      allowNull: false,
      defaultValue: 'local',
    },

    // SNS 로그인 제공자가 발급한 고유 사용자 ID (local 가입 시 null)
    providerId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // 로그인 세션 유지를 위한 Refresh Token (bcrypt 해시로 저장, 로그아웃 시 null 처리)
    refreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
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
    indexes: [
      // 동일 provider 내에서 providerId는 유일해야 한다. (SNS 계정 중복 가입 방지)
      { unique: true, fields: ['provider', 'provider_id'], name: 'uq_provider_provider_id' },
      // 동일 provider 내에서 email은 유일해야 한다. (local 계정 중복 가입 방지)
      { unique: true, fields: ['provider', 'email'], name: 'uq_provider_email' },
    ],
  }
);

module.exports = User;
