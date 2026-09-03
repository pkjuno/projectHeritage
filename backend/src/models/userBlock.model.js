const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');

/**
 * 사용자 차단 모델.
 *
 * 신고와 달리 운영자가 관여하지 않는 **개인 설정**이다.
 * 차단해도 상대의 글이 삭제되지는 않고, 차단한 사람의 화면에서만 보이지 않는다.
 *
 * 차단당한 사람은 자기가 차단됐다는 사실을 알 수 없어야 한다.
 * 알려주면 차단이 곧 상대에게 보내는 메시지가 되어 갈등을 키운다.
 */
class UserBlock extends Model {}

UserBlock.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 차단한 사람 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 차단당한 사람 (User FK)
    blockedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'UserBlock',
    tableName: 'user_blocks',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['user_id', 'blocked_user_id'], name: 'uq_user_block_pair' },
    ],
  }
);

User.hasMany(UserBlock, { foreignKey: 'userId', as: 'blocks', onDelete: 'CASCADE' });
UserBlock.belongsTo(User, { foreignKey: 'userId', as: 'blocker' });
UserBlock.belongsTo(User, { foreignKey: 'blockedUserId', as: 'blockedUser' });

module.exports = UserBlock;
