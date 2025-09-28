import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateJWT } from "../auth.js";
import multer from "multer";
import AWS from "aws-sdk";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();
const router = express.Router();

// AWS S3 configuration
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: "ap-south-1",
});

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware to check if the user is an admin
const isAdmin = async (req, res, next) => {
    const userId = req.user.userId;
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (user && user.role === "ADMIN") {
            next();
        } else {
            return res.sendStatus(403);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to authorize" });
    }
};

// POST upload photo to S3
router.post("/uploadphoto", authenticateJWT, isAdmin, upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const params = {
        Bucket: "testbucketxad",
        Key: `${nanoid()}-${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    s3.upload(params, (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to upload file" });
        }
        res.json({
            message: "File uploaded successfully",
            bucket: "testbucketxad",
            region: "ap-south-1",
            url: data.Location,
        });
    });
});

// GET all users
router.get("/users", authenticateJWT, isAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// GET all orders
router.get("/orders", authenticateJWT, isAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: {
                status: "paid",
            },
            include: {
                user: true,
                dresses: {
                    include: {
                        dress: true,
                    },
                },
                payment: true,
            },
        });
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// POST add a new dress
router.post("/dresses", authenticateJWT, isAdmin, async (req, res) => {
    let { name, price, original_price, rating, reviews, image, description, quantity, sizes } = req.body;
    original_price = parseInt(original_price);
    price = parseInt(price);
    quantity = parseInt(quantity);
    try {
        const dress = await prisma.dresses.create({
            data: {
                name,
                price,
                original_price,
                rating,
                reviews,
                image,
                description,
                quantity,
                sizes,
            },
        });
        res.json(dress);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to add dress" });
    }
});

// PUT edit an existing dress
router.put("/dresses/:id", authenticateJWT, isAdmin, async (req, res) => {
    const { id } = req.params;
    let { name, price, original_price, rating, reviews, image, description, quantity, sizes } = req.body;
    original_price = parseInt(original_price);
    price = parseInt(price);
    quantity = parseInt(quantity);
    try {
        const dress = await prisma.dresses.update({
            where: {
                id: parseInt(id),
            },
            data: {
                name,
                price,
                original_price,
                rating,
                reviews,
                image,
                description,
                quantity,
                sizes,
            },
        });
        res.json(dress);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to edit dress" });
    }
});

// DELETE a dress
router.delete("/dresses/:id", authenticateJWT, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.dresses.delete({
            where: {
                id: parseInt(id),
            },
        });
        res.json({ message: "Dress deleted successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to delete dress" });
    }
});

// PUT mark an order as delivered
router.put("/orders/:id/deliver", authenticateJWT, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const order = await prisma.order.update({
            where: {
                id,
            },
            data: {
                delivered: true,
            },
        });
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to mark order as delivered" });
    }
});

export default router;
