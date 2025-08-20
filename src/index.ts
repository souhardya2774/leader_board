import express from 'express';
import mongoose from 'mongoose';
import { Schema, model } from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Configure CORS to allow a single frontend website from .env
const corsOptions = {
  origin: process.env.FRONTEND_URL
};
app.use(cors(corsOptions));

// Database connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new Schema({
  name: { type: String, required: true },
  points: { type: Number, default: 0 }
});

const User = model('User', userSchema);

// History Schema
const historySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const History = model('History', historySchema);

// Routes
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Add User Route
app.post('/add-user', async (req, res) => {
  const { name }:{
    name: string;
  } = req.body;
  if (!name.trim()) return res.status(400).send('Name is required');

  try {
    const newUserName=name.trim();
    const newUser = new User({ name: newUserName });
    await newUser.save();
    res.status(201).send(newUser);
  } catch (error) {
    res.status(500).send('Error adding user');
  }
});

// Updated Claim Points Route with Transactions
app.post('/claim-points', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).send('User ID is required');

  const randomPoints = Math.floor(Math.random() * 10) + 1;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).send('User not found');
    }
    
    // Update points
    user.points += randomPoints;
    await user.save({ session });

    // Add to History Collection
    const historyRecord = new History({ userId, points: randomPoints });
    await historyRecord.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).send({ user, message: `${randomPoints} points awarded` });
  } catch (error) {
    console.error(`Error during claim-point operation: ${String(error)}`); // Log the error
    await session.abortTransaction();
    session.endSession();
    res.status(500).send('Error claiming points');
  }
});

// Get Rankings Route
app.get('/rankings', async (req, res) => {
  try {
    const rankings = await User.find().sort({ points: -1 });
    res.status(200).send(rankings);
  } catch (error) {
    res.status(500).send('Error fetching rankings');
  }
});

// Route to fetch the latest claim history
app.get('/latest-claim-history', async (req, res) => {
  try {
    const latestHistory = await History.find().sort({ timestamp: -1 }).limit(10).populate('userId', 'name');
    res.status(200).send(latestHistory);
  } catch (error) {
    res.status(500).send('Error fetching latest claim history');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
