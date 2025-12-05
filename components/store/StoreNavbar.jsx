'use client'


import Link from "next/link"
import Image from "next/image";
import Logo from "../../assets/logo/White1@8x.png";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";


const StoreNavbar = ({ storeInfo }) => {
    const { user } = useAuth();

    const handleLogout = async () => {
        await signOut(auth);
        window.location.href = "/";
    };

    return (
        <div className="flex items-center justify-between px-12 py-3 border-b border-slate-200 transition-all">
            <Link href="/store" className="relative text-4xl font-semibold text-slate-700">
                  <Image
                              src={Logo}  
                              alt="Quickfynd Logo"
                              width={180}
                              height={48}
                              className="object-contain"
                              priority
                            />
            </Link>
            <div className="flex items-center gap-3">
                <p>Hi, {storeInfo?.name || user?.displayName || user?.name || user?.email || ''}</p>
                <button
                    onClick={handleLogout}
                    className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                    Logout
                </button>
            </div>
        </div>
    )
}

export default StoreNavbar