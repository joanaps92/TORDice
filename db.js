const mongoose = require('mongoose');
require('dotenv').config();

const rollSchema = new mongoose.Schema({
  room:       { type: String, required: true, index: true },
  user:       { type: String, required: true },
  stance:     { type: String },
  d12Results: { type: [Number], default: [] },
  d6Results:  { type: [Number], default: [] },
  total:      { type: Number, required: true },
  timestamp:  { type: String, required: true },
  adventurerId: { type: String, default: '' },
  adventurerName: { type: String, default: '' },
  rollType: { type: String, default: '' },
  actionKey: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  targetNumber: { type: Number },
  modifier: { type: Number, default: 0 },
  hopeSpent: { type: Boolean, default: false },
  weary: { type: Boolean, default: false },
  illFavoured: { type: Boolean, default: false },
  featDiceMode: { type: String, default: 'normal' },
  effectiveFeatDie: { type: Number },
  outcome: { type: String, default: '' },
  weapon: { type: mongoose.Schema.Types.Mixed },
  createdAt:  { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  email: { type: String, trim: true, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date }
});

// La ficha se mantiene flexible para poder conservar el JSON completo del aventurero.
const adventurerSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  trancos: { type: Boolean, default: false },
  ficha: { type: mongoose.Schema.Types.Mixed, required: true },
  // Se mantienen opcionales para que las hojas creadas antes de introducir
  // el control de visibilidad sigan siendo legibles por los administradores.
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  visibility: { type: String, enum: ['private', 'selected', 'all'], default: 'private' },
  visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const adventureHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sceneId: { type: String, required: true },
  type: { type: String, enum: ['SCENE', 'CHOICE', 'ROLL', 'SYSTEM'], required: true },
  text: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const adventureSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  adventureId: { type: String, required: true, index: true },
  characterId: { type: String, required: true },
  currentSceneId: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active', index: true },
  storyFlags: { type: mongoose.Schema.Types.Mixed, default: {} },
  adventureState: { type: mongoose.Schema.Types.Mixed, default: {} },
  pendingRoll: { type: mongoose.Schema.Types.Mixed, default: null },
  history: { type: [adventureHistorySchema], default: [] },
  startedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Roll = mongoose.model('Roll', rollSchema);
const Room = mongoose.model('Room', roomSchema);
const Adventurer = mongoose.model('Adventurer', adventurerSchema);
const AdventureSession = mongoose.model('AdventureSession', adventureSessionSchema);
const User = mongoose.model('User', userSchema);

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');
}

module.exports = { connectDB, Roll, Room, Adventurer, AdventureSession, User };
