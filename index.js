import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import userRoutes from "./routes/user.js";
import orderRoutes from "./routes/order.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Add your Razorpay key and secret to the .env file
// RAZORPAY_KEY_ID=your_key_id
// RAZORPAY_KEY_SECRET=your_key_secret
// Add a JWT secret to your .env file
// JWT_SECRET=your_jwt_secret

app.use("/api", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// GET all products (unauthenticated)
app.get("/api/dresses", async (req, res) => {
    try {
        const dresses = await prisma.dresses.findMany({
            select: {
                id: true,
                name: true,
                price: true,
                original_price: true,
                rating: true,
                reviews: true,
                image: true,
                description: true,
                quantity: true,
                sizes: true
            },
        });

        // Map DB fields → frontend shape
        const payload = dresses.map((d) => ({
            id: d.id,
            name: d.name,
            price: d.price,
            originalPrice: d.original_price, // ✅ rename to camelCase
            rating: d.rating ?? 0,
            reviews: d.reviews ?? 0,
            image: d.image ?? "",
            description: d.description ?? "",
            category: "suit", // you don’t have this field; hardcoded for now
            quantity: d.quantity ?? 0,
            size: d.sizes ?? 0
        }));

        res.json(payload);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
});
