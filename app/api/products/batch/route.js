import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";

export async function POST(req) {
    try {
        await connectDB();
        const { productIds } = await req.json();

        if (!productIds || !Array.isArray(productIds)) {
            return Response.json({ error: 'Invalid product IDs' }, { status: 400 });
        }

        const products = await Product.find({ _id: { $in: productIds } })
            .select('name price images discount category inStock')
            .lean();

        return Response.json({ products });
    } catch (error) {
        console.error('Error fetching products:', error);
        return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}
