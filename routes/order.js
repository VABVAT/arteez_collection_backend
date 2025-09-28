import express from "express";
import { PrismaClient } from "@prisma/client";
import Razorpay from "razorpay";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { authenticateJWT } from "../auth.js";

const prisma = new PrismaClient();
const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST create a new order
router.post("/", authenticateJWT, async (req, res) => {
    const { amount, currency, dresses } = req.body;
    const userId = req.user.userId;
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const dressIds = dresses.map((dress) => dress.dressId);
        const dbDresses = await prisma.dresses.findMany({
            where: {
                id: {
                    in: dressIds,
                },
            },
        });

        const dbAmount = dbDresses.reduce((acc, dress) => acc + dress.price, 0);

        if (dbAmount * 100 !== amount) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt: nanoid(),
        });

        const newOrder = await prisma.order.create({
            data: {
                razorpayOrderId: order.id,
                status: "created",
                amount,
                currency,
                addressTo: user.address,
                user: {
                    connect: {
                        id: userId,
                    },
                },
                dresses: {
                    create: dresses.map((dress) => ({
                        dress: {
                            connect: {
                                id: dress.dressId,
                            },
                        },
                        size: dress.size,
                    })),
                },
            },
        });

        res.json(newOrder);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// POST verify a Razorpay payment
router.post("/payment/verify", async (req, res) => {
    const { orderId, paymentId, signature } = req.body;
    try {
        const order = await prisma.order.findUnique({
            where: {
                razorpayOrderId: orderId,
            },
        });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(orderId + "|" + paymentId)
            .digest("hex");

        if (generated_signature === signature) {
            await prisma.order.update({
                where: {
                    razorpayOrderId: orderId,
                },
                data: {
                    status: "paid",
                    completedAt: new Date(),
                    payment: {
                        create: {
                            razorpayPaymentId: paymentId,
                            razorpaySignature: signature,
                        },
                    },
                },
            });
            res.json({ status: "success" });
        } else {
            res.json({ status: "failure" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to verify payment" });
    }
});

// GET user's paid orders
router.get("/me", authenticateJWT, async (req, res) => {
    const userId = req.user.userId;
    try {
        const orders = await prisma.order.findMany({
            where: {
                userId,
                status: "paid",
            },
            select: {
                id: true,
                razorpayOrderId: true,
                amount: true,
                currency: true,
                status: true,
                completedAt: true,
                addressTo: true,
                delivered: true,
                dresses: {
                    select: {
                        size: true,
                        dress: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                image: true,
                            }
                        }
                    }
                }
            }
        });
        const ordersWithIsDelivered = orders.map(order => {
            const { delivered, ...orderWithoutDelivered } = order;
            return { ...orderWithoutDelivered, isDelivered: delivered };
        });
        res.json(ordersWithIsDelivered);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

export default router;