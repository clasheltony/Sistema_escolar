module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    lessonNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    status: {
      type: DataTypes.ENUM('Presente', 'Ausente'),
      allowNull: false,
      defaultValue: 'Presente'
    }
  });
  return Attendance;
};
