
"use server";
import imagekit from "@/configs/imageKit";
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { getAuth } from '@/lib/firebase-admin';

// Helper: Upload images to ImageKit
const uploadImages = async (images) => {
    return Promise.all(
        images.map(async (image) => {
            const buffer = Buffer.from(await image.arrayBuffer());
            const response = await imagekit.upload({
                file: buffer,
                fileName: image.name,
                folder: "products"
            });
            return imagekit.url({
                path: response.filePath,
                transformation: [
                    { quality: "auto" },
                    { format: "webp" },
                    { width: "1024" }
                ]
            });
        })
    );
};

// POST: Create a new product
export async function POST(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not signed in, userId remains null
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        const formData = await request.formData();
        const name = formData.get("name");
        const description = formData.get("description");
        const category = formData.get("category");
        const sku = formData.get("sku") || null;
        const images = formData.getAll("images");
        const stockQuantity = formData.get("stockQuantity") ? Number(formData.get("stockQuantity")) : 0;
        // New: variants support
        const hasVariants = String(formData.get("hasVariants") || "false").toLowerCase() === "true";
        const variantsRaw = formData.get("variants"); // expected JSON string if hasVariants
        const attributesRaw = formData.get("attributes"); // optional JSON of attribute definitions
        // Fast delivery toggle
        const fastDelivery = String(formData.get("fastDelivery") || "false").toLowerCase() === "true";

        // Base pricing (used when no variants)
        const mrp = Number(formData.get("mrp"));
        const price = Number(formData.get("price"));
        // Slug from form (manual or auto)
        let slug = formData.get("slug")?.toString().trim() || "";
        if (slug) {
            // Clean up slug: only allow a-z, 0-9, dash
            slug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
            slug = slug.replace(/(^-|-$)+/g, '');
        } else {
            // Generate slug from name
            slug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        }
        // Ensure slug is unique
        const existing = await Product.findOne({ slug }).lean();
        if (existing) {
            return NextResponse.json({ error: "Slug already exists. Please use a different slug." }, { status: 400 });
        }

        // Validate core fields
        if (!name || !description || !category || images.length < 1) {
            return NextResponse.json({ error: "Missing product details" }, { status: 400 });
        }

        let variants = [];
        let finalPrice = price;
        let finalMrp = mrp;
        let inStock = true;

        if (hasVariants) {
            try {
                variants = JSON.parse(variantsRaw || "[]");
                if (!Array.isArray(variants) || variants.length === 0) {
                    return NextResponse.json({ error: "Variants must be a non-empty array when hasVariants is true" }, { status: 400 });
                }
            } catch (e) {
                return NextResponse.json({ error: "Invalid variants JSON" }, { status: 400 });
            }

            // Compute derived fields from variants
            const prices = variants.map(v => Number(v.price)).filter(n => Number.isFinite(n));
            const mrps = variants.map(v => Number(v.mrp ?? v.price)).filter(n => Number.isFinite(n));
            const stocks = variants.map(v => Number(v.stock ?? 0)).filter(n => Number.isFinite(n));
            finalPrice = prices.length ? Math.min(...prices) : 0;
            finalMrp = mrps.length ? Math.min(...mrps) : finalPrice;
            inStock = stocks.some(s => s > 0);
        } else {
            // No variants: require price and mrp
            if (!Number.isFinite(price) || !Number.isFinite(mrp)) {
                return NextResponse.json({ error: "Price and MRP are required when no variants provided" }, { status: 400 });
            }
            inStock = true;
        }

        // Support both file uploads and string URLs
        let imagesUrl = [];
        const filesToUpload = images.filter(img => typeof img !== 'string');
        const urls = images.filter(img => typeof img === 'string');
        if (filesToUpload.length > 0) {
            const uploaded = await uploadImages(filesToUpload);
            imagesUrl = [...urls, ...uploaded];
        } else {
            imagesUrl = urls;
        }

        // Parse attributes optionally
        let attributes = {};
        let shortDescription = null;
        if (attributesRaw) {
            try {
                attributes = JSON.parse(attributesRaw) || {};
                // Extract shortDescription from attributes
                if (attributes.shortDescription) {
                    shortDescription = attributes.shortDescription;
                }
            } catch {
                attributes = {};
            }
        }

        const product = await Product.create({
            name,
            slug,
            description,
            shortDescription,
            mrp: finalMrp,
            price: finalPrice,
            category,
            sku,
            images: imagesUrl,
            hasVariants,
            variants,
            attributes,
            inStock,
            fastDelivery,
            stockQuantity,
            storeId,
        });

        return NextResponse.json({ message: "Product added successfully", product });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// GET: Get all products of the seller
export async function GET(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not signed in, userId remains null
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        // Only return products for this seller's store
        const products = await Product.find({ storeId }).sort({ createdAt: -1 }).lean();
        return NextResponse.json({ products });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// PUT: Update a product
export async function PUT(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not signed in, userId remains null
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        const formData = await request.formData();
        const productId = formData.get("productId");
        const name = formData.get("name");
        const description = formData.get("description");
        const category = formData.get("category");
        const sku = formData.get("sku");
        const images = formData.getAll("images");
        const stockQuantity = formData.get("stockQuantity") ? Number(formData.get("stockQuantity")) : undefined;
        // Variants support
        const hasVariants = String(formData.get("hasVariants") || "").toLowerCase() === "true";
        const variantsRaw = formData.get("variants");
        const attributesRaw = formData.get("attributes");
        const mrp = formData.get("mrp") ? Number(formData.get("mrp")) : undefined;
        const price = formData.get("price") ? Number(formData.get("price")) : undefined;
        const fastDelivery = String(formData.get("fastDelivery") || "").toLowerCase() === "true";
        let slug = formData.get("slug")?.toString().trim() || "";
        if (slug) {
            slug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
            slug = slug.replace(/(^-|-$)+/g, '');
        }

        if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

        let product = await Product.findById(productId).lean();
        if (!product || product.storeId !== storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        let imagesUrl = product.images;
        // If images are all strings (URLs), treat as full replacement (for deletion)
        if (images.length > 0) {
            if (images.every(img => typeof img === 'string')) {
                imagesUrl = images;
            } else {
                const uploaded = await uploadImages(images.filter(img => typeof img !== 'string'));
                // Keep existing URLs, append new uploads
                imagesUrl = [...product.images, ...uploaded];
            }
        }

        // Compute variants/price/mrp/inStock
        let variants = product.variants || [];
        let attributes = product.attributes || {};
        let finalPrice = price ?? product.price;
        let finalMrp = mrp ?? product.mrp;
        let inStock = product.inStock;

        if (hasVariants) {
            try { variants = JSON.parse(variantsRaw || "[]"); } catch { variants = []; }
            const prices = variants.map(v => Number(v.price)).filter(n => Number.isFinite(n));
            const mrps = variants.map(v => Number(v.mrp ?? v.price)).filter(n => Number.isFinite(n));
            const stocks = variants.map(v => Number(v.stock ?? 0)).filter(n => Number.isFinite(n));
            finalPrice = prices.length ? Math.min(...prices) : finalPrice;
            finalMrp = mrps.length ? Math.min(...mrps) : finalMrp;
            inStock = stocks.some(s => s > 0);
        } else if (price !== undefined || mrp !== undefined) {
            // no variants, keep numeric price/mrp if provided
            if (price !== undefined) finalPrice = price;
            if (mrp !== undefined) finalMrp = mrp;
        }

        let shortDescription = product.shortDescription;
        if (attributesRaw) {
            try {
                attributes = JSON.parse(attributesRaw) || attributes;
                // Extract shortDescription from attributes
                if (attributes.shortDescription !== undefined) {
                    shortDescription = attributes.shortDescription;
                }
            } catch {}
        }

        // If slug is provided and changed, check uniqueness
        let updateData = {
            name,
            description,
            shortDescription,
            mrp: finalMrp,
            price: finalPrice,
            category,
            sku,
            images: imagesUrl,
            hasVariants,
            variants,
            attributes,
            inStock,
            fastDelivery,
        };

        // Add stockQuantity if provided
        if (stockQuantity !== undefined) {
            updateData.stockQuantity = stockQuantity;
        }
        if (slug && slug !== product.slug) {
            const existing = await Product.findOne({ slug }).lean();
            if (existing && existing._id.toString() !== productId) {
                return NextResponse.json({ error: "Slug already exists. Please use a different slug." }, { status: 400 });
            }
            updateData.slug = slug;
        }
        product = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true }
        ).lean();

        return NextResponse.json({ message: "Product updated successfully", product });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// DELETE: Delete a product
export async function DELETE(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not signed in, userId remains null
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

        const product = await Product.findById(productId).lean();
        if (!product || product.storeId !== storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        await Product.findByIdAndDelete(productId);
        return NextResponse.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

