import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function tokenFor(user) {
  console.log("JWT SECRET LOADED:", Boolean(process.env.JWT_SECRET));

  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  return res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
  return res.json({ token: tokenFor(user), user: publicUser(user) });
}

export function me(req, res) {
  return res.json({ user: publicUser(req.user) });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, points: user.points, streak: user.streak, longestStreak: user.longestStreak, lastVerifiedAt: user.lastVerifiedAt };
}
