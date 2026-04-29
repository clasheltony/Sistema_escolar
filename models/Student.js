module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define('Student', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    enrollment: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });
  return Student;
};
