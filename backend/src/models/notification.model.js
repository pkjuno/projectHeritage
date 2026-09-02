const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Festival = require('./festival.model');

/**
 * 회원에게 보낼 알림 모델.
 *
 * 푸시 전송과 별개로 알림 이력을 DB에 남긴다.
 * - 앱에서 "알림함"을 보여줄 수 있고,
 * - 푸시 전송에 실패해도 사용자가 놓치지 않으며,
 * - 같은 알림을 중복 생성하지 않았는지 판단할 근거가 된다.
 */
class Notification extends Model {}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 받는 회원 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 알림 종류 (schedule_reminder: 방문 예정일 하루 전 알림)
    type: {
      type: DataTypes.ENUM('schedule_reminder', 'festival_start', 'notice'),
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    body: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    // 알림을 누르면 이동할 축제 (없을 수도 있음)
    festivalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // 중복 생성을 막기 위한 키. 예: "schedule_reminder:12" (일정 ID 기준)
    // 배치가 여러 번 돌아도 같은 알림이 두 번 만들어지지 않게 한다.
    dedupeKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },

    // 푸시를 실제로 보낸 시각. null이면 아직 미발송.
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // 사용자가 확인한 시각. null이면 안 읽음.
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      // 같은 알림이 중복 생성되는 것을 DB 레벨에서 막는다.
      { unique: true, fields: ['user_id', 'dedupe_key'], name: 'uq_notification_user_dedupe' },
      // 내 알림함을 최신순으로 조회할 때 사용한다.
      { fields: ['user_id', 'created_at'], name: 'idx_notification_user_created' },
    ],
  }
);

// 회원/축제가 삭제되면 알림도 함께 정리된다.
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Festival.hasMany(Notification, { foreignKey: 'festivalId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(Festival, { foreignKey: 'festivalId', as: 'festival' });

module.exports = Notification;
