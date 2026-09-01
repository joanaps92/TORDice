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
  createdAt:  { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

// La ficha se mantiene flexible para poder conservar el JSON completo del aventurero.
const adventurerSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  ficha: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Roll = mongoose.model('Roll', rollSchema);
const Room = mongoose.model('Room', roomSchema);
const Adventurer = mongoose.model('Adventurer', adventurerSchema);

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');
}

module.exports = { connectDB, Roll, Room, Adventurer };
