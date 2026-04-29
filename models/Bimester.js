module.exports = (sequelize, DataTypes) => {
  const Bimester = sequelize.define('Bimester', {
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
    }
  });
  return Bimester;
};
