const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');

/**
 * 간편로그인(SNS) 연결 모델.
 * 회원 1명이 카카오/네이버/구글을 각각 연결(1:N)할 수 있으며,
 * 마이페이지에서 개별적으로 연결/해지할 수 있다.
 */
class SocialAccount extends Model {}

SocialAccount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 연결된 회원 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 간편로그인 제공자
    provider: {
      type: DataTypes.ENUM('naver', 'kakao', 'google'),
      allowNull: false,
    },

    // 제공자가 발급한 고유 사용자 ID
    providerId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    // 제공자가 내려준 이메일 (동의하지 않으면 null)
    providerEmail: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SocialAccount',
    tableName: 'social_accounts',
    timestamps: true,
    indexes: [
      // 하나의 SNS 계정은 한 회원에게만 연결될 수 있다.
      { unique: true, fields: ['provider', 'provider_id'], name: 'uq_social_provider_provider_id' },
      // 한 회원은 같은 제공자를 중복으로 연결할 수 없다.
      { unique: true, fields: ['user_id', 'provider'], name: 'uq_social_user_provider' },
    ],
  }
);

// 회원 1명은 여러 SNS 계정을 연결할 수 있다. 회원 삭제 시 연결 정보도 함께 삭제한다.
User.hasMany(SocialAccount, { foreignKey: 'userId', as: 'socialAccounts', onDelete: 'CASCADE' });
SocialAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = SocialAccount;
