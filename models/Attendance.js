module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
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
    },
    lessonTopic: {
      type: DataTypes.STRING,
      allowNull: true
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    classId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  });
  return Attendance;
};
