import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { authenticateJWT } from "../auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// POST create a new user
router.post("/register", async (req, res) => {
    const { name, email, phone, address, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                address,
                password: hashedPassword,
            },
        });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create user" });
    }
});

// POST login a user
router.post("/login", async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { phone },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid password" });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to login" });
    }
});

// GET current user
router.get("/users/me", authenticateJWT, async (req, res) => {
    const userId = req.user.userId;
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
            },
        });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// PUT update user's address
router.put("/users/me/address", authenticateJWT, async (req, res) => {
    const userId = req.user.userId;
    const { address } = req.body;
    try {
        const user = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                address,
            },
        });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update user address" });
    }
});

export default router;
