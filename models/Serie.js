module.exports = (sequelize, DataTypes) => {
  const Serie = sequelize.define('Serie', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  });
  return Serie;
};
