module.exports = (sequelize, DataTypes) => {
  const SyncQueue = sequelize.define('SyncQueue', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tableName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    recordId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    operation: {
      type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE'),
      allowNull: false
    },
    data: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    synced: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    syncError: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });
  return SyncQueue;
};
