'use client'

import { useDispatch, useSelector } from "react-redux";
import { useState, useEffect } from "react";
import Counter from "@/components/Counter";
import CartSummaryBox from "@/components/CartSummaryBox";
import ProductCard from "@/components/ProductCard";
import { deleteItemFromCart, rehydrateCart } from "@/lib/features/cart/cartSlice";
import { PackageIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { fetchShippingSettings, calculateShipping } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

export default function Cart() {

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    // TODO: Integrate Firebase Auth for user and token if needed
    const getToken = async () => null;
    const isSignedIn = false;

    const { cartItems } = useSelector(state => state.cart);
    const products = useSelector(state => state.product.list);        

    const dispatch = useDispatch();

    const [cartArray, setCartArray] = useState([]);
    const [totalPrice, setTotalPrice] = useState(0);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [shippingSetting, setShippingSetting] = useState(null);
    const [shippingFee, setShippingFee] = useState(0);

    const createCartArray = () => {
        setTotalPrice(0);
        const cartArray = [];
        const invalidKeys = [];
        
        console.log('Cart Items Keys:', Object.keys(cartItems));
        console.log('Available Products:', products.map(p => ({ id: p._id, name: p.name })));
        
        for (const [key, value] of Object.entries(cartItems)) {       
            const product = products.find(product => String(product._id) === String(key));
            if (product) {
                cartArray.push({
                    ...product,
                    quantity: value,
                });
                setTotalPrice(prev => prev + product.price * value);  
            } else {
                // Track invalid product IDs for cleanup
                console.log('Invalid cart item key:', key);
                invalidKeys.push(key);
            }
        }
        
        // Clean up invalid cart items (old product.id references)
        if (invalidKeys.length > 0) {
            console.log('Cleaning up invalid cart items:', invalidKeys);
            invalidKeys.forEach(key => {
                dispatch(deleteItemFromCart({ productId: key }));
            });
        }
        
        console.log('Final Cart Array:', cartArray);
        setCartArray(cartArray);
    }

    const handleDeleteItemFromCart = (productId) => {
        dispatch(deleteItemFromCart({ productId }))
    }

    const fetchRecentOrders = async () => {
        if (!isSignedIn) {
            setLoadingOrders(false);
            return;
        }
        try {
            const token = await getToken();
            const { data } = await axios.get('/api/orders', {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Get unique products from recent orders (limit to last 8 products)                                                                        const recentProducts = [];
            const seenProductIds = new Set();

            if (data.orders && data.orders.length > 0) {
                for (const order of data.orders) {
                    for (const item of order.orderItems) {
                        if (!seenProductIds.has(item.product._id) && recentProducts.length < 8) {                                                                        seenProductIds.add(item.product._id);      
                            recentProducts.push(item.product);        
                        }
                    }
                    if (recentProducts.length >= 8) break;
                }
            }

            setRecentOrders(recentProducts);
        } catch (error) {
            console.error('Failed to fetch recent orders:', error);   
        } finally {
            setLoadingOrders(false);
        }
    }

    useEffect(() => {
        dispatch(rehydrateCart());
    }, [dispatch]);

    useEffect(() => {
        if (products.length > 0) {
            createCartArray();
        }
    }, [cartItems, products]);

    useEffect(() => {
        async function loadShipping() {
            const setting = await fetchShippingSettings();
            setShippingSetting(setting);
        }
        loadShipping();
    }, []);

    useEffect(() => {
        if (shippingSetting && cartArray.length > 0) {
            setShippingFee(calculateShipping({ cartItems: cartArray, shippingSetting }));
        } else {
            setShippingFee(0);
        }
    }, [shippingSetting, cartArray]);

    useEffect(() => {
        fetchRecentOrders();
    }, [isSignedIn]);

    return (
        <div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">                                                                      {/* Cart Section */}
                {cartArray.length > 0 ? (
                    <>
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Cart ({cartArray.length})</h1>                                             </div>

                        <div className="flex gap-6 max-lg:flex-col">  
                            {/* Cart Items */}
                            <div className="flex-1 space-y-4">        
                                {cartArray.map((item, index) => (     
                                    <div key={index} className="rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow" style={{background: 'inherit'}}>                                               <div className="flex gap-4">
                                            {/* Product Image */}     
                                            <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">                                                                <Image
                                                    src={item.images[0]}                                                                                                                        alt={item.name}   
                                                    width={96}        
                                                    height={96}       
                                                    className="w-full h-full object-contain p-2"                                                                                            />
                                            </div>

                                            {/* Product Info */}      
                                            <div className="flex-1 min-w-0">                                                                                                                <h3 className="font-semibold text-gray-900 text-sm md:text-base line-clamp-2 mb-1">                                                             {item.name}       
                                                </h3>
                                                <p className="text-xs text-gray-500 mb-2">{item.category}</p>                               
                                                <div className="flex items-center justify-between mt-3">                                                                                        {/* Price */}     
                                                    <div>
                                                        <p className="text-lg font-bold text-orange-600">                                                                                               {currency} {item.price.toLocaleString()}                                                                                                </p>
                                                    </div>

                                                    {/* Quantity Counter */}                                                                                                                    <div className="flex items-center gap-3">                                                                                                       <Counter productId={item._id} />                                                                                                         </div>
                                                </div>

                                                {/* Mobile: Total & Remove */}                                                                                                              <div className="flex items-center justify-between mt-3 md:hidden">                                                                              <p className="text-sm font-semibold text-gray-900">                                                                                             Total: {currency}{(item.price * item.quantity).toLocaleString()}                                                                        </p>
                                                    <button
                                                        onClick={() => handleDeleteItemFromCart(item._id)}                                                                                           className="text-red-500 hover:text-red-700 text-sm font-medium"                                                                         >
                                                        REMOVE        
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Desktop: Total Price & Remove */}                                                                                                       <div className="hidden md:flex flex-col items-end justify-between">                                                                             <button
                                                    onClick={() => handleDeleteItemFromCart(item._id)}                                                                                           className="text-gray-400 hover:text-red-500 transition-colors"                                                                          >
                                                    <Trash2Icon size={20} />                                                                                                                </button>
                                                <p className="text-lg font-bold text-gray-900">                                                                                                 {currency}{(item.price * item.quantity).toLocaleString()}                                                                               </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Order Summary - Sticky on Desktop */}
                            <div className="lg:w-[380px]">
                                <div className="lg:sticky lg:top-6 space-y-6">
                                    <CartSummaryBox
                                        subtotal={totalPrice}
                                        shipping={shippingFee}
                                        total={totalPrice + shippingFee}
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="min-h-[60vh] flex items-center justify-center">                                                                                 <div className="text-center bg-white rounded-2xl p-12 shadow-sm max-w-md">                                                                      <div className="w-24 h-24 mx-auto mb-6 bg-orange-50 rounded-full flex items-center justify-center">                                             <PackageIcon size={48} className="text-orange-400" />                                                                                   </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Your cart is empty</h1>                                                   <p className="text-gray-500 mb-6">Add some products to get started</p>                                                                      <a
                                href="/products"
                                className="inline-block bg-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"                                                                                    >
                                Continue Shopping
                            </a>
                        </div>
                    </div>
                )}

                {/* Recently Ordered Products Section */}
                {isSignedIn && !loadingOrders && recentOrders.length > 0 && (                                                                                   <div className="mt-16 mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <PackageIcon className="text-slate-700" size={28} />                                                                                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Recently Ordered</h2>                                                     </div>
                        <p className="text-slate-500 mb-6">Products from your recent orders</p>                                             
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">                                                           {recentOrders.map((product) => (
                                <ProductCard key={product._id} product={product} />                                                                                      ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}