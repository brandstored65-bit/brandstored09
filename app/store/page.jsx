'use client'
import Loading from "@/components/Loading"

import axios from "axios"

export const dynamic = 'force-dynamic'
import { CircleDollarSignIcon, ShoppingBasketIcon, StarIcon, TagsIcon, UsersIcon, ShoppingCartIcon } from "lucide-react"
import ContactMessagesSeller from "./ContactMessagesSeller.jsx";
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useAuth } from '@/lib/useAuth'

export default function Dashboard() {
    const { user, loading: authLoading, getToken } = useAuth();
    console.log('[page.jsx] user:', user, 'authLoading:', authLoading);
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [dashboardData, setDashboardData] = useState({
        totalProducts: 0,
        totalEarnings: 0,
        totalOrders: 0,
        totalCustomers: 0,
        abandonedCarts: 0,
        ratings: [],
    })
    const dashboardCardsData = [
        { title: 'Total Products', value: dashboardData.totalProducts, icon: ShoppingBasketIcon },
        { title: 'Total Earnings', value: currency + dashboardData.totalEarnings, icon: CircleDollarSignIcon },
        { title: 'Total Orders', value: dashboardData.totalOrders, icon: TagsIcon },
        { title: 'Total Customers', value: dashboardData.totalCustomers, icon: UsersIcon },
        { title: 'Abandoned Carts', value: dashboardData.abandonedCarts, icon: ShoppingCartIcon },
        { title: 'Total Ratings', value: dashboardData.ratings?.length || 0, icon: StarIcon },
    ]

    useEffect(() => {
        const fetchDashboard = async (refreshToken = false) => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const token = await getToken(refreshToken);
                const { data } = await axios.get('/api/store/dashboard', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDashboardData(data.dashboardData);
            } catch (error) {
                // If unauthorized, try refreshing token once
                if (!refreshToken && error?.response?.status === 401) {
                    try {
                        await fetchDashboard(true);
                        return;
                    } catch (retryError) {
                        console.error('Dashboard retry error:', retryError);
                    }
                }
                console.error('Dashboard fetch error:', error);
                toast.error(error?.response?.data?.error || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) {
            fetchDashboard();
        }
    }, [authLoading, user]);

    if (authLoading || loading) return <Loading />

    if (!user) {
        return (
            <div className="min-h-[80vh] mx-6 flex items-center justify-center text-slate-400">
                <h1 className="text-2xl sm:text-4xl font-semibold">Please <span className="text-slate-500">Login</span> to view your dashboard</h1>
            </div>
        );
    }

    return (
        <div className=" text-slate-500 mb-28">
            <h1 className="text-2xl">Seller <span className="text-slate-800 font-medium">Dashboard</span></h1>

            <div className="flex flex-wrap gap-5 my-10 mt-4">
                {
                    dashboardCardsData.map((card, index) => (
                        <div key={index} className="flex items-center gap-11 border border-slate-200 p-3 px-6 rounded-lg">
                            <div className="flex flex-col gap-3 text-xs">
                                <p>{card.title}</p>
                                <b className="text-2xl font-medium text-slate-700">{card.value}</b>
                            </div>
                            <card.icon size={50} className=" w-11 h-11 p-2.5 text-slate-400 bg-slate-100 rounded-full" />
                        </div>
                    ))
                }
            </div>

            <h2>Total Reviews</h2>

            <div className="mt-5">
                {
                    dashboardData.ratings && dashboardData.ratings.length > 0 ? (
                        dashboardData.ratings.map((review, index) => (
                        <div key={index} className="flex max-sm:flex-col gap-5 sm:items-center justify-between py-6 border-b border-slate-200 text-sm text-slate-600 max-w-4xl">
                            <div>
                                <div className="flex gap-3">
                                    <Image
                                        src={review.user?.image && review.user.image.trim() !== '' ? review.user.image : '/placeholder.png'}
                                        alt={review.user?.name ? `${review.user.name} avatar` : 'Customer avatar'}
                                        className="w-10 aspect-square rounded-full"
                                        width={100}
                                        height={100}
                                    />
                                    <div>
                                        <p className="font-medium">{review.user.name}</p>
                                        <p className="font-light text-slate-500">{new Date(review.createdAt).toDateString()}</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-slate-500 max-w-xs leading-6">{review.review}</p>
                            </div>
                            <div className="flex flex-col justify-between gap-6 sm:items-end">
                                <div className="flex flex-col sm:items-end">
                                    <p className="text-slate-400">{review.product?.category}</p>
                                    <p className="font-medium">{review.product?.name}</p>
                                    <div className='flex items-center'>
                                        {Array(5).fill('').map((_, index) => (
                                            <StarIcon key={index} size={17} className='text-transparent mt-0.5' fill={review.rating >= index + 1 ? "#00C950" : "#D1D5DB"} />
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => router.push(`/product/${review.product.slug || review.product._id}`)} className="bg-slate-100 px-5 py-2 hover:bg-slate-200 rounded transition-all">View Product</button>
                            </div>
                        </div>
                    ))
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <p>No reviews yet</p>
                        </div>
                    )
                }
            </div>

            {/* Contact Us Messages Section */}
            <ContactMessagesSeller />
        </div>
    )
}