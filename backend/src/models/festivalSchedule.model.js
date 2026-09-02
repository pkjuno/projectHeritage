const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Festival = require('./festival.model');

/**
 * 내 축제 일정 모델.
 * 위시리스트(찜)와 달리 "언제 방문할지" 날짜가 정해진 개인 계획이다.
 * 같은 축제를 여러 날 방문하는 계획도 세울 수 있으므로 (회원+축제)가 아니라
 * (회원+축제+방문일) 조합을 유일 키로 둔다.
 */
class FestivalSchedule extends Model {}

FestivalSchedule.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 일정을 등록한 회원 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 방문할 축제 (Festival FK)
    festivalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 방문 예정일. 반드시 축제 개최 기간(startDate~endDate) 안에 있어야 한다.
    visitDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // 개인 메모 (동행자, 준비물 등)
    memo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'FestivalSchedule',
    tableName: 'festival_schedules',
    timestamps: true,
    indexes: [
      // 같은 축제를 같은 날짜로 중복 등록할 수 없다.
      {
        unique: true,
        fields: ['user_id', 'festival_id', 'visit_date'],
        name: 'uq_schedule_user_festival_date',
      },
      // 내 일정을 기간으로 조회할 때 사용한다.
      { fields: ['user_id', 'visit_date'], name: 'idx_schedule_user_visit_date' },
    ],
  }
);

// 회원/축제가 삭제되면 일정도 함께 정리된다.
User.hasMany(FestivalSchedule, { foreignKey: 'userId', as: 'schedules', onDelete: 'CASCADE' });
FestivalSchedule.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Festival.hasMany(FestivalSchedule, { foreignKey: 'festivalId', as: 'schedules', onDelete: 'CASCADE' });
FestivalSchedule.belongsTo(Festival, { foreignKey: 'festivalId', as: 'festival' });

module.exports = FestivalSchedule;
