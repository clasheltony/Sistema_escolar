module.exports = (sequelize, DataTypes) => {
  const Grade = sequelize.define('Grade', {
    activityName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('Visto', 'Nota'),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    value: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true // Vistos might just be a boolean/null, Notas have value
    },
    status: {
      type: DataTypes.BOOLEAN, // true = gave check, false = missed
      allowNull: true
    }
  });
  return Grade;
};
