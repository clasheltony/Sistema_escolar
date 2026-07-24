module.exports = (sequelize, DataTypes) => {
  const Bimester = sequelize.define('Bimester', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  });
  return Bimester;
};
