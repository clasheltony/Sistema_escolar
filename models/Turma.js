module.exports = (sequelize, DataTypes) => {
  const Turma = sequelize.define('Turma', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    serieId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  });
  return Turma;
};
