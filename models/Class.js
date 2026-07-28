module.exports = (sequelize, DataTypes) => {
  const Class = sequelize.define('Class', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    turmaId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true
    },
    baseTecnica: {
      type: DataTypes.STRING,
      allowNull: true
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  });
  return Class;
};
